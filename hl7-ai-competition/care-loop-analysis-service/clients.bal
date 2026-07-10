import ballerina/http;
import ballerina/log;
import ballerinax/health.clients.fhir;

// Capability-statement validation races our own startup - disabled, as in care-loop-collector-service/clients.bal.
final fhir:FHIRConnector fhirConnector = check new ({baseURL: fhirServerUrl}, enableCapabilityStatementValidation = false);
final fhir:FHIRConnector ehrFhirConnector = check new ({baseURL: ehrFhirServerUrl}, enableCapabilityStatementValidation = false);

// uvicorn (like Bun in care-loop-collector-service/clients.bal) doesn't answer the default HTTP_2_0 h2c upgrade probe; pinning HTTP_1_1 avoids it.
final http:Client heartRiskClient = check new (heartRiskServiceUrl, httpVersion = http:HTTP_1_1);
final http:Client aiClient = check new (aiServiceUrl);
final http:Client collectorClient = check new (collectorServiceUrl);
final http:Client dashboardEventsClient = check new (dashboardEventsUrl, httpVersion = http:HTTP_1_1);

// Fire-and-forget: the ops dashboard is a nice-to-have live feed, never a reason to slow down or fail real pipeline work.
isolated function notifyDashboard(string patientId, string label, string? detail = ()) {
    http:Response|http:ClientError result = dashboardEventsClient->post("/api/events", {patientId, label, detail});
    if result is http:ClientError {
        log:printWarn("failed to notify dashboard", patientId = patientId, label = label, 'error = result);
    }
}
