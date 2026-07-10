import ballerina/ai;
import ballerina/http;
import ballerina/lang.value;
import ballerinax/ai.openai;
import ballerinax/jaeger as _;

listener http:Listener agentListener = new (listenPort);

service /risk\-assessment on agentListener {

    private final ai:Agent riskAssessmentAgent;

    function init() returns error? {
        ai:McpToolKit fhirToolkit = check createFhirToolkit();
        ai:ModelProvider modelProvider = check createModelProvider(openai:GPT_4_1);
        self.riskAssessmentAgent = check createAgent(
                "Care Loop clinical assistant", riskAssessmentSystemPrompt, modelProvider, fhirToolkit);
    }

    resource function post .(RiskAssessmentRequest request) returns RiskAssessmentResponse|http:InternalServerError {
        string query = string `Patient id: ${request.patientId}. ML probability of a cardiac event: ${
            request.mlProbability}. Questionnaire answers: ${request.answers.toJsonString()}.`;

        string|ai:Error result = self.riskAssessmentAgent.run(query);
        if result is ai:Error {
            return <http:InternalServerError>{body: {message: "agent run failed: " + result.message()}};
        }

        json|error assessmentJson = value:fromJsonString(result);
        if assessmentJson is error {
            return <http:InternalServerError>{body: {message: "agent did not return valid JSON: " + assessmentJson.message()}};
        }

        RiskAssessmentResponse|error assessment = assessmentJson.cloneWithType();
        if assessment is error {
            return <http:InternalServerError>{body: {message: "agent JSON did not match expected shape: " + assessment.message()}};
        }
        return assessment;
    }
}
