import ballerina/ai;
import ballerina/http;
import ballerina/lang.value;
import ballerinax/ai.openai;
import ballerinax/jaeger as _;

listener http:Listener agentListener = new (listenPort);

service /questionnaires on agentListener {

    private final ai:Agent questionnaireAgent;

    function init() returns error? {
        ai:McpToolKit fhirToolkit = check createFhirToolkit();
        ai:ModelProvider modelProvider = check createModelProvider(openai:GPT_4_1_NANO);
        self.questionnaireAgent = check createAgent(
                "Care Loop clinical assistant", questionnaireSystemPrompt, modelProvider, fhirToolkit);
    }

    resource function post .(QuestionnaireRequest request) returns QuestionnaireResponse|http:InternalServerError {
        string query = string `Patient id: ${request.patientId}.`;

        string|ai:Error result = self.questionnaireAgent.run(query);
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
