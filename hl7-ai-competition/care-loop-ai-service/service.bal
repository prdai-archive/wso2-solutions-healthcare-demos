import ballerina/ai;
import ballerina/http;
import ballerina/lang.value;
import ballerinax/ai.openai;

final ai:McpToolKit fhirToolkit = check new (fhirMcpUrl);
final ai:ModelProvider openAiProvider = check new openai:ModelProvider(openAiApiKey, openai:GPT_4_1_NANO);

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
    model = openAiProvider,
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

        RiskAssessmentResponse|error response = assessment.cloneWithType();
        if response is error {
            return <http:InternalServerError>{body: {message: "agent JSON did not match expected shape: " + response.message()}};
        }
        return response;
    }
}
