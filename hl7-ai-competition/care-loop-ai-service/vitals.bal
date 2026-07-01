import ballerina/lang.value;
import ballerina/mcp;
import ballerina/time;

# Pulls a patient's Observations from the last `lookbackDays` via the fhir-mcp-server
# MCP tools and folds them into one summary per observation code, since the LLM
# prompt only needs the value trend, not the raw FHIR resources.
#
# + patientId - the FHIR Patient id to fetch Observations for
# + lookbackDays - how many days back to search for Observations
# + return - one VitalSummary per distinct observation code, or an error
public isolated function fetchRecentVitals(string patientId, int lookbackDays) returns VitalSummary[]|error {
    mcp:StreamableHttpClient mcpClient = check new (fhirMcpUrl);
    check mcpClient->initialize({name: "care-loop-ai-service", version: "0.1.0"});

    time:Utc since = time:utcAddSeconds(time:utcNow(), -1d * lookbackDays * 24 * 60 * 60);
    string sinceDate = time:utcToString(since).substring(0, 10);

    mcp:CallToolResult result = check mcpClient->callTool({
        name: "search",
        arguments: {
            "type": "Observation",
            "searchParam": {"patient": patientId, "date": ["ge" + sinceDate]}
        }
    });
    VitalSummary[]|error summary = summarize(result);
    check mcpClient->close();
    return summary;
}

isolated function summarize(mcp:CallToolResult result) returns VitalSummary[]|error {
    map<VitalSummary> byCode = {};
    foreach mcp:TextContent|mcp:ImageContent|mcp:AudioContent|mcp:EmbeddedResource item in result.content {
        if item is mcp:TextContent {
            json observations = check value:fromJsonString(item.text);
            if observations is json[] {
                foreach json observation in observations {
                    check foldObservation(observation, byCode);
                }
            }
        }
    }
    return byCode.toArray();
}

isolated function foldObservation(json observation, map<VitalSummary> byCode) returns error? {
    json codingField = check observation.code.coding;
    if codingField !is json[] || codingField.length() == 0 {
        return;
    }
    json coding = codingField[0];
    string code = (check coding.code).toString();
    string display = (check coding.display).toString();

    decimal? value = ();
    string unit = "";
    json|error valueQuantity = observation.valueQuantity;
    if valueQuantity is json && valueQuantity != () {
        value = check value:ensureType(check valueQuantity.value, decimal);
        unit = (check valueQuantity.unit).toString();
    }
    if value is () {
        return;
    }

    VitalSummary? existing = byCode[code];
    if existing is () {
        byCode[code] = {code, display, unit, values: [value]};
    } else {
        existing.values.push(value);
    }
}
