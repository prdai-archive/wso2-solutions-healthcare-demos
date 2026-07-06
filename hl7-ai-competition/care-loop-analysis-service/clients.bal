import ballerina/http;
import ballerinax/health.clients.fhir;

// Capability-statement validation would GET /metadata at construction time, racing this service's own startup against care-loop-fhir-server's / ehr-fhir-server's - disabled, matching care-loop-collector-service/clients.bal.
final fhir:FHIRConnector fhirConnector = check new ({baseURL: fhirServerUrl}, enableCapabilityStatementValidation = false);
final fhir:FHIRConnector ehrFhirConnector = check new ({baseURL: ehrFhirServerUrl}, enableCapabilityStatementValidation = false);

// heartRiskServiceUrl points at uvicorn (FastAPI), which - like Bun's server in
// care-loop-collector-service/clients.bal - doesn't answer http:Client's default HTTP_2_0
// h2c upgrade probe with a body; pinning HTTP_1_1 avoids it (verified via curl --http2 repro).
final http:Client heartRiskClient = check new (heartRiskServiceUrl, httpVersion = http:HTTP_1_1);
final http:Client aiClient = check new (aiServiceUrl);
final http:Client collectorClient = check new (collectorServiceUrl);
