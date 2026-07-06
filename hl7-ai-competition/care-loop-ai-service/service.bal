import ballerina/ai;
import ballerina/http;
import ballerina/lang.value;
import ballerinax/ai.openai;

final ai:McpToolKit fhirToolkit = check new (fhirMcpUrl);
final ai:ModelProvider openAiProvider = check new openai:ModelProvider(openAiApiKey, openai:GPT_4_1_NANO);

final ai:Agent questionnaireAgent = check new (
    systemPrompt = {
        role: "Care Loop clinical assistant",
        instructions: string `# Task
            Draft a FHIR Questionnaire (no answers) for a heart failure remote-monitoring
            clinic, tailored to one patient's recent vitals trend.

            # Steps
            1. Call the "search" tool exactly once: type="Observation", searchParam={"patient":
               <id>}. Do not call "get_capabilities" first - that search param is already valid.
            2. The server's date filter is unreliable: it can return observations outside the
               requested range. Fetch everything the search returns and reason over the
               timestamps yourself to find the recent trend.
            3. Draft 4-6 plain-language symptom questions a patient would understand, each
               matched to a specific vital or change you observed, as Questionnaire item text.
            4. Produce the finished Questionnaire JSON as your final response. Do not stop
               after step 1 or 2 without producing it.

            # Output format
            Your final response IS the Questionnaire JSON itself, not a message about it.
            Respond with ONLY that JSON object - no markdown fences, no prose, no explanation,
            no "Final Answer:" or similar prefix, nothing before or after it. Required shape:
            - resourceType: "Questionnaire"
            - status: "active"
            - title: string
            - item: array of 4-6 entries, each with only "text" (the question) and "type"
              ("boolean", "decimal", or "string" - pick whichever fits how the answer should be
              captured). Do not include "linkId" - that is assigned separately downstream.
            Do not include answers anywhere in the response.`
    },
    model = openAiProvider,
    tools = [fhirToolkit],
    verbose = true
);

service /questionnaires on new http:Listener(listenPort) {

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
