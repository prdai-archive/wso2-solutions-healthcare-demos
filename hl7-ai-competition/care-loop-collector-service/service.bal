import ballerina/http;
import ballerina/lang.runtime;
import ballerina/log;
import ballerina/uuid;
import ballerinax/health.clients.fhir;
import ballerinax/health.fhir.r4;
import ballerinax/health.fhir.r4.international401;

// Capability-statement validation would GET /metadata at construction time, racing this service's own startup against care-loop-fhir-server's - disabled.
final fhir:FHIRConnector fhirConnector = check new ({baseURL: fhirServerUrl}, enableCapabilityStatementValidation = false);
final http:Client aiClient = check new (aiServiceUrl);

// http:Client defaults to HTTP_2_0, which probes with an h2c upgrade that Bun's HTTP server resets the connection on instead of answering - pinning HTTP_1_1 avoids it (verified 0/50 failures vs 50/50 before).
final http:Client whatsappClient = check new (whatsappUrl, httpVersion = http:HTTP_1_1);

const MAX_RETRIES = 3;

// Retry is defense-in-depth for startup-ordering races (DNS/connection-refused), not the HTTP/2 issue above, which the httpVersion pin already fixes deterministically.
isolated function postWithRetry(http:Client 'client, string path, json body, typedesc<anydata> targetType)
        returns anydata|http:ClientError {
    http:ClientError lastError = error("unreachable");
    foreach int attempt in 0 ..< MAX_RETRIES {
        anydata|http:ClientError response = 'client->post(path, body, targetType = targetType);
        if response !is http:ClientError {
            return response;
        }
        lastError = response;
        if attempt < MAX_RETRIES - 1 {
            log:printWarn("POST failed, retrying", path = path, attempt = attempt, 'error = response);
            runtime:sleep(0.5);
        }
    }
    return lastError;
}

isolated map<GeneratedSession> generatedSessions = {};

# Runs one patient's questionnaire generation + whatsapp session creation end to end; isolated so `start` can run it concurrently.
isolated function processPatient(Patient patient) returns GenerateResult {
    GenerateResult result = {patientId: patient.id, patientName: patient.name};

    AiQuestionnaireRequest aiRequest = {patientId: patient.id};
    AiQuestionnaireResponse|http:ClientError aiResponse = aiClient->post("/questionnaires", aiRequest);
    if aiResponse is http:ClientError {
        result.'error = "questionnaire generation failed: " + aiResponse.message();
        return result;
    }

    WhatsappQuestionnaire|error whatsappQuestionnaire = toWhatsappQuestionnaire(aiResponse.questionnaire);
    if whatsappQuestionnaire is error {
        result.'error = "failed to convert questionnaire: " + whatsappQuestionnaire.message();
        return result;
    }

    CreateSessionRequest sessionRequest = {
        questionnaire: whatsappQuestionnaire,
        callbackUrl: collectorPublicUrl + "/transcripts",
        patientId: patient.id,
        patientName: patient.name
    };
    anydata|http:ClientError sessionResult = postWithRetry(whatsappClient, "/api/sessions", sessionRequest, CreateSessionResponse);
    if sessionResult is http:ClientError {
        result.'error = "failed to create whatsapp session: " + sessionResult.message();
        return result;
    }
    CreateSessionResponse sessionResponse = <CreateSessionResponse>sessionResult;

    lock {
        generatedSessions[sessionResponse.id] = {
            patientId: patient.id,
            patientName: patient.name,
            questionnaire: aiResponse.questionnaire.clone()
        };
    }

    result.sessionId = sessionResponse.id;
    result.path = sessionResponse.path;
    return result;
}

service / on new http:Listener(listenPort) {

    resource function post generate() returns GenerateResponse|http:InternalServerError {
        log:printInfo("generate: fetching patients from FHIR server");
        fhir:FHIRResponse|fhir:FHIRError bundleResponse = fhirConnector->search("Patient");
        if bundleResponse is fhir:FHIRError {
            return <http:InternalServerError>{body: {message: "failed to fetch patients: " + bundleResponse.message()}};
        }

        Patient[] patients = extractPatients(<json>bundleResponse.'resource);

        // Fan out one strand per patient with `start` so calls run concurrently, waited back in patient order for deterministic results.
        future<GenerateResult>[] pending = [];
        foreach var patient in patients {
            future<GenerateResult> f = start processPatient(patient);
            pending.push(f);
        }

        GenerateResult[] results = [];
        foreach int i in 0 ..< pending.length() {
            GenerateResult|error result = wait pending[i];
            if result is error {
                // Unreachable in practice - processPatient has no unhandled throw points - kept as a defensive fallback.
                var patient = patients[i];
                log:printError("processPatient strand failed", patientId = patient.id, 'error = result);
                results.push({patientId: patient.id, patientName: patient.name, 'error: "internal error: " + result.message()});
            } else {
                results.push(result);
            }
        }

        return {results};
    }

    resource function post transcripts(TranscriptCallback callback) returns http:Created|http:NotFound|http:BadGateway {
        GeneratedSession? session = ();
        lock {
            if generatedSessions.hasKey(callback.sessionId) {
                session = generatedSessions.get(callback.sessionId).clone();
            }
        }
        if session is () {
            return <http:NotFound>{body: {message: "unknown sessionId: " + callback.sessionId}};
        }

        international401:QuestionnaireResponse questionnaireResponse = buildQuestionnaireResponse(callback, session);
        fhir:FHIRResponse|fhir:FHIRError saveResult = fhirConnector->create(questionnaireResponse.toJson());
        if saveResult is fhir:FHIRError {
            return <http:BadGateway>{body: {message: "failed to save QuestionnaireResponse: " + saveResult.message()}};
        }

        string? fhirId = extractFhirId(saveResult);
        return <http:Created>{body: {saved: true, fhirId}};
    }
}

isolated function extractPatients(json bundle) returns Patient[] {
    Patient[] patients = [];
    r4:Bundle|error typedBundle = bundle.cloneWithType(r4:Bundle);
    if typedBundle is error {
        return patients;
    }
    foreach r4:BundleEntry entry in typedBundle.entry ?: [] {
        anydata|r4:FHIRWireFormat? entryResource = entry?.'resource;
        international401:Patient|error patientResource = entryResource.cloneWithType(international401:Patient);
        string? id = patientResource is international401:Patient ? patientResource.id : ();
        if patientResource is error || id is () {
            continue;
        }
        patients.push({id, name: extractPatientName(patientResource, id)});
    }
    return patients;
}

isolated function extractPatientName(international401:Patient patientResource, string fallbackId) returns string {
    r4:HumanName[]? names = patientResource.name;
    if names is () || names.length() == 0 {
        return fallbackId;
    }
    r4:HumanName name = names[0];

    if name.text is string {
        return <string>name.text;
    }

    string? family = name.family;
    string[]? givenList = name.given;
    string given = givenList is string[] && givenList.length() > 0 ? givenList[0] : "";
    if family is string && given != "" {
        return given + " " + family;
    }
    if family is string {
        return family;
    }
    if given != "" {
        return given;
    }
    return fallbackId;
}

isolated function toWhatsappQuestionnaire(json questionnaire) returns WhatsappQuestionnaire|error {
    string title = "Care Loop check-in";
    string|error titleValue = trap <string>(checkpanic questionnaire.title);
    if titleValue is string && titleValue.trim() != "" {
        title = titleValue;
    }

    json[] items = [];
    json[]|error itemList = trap <json[]>(checkpanic questionnaire.item);
    if itemList is json[] {
        items = itemList;
    }

    WhatsappQuestion[] questions = [];
    foreach json item in items {
        string|error text = trap <string>(checkpanic item.text);
        if text is error {
            continue;
        }
        questions.push({id: uuid:createType4AsString(), text});
    }

    return {title, questions};
}

isolated function buildQuestionnaireResponse(TranscriptCallback callback, GeneratedSession session) returns international401:QuestionnaireResponse {
    international401:QuestionnaireResponseItem[] items = [];
    foreach ChatMessage message in callback.messages {
        string? questionId = message.questionId ?: message.replyTo?.questionId;
        if message.role == "user" && questionId is string {
            items.push({
                linkId: questionId,
                answer: [{valueString: message.text}]
            });
        }
    }

    international401:QuestionnaireResponse questionnaireResponse = {
        status: international401:CODE_STATUS_COMPLETED,
        subject: {reference: "Patient/" + session.patientId},
        item: items
    };

    string|error questionnaireId = trap <string>(checkpanic session.questionnaire.id);
    if questionnaireId is string {
        questionnaireResponse.questionnaire = "Questionnaire/" + questionnaireId;
    }

    return questionnaireResponse;
}

// create()'s default MINIMAL preference returns {resourceId, version}, not a full resource - fall back to "id" in case that ever changes.
isolated function extractFhirId(fhir:FHIRResponse response) returns string? {
    json|xml resourceValue = response.'resource;
    if resourceValue is json {
        string|error resourceId = trap <string>(checkpanic resourceValue.resourceId);
        if resourceId is string {
            return resourceId;
        }
        string|error id = trap <string>(checkpanic resourceValue.id);
        if id is string {
            return id;
        }
    }
    return ();
}
