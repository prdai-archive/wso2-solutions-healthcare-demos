import ballerina/ai;
import ballerina/http;
import ballerina/lang.value;
import ballerinax/ai.openai;

final ai:McpToolKit fhirToolkit = check new (fhirMcpUrl);
final ai:ModelProvider openAiProvider = check new openai:ModelProvider(openAiApiKey, openai:GPT_4_1_NANO);
// nano would write "no active conditions are relevant" in its reasoning while still citing a
// resolved, irrelevant one in referencedResources - the two fields drifted out of sync within a
// single generation. mini doesn't show this: verified live across multiple patients/scenarios,
// citations always matched what the reasoning actually discussed, with no hallucinated ids.
final ai:ModelProvider riskAssessmentProvider = check new openai:ModelProvider(openAiApiKey, openai:GPT_4_1);
// Defense-in-depth on top of the model upgrade above, not a replacement for it: a second, narrower
// pass that re-fetches each citation itself and drops/corrects anything that doesn't actually
// support the specific claim it's attached to. mini is enough here - fact-checking one resource
// against one sentence at a time is a much narrower task than the primary open-ended assessment.
final ai:ModelProvider auditProvider = check new openai:ModelProvider(openAiApiKey, openai:GPT_4_1_MINI);

final ai:Agent questionnaireAgent = check new (
    systemPrompt = {
        role: "Care Loop clinical assistant",
        instructions: questionnaireSystemPrompt
    },
    model = openAiProvider,
    tools = [fhirToolkit],
    verbose = true
);

final ai:Agent riskAssessmentAgent = check new (
    systemPrompt = {
        role: "Care Loop clinical assistant",
        instructions: riskAssessmentSystemPrompt
    },
    model = riskAssessmentProvider,
    tools = [fhirToolkit],
    verbose = true
);

final ai:Agent riskAssessmentAuditAgent = check new (
    systemPrompt = {
        role: "Clinical fact-checker",
        instructions: riskAssessmentAuditPrompt
    },
    model = auditProvider,
    tools = [fhirToolkit],
    verbose = true
);

listener http:Listener sharedListener = new (listenPort);

service /questionnaires on sharedListener {

    resource function post .(QuestionnaireRequest request) returns QuestionnaireResponse|http:InternalServerError {
        string query = string `Patient id: ${request.patientId}.`;

        string|ai:Error result = questionnaireAgent.run(query);
        if result is ai:Error {
            return <http:InternalServerError>{body: {message: "agent run failed: " + result.message()}};
        }

        json|error questionnaire = value:fromJsonString(result);
        if questionnaire is error {
            return <http:InternalServerError>{body: {message: "agent did not return valid JSON: " + questionnaire.message()}};
        }
        return {questionnaire};
    }
}

service /risk\-assessment on sharedListener {

    resource function post .(RiskAssessmentRequest request) returns RiskAssessmentResponse|http:InternalServerError {
        string query = string `Patient id: ${request.patientId}. ML probability of a cardiac event: ${
            request.mlProbability}. Questionnaire answers: ${request.answers.toJsonString()}.`;

        string|ai:Error result = riskAssessmentAgent.run(query);
        if result is ai:Error {
            return <http:InternalServerError>{body: {message: "agent run failed: " + result.message()}};
        }

        json|error assessment = value:fromJsonString(result);
        if assessment is error {
            return <http:InternalServerError>{body: {message: "agent did not return valid JSON: " + assessment.message()}};
        }

        RiskAssessmentResponse|error draft = assessment.cloneWithType();
        if draft is error {
            return <http:InternalServerError>{body: {message: "agent JSON did not match expected shape: " + draft.message()}};
        }

        RiskAssessmentAudit|error audit = auditDraft(draft);
        if audit is error {
            // Audit failing shouldn't sink a valid draft assessment - fall back to the unaudited
            // draft rather than failing the whole request over a fact-check step going wrong.
            return draft;
        }
        // Filter using the ORIGINAL strings from the draft, indexed by the audit's keepIndices -
        // the audit model never re-types an id, so a surviving citation can't be corrupted by a
        // transcription mistake the way it could if the audit had to write the id out itself.
        string[] auditedResources = [];
        foreach int i in audit.keepIndices {
            if i >= 0 && i < draft.referencedResources.length() {
                auditedResources.push(draft.referencedResources[i]);
            }
        }
        return {probability: draft.probability, risk: draft.risk, reasoning: audit.reasoning, referencedResources: auditedResources};
    }
}

isolated function auditDraft(RiskAssessmentResponse draft) returns RiskAssessmentAudit|error {
    string numberedResources = "";
    foreach int i in 0 ..< draft.referencedResources.length() {
        numberedResources += (i > 0 ? "; " : "") + i.toString() + ": " + draft.referencedResources[i];
    }
    string auditQuery = string `Draft reasoning: ${draft.reasoning} Numbered citations: ${numberedResources}`;
    string result = check riskAssessmentAuditAgent.run(auditQuery);
    json assessment = check value:fromJsonString(result);
    return assessment.cloneWithType();
}
