import ballerina/http;
import ballerinax/health.clients.fhir;

// Capability-statement validation races our own startup - disabled, as in care-loop-collector-service/clients.bal.
final fhir:FHIRConnector fhirConnector = check new ({baseURL: fhirServerUrl}, enableCapabilityStatementValidation = false);
final fhir:FHIRConnector ehrFhirConnector = check new ({baseURL: ehrFhirServerUrl}, enableCapabilityStatementValidation = false);

// uvicorn (like Bun in care-loop-collector-service/clients.bal) doesn't answer the default HTTP_2_0 h2c upgrade probe; pinning HTTP_1_1 avoids it.
final http:Client heartRiskClient = check new (heartRiskServiceUrl, httpVersion = http:HTTP_1_1);
final http:Client riskAgentClient = check new (riskAgentUrl);
final http:Client taskAgentClient = check new (taskAgentUrl);
final http:Client collectorClient = check new (collectorServiceUrl);

// AMP-gated agents require the per-agent API key; an empty key means direct/no-auth (local dev).
isolated function agentHeaders(string apiKey) returns map<string> => apiKey == "" ? {} : {"X-API-Key": apiKey};
