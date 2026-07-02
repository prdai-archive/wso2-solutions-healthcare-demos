import ballerina/ai;
import ballerina/http;
import ballerina/lang.value;
import ballerina/time;

final ai:McpToolKit fhirToolkit = check new (fhirMcpUrl);
final GeminiModelProvider geminiProvider = check new (geminiApiKey, geminiModel);

final ai:Agent questionnaireAgent = check new (
    systemPrompt = {
        role: "Care Loop clinical assistant",
        instructions: string `Draft FHIR Questionnaire resources (no answers) for a heart failure
            remote-monitoring clinic. For the given patient id, call "search" once
            (type="Observation", searchParam={"patient": <id>}) - skip "get_capabilities", this
            param is already valid; the server's date filter is unreliable, so fetch everything
            and reason over the dates in the results yourself. Reply with ONLY the Questionnaire
            JSON: resourceType, status "active", title, and 4-6 item entries (linkId, text, type
            "boolean"/"decimal"/"string") as plain-language symptom questions matched to the
            vitals trend within the given lookback window. No markdown, no prose, no answers.`
    },
    model = geminiProvider,
    tools = [fhirToolkit],
    verbose = true
);

service /questionnaires on new http:Listener(listenPort) {

    resource function post .(QuestionnaireRequest request) returns QuestionnaireResponse|http:InternalServerError {
        string cutoff = sinceDate(request.lookbackDays);
        string query = string `Patient id: ${request.patientId}. Lookback window: since ${cutoff}.`;

        string|ai:Error result = questionnaireAgent.run(query);
        if result is ai:Error {
            return <http:InternalServerError>{body: {message: "agent run failed: " + result.message()}};
        }

        json|error questionnaire = value:fromJsonString(stripCodeFence(result));
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

// Models routinely wrap JSON answers in markdown code fences despite being told not to.
isolated function stripCodeFence(string text) returns string {
    string trimmed = text.trim();
    if !trimmed.startsWith("```") {
        return trimmed;
    }
    int? firstNewline = trimmed.indexOf("\n");
    string withoutOpenFence = firstNewline is int ? trimmed.substring(firstNewline + 1) : trimmed;
    string withoutCloseFence = withoutOpenFence.endsWith("```")
        ? withoutOpenFence.substring(0, withoutOpenFence.length() - 3)
        : withoutOpenFence;
    return withoutCloseFence.trim();
}
