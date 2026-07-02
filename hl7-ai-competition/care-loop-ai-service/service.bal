import ballerina/ai;
import ballerina/http;
import ballerina/lang.value;
import ballerina/time;

final ai:McpToolKit fhirToolkit = check new (fhirMcpUrl);
final GeminiModelProvider geminiProvider = check new (geminiApiKey, geminiModel);

final ai:Agent questionnaireAgent = check new (
    systemPrompt = {
        role: "Care Loop clinical assistant",
        instructions: string `You draft FHIR Questionnaire resources (no answers filled in) for a
            heart failure clinic's remote monitoring program. Given a patient id and a date
            cutoff, use the "search" tool (type="Observation", searchParam={"patient": <id>,
            "date": ["ge<cutoff>"]}) to fetch that patient's recent vitals, then respond with
            ONLY the FHIR Questionnaire JSON - resourceType, status ("active"), title, and item
            (4 to 6 short plain-language symptom questions targeted at the vitals trend, each
            with linkId, text, and type of "boolean", "decimal", or "string"). No markdown
            fences, no other prose, no answers or QuestionnaireResponse.`
    },
    model = geminiProvider,
    tools = [fhirToolkit],
    verbose = true
);

service /questionnaires on new http:Listener(listenPort) {

    resource function post .(QuestionnaireRequest request) returns QuestionnaireResponse|http:InternalServerError {
        string cutoff = sinceDate(request.lookbackDays);
        string query = string `Patient id: ${request.patientId}. Date cutoff: ${cutoff}.`;

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

isolated function sinceDate(int lookbackDays) returns string {
    time:Utc since = time:utcAddSeconds(time:utcNow(), -1d * lookbackDays * 24 * 60 * 60);
    return time:utcToString(since).substring(0, 10);
}
