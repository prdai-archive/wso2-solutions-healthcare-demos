import ballerina/ai;
import ballerina/http;
import ballerina/log;
import ballerinax/ai.openai;
import ballerinax/jaeger as _;

listener http:Listener agentListener = new (listenPort);

service /task\-description on agentListener {

    private final ai:Agent taskDescriptionAgent;

    function init() returns error? {
        ai:McpToolKit fhirToolkit = check createFhirToolkit();
        ai:ModelProvider modelProvider = check createModelProvider(openai:GPT_4_1_NANO);
        self.taskDescriptionAgent = check createAgent(
                "Care Loop clinical documentation assistant", taskDescriptionSystemPrompt, modelProvider, fhirToolkit);
    }

    resource function post .(TaskDescriptionRequest request) returns TaskDescriptionResponse|http:InternalServerError {
        RiskAssessmentResponse agentic = request.agentic;
        string query = string `Patient: ${request.display.patientName} (${request.display.ageSexSummary}).
ML probability: ${request.mlProbability}. Agentic probability: ${agentic.probability} (risk=${agentic.risk}).
Agentic reasoning: ${agentic.reasoning}
Referenced resources: ${agentic.referencedResources.toJsonString()}
Patient answers: ${request.answers.toJsonString()}`;

        string|ai:Error result = self.taskDescriptionAgent.run(query);
        if result is ai:Error {
            log:printWarn("task-description agent failed, falling back to a plain summary", 'error = result);
            return {
                description: string `Patient ${request.display.patientName} flagged for review. ML probability: ${
                    request.mlProbability}. Agentic probability: ${agentic.probability} (risk=${agentic.risk}).`
            };
        }
        return {description: result};
    }
}
