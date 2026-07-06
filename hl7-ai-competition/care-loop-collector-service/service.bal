import ballerina/http;
import ballerina/lang.runtime;
import ballerina/log;
import ballerina/uuid;

final http:Client fhirClient = check new (fhirServerUrl);
final http:Client aiClient = check new (aiServiceUrl);

// http:Client defaults to HTTP_2_0, which probes with an h2c upgrade; Bun's HTTP server
// doesn't support HTTP/2 and closes the connection instead of responding, deterministically
// failing every call with "Remote host closed the connection before initiating inbound
// response". Pinning HTTP_1_1 avoids the probe entirely; verified 0/50 failures after the pin
// (was 50/50 before) across cold connections and reused ones, with both small and ~6KB bodies.
final http:Client whatsappClient = check new (whatsappUrl, httpVersion = http:HTTP_1_1);

const MAX_RETRIES = 3;

// Retry is defense-in-depth for startup-ordering races (DNS not yet resolvable, connection
// refused while whatsapp-simulator is still coming up), not for the HTTP/2 issue above, which
// the httpVersion pin already fixes deterministically - retrying it would just re-fail 3x.
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

service / on new http:Listener(listenPort) {

    resource function post generate() returns GenerateResponse|http:InternalServerError {
        log:printInfo("generate: fetching patients from FHIR server");
        json|http:ClientError bundle = fhirClient->get("/Patient");
        if bundle is http:ClientError {
            return <http:InternalServerError>{body: {message: "failed to fetch patients: " + bundle.message()}};
        }

        record {|string id; string name;|}[] patients = extractPatients(bundle);
        GenerateResult[] results = [];

        foreach var patient in patients {
            GenerateResult result = {patientId: patient.id, patientName: patient.name};

            AiQuestionnaireRequest aiRequest = {patientId: patient.id};
            AiQuestionnaireResponse|http:ClientError aiResponse = aiClient->post("/questionnaires", aiRequest);
            if aiResponse is http:ClientError {
                result.'error = "questionnaire generation failed: " + aiResponse.message();
                results.push(result);
                continue;
            }

            WhatsappQuestionnaire|error whatsappQuestionnaire = toWhatsappQuestionnaire(aiResponse.questionnaire);
            if whatsappQuestionnaire is error {
                result.'error = "failed to convert questionnaire: " + whatsappQuestionnaire.message();
                results.push(result);
                continue;
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
                results.push(result);
                continue;
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
            results.push(result);
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

        json questionnaireResponse = buildQuestionnaireResponse(callback, session);
        http:Response|http:ClientError saveResult = fhirClient->post("/QuestionnaireResponse", questionnaireResponse);
        if saveResult is http:ClientError {
            return <http:BadGateway>{body: {message: "failed to save QuestionnaireResponse: " + saveResult.message()}};
        }

        string? fhirId = extractFhirId(saveResult);
        return <http:Created>{body: {saved: true, fhirId}};
    }
}

isolated function extractPatients(json bundle) returns record {|string id; string name;|}[] {
    record {|string id; string name;|}[] patients = [];
    json[]|error entries = trap <json[]>(checkpanic bundle.entry);
    if entries is error {
        return patients;
    }
    foreach json entry in entries {
        json|error patientResource = entry.'resource;
        if patientResource is error {
            continue;
        }
        string|error id = trap <string>(checkpanic patientResource.id);
        if id is error {
            continue;
        }
        patients.push({id, name: extractPatientName(patientResource, id)});
    }
    return patients;
}

isolated function extractPatientName(json patientResource, string fallbackId) returns string {
    json[]|error names = trap <json[]>(checkpanic patientResource.name);
    if names is error || names.length() == 0 {
        return fallbackId;
    }
    json name = names[0];

    string|error text = trap <string>(checkpanic name.text);
    if text is string {
        return text;
    }

    string|error family = trap <string>(checkpanic name.family);
    json[]|error givenList = trap <json[]>(checkpanic name.given);
    string given = "";
    if givenList is json[] && givenList.length() > 0 {
        string|error firstGiven = trap <string>(givenList[0]);
        if firstGiven is string {
            given = firstGiven;
        }
    }
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

isolated function buildQuestionnaireResponse(TranscriptCallback callback, GeneratedSession session) returns json {
    json[] items = [];
    foreach ChatMessage message in callback.messages {
        string? questionId = message.questionId ?: message.replyTo?.questionId;
        if message.role == "user" && questionId is string {
            items.push({
                linkId: questionId,
                answer: [{valueString: message.text}]
            });
        }
    }

    map<json> questionnaireResponse = {
        resourceType: "QuestionnaireResponse",
        status: "completed",
        subject: {reference: "Patient/" + session.patientId},
        item: items
    };

    string|error questionnaireId = trap <string>(checkpanic session.questionnaire.id);
    if questionnaireId is string {
        questionnaireResponse["questionnaire"] = "Questionnaire/" + questionnaireId;
    }

    return questionnaireResponse;
}

isolated function extractFhirId(http:Response response) returns string? {
    string|error location = response.getHeader("Location");
    if location is string {
        string[] segments = re `/`.split(location);
        int index = segments.length() - 1;
        while index >= 0 {
            if segments[index] != "" && segments[index] != "_history" {
                return segments[index];
            }
            index -= 1;
        }
    }

    json|error payload = response.getJsonPayload();
    if payload is json {
        string|error id = trap <string>(checkpanic payload.id);
        if id is string {
            return id;
        }
    }
    return ();
}
