configurable string fhirMcpUrl = "http://localhost:8001/mcp/";
configurable string fhirMcpAuthToken = "";
configurable string knowledgeMcpUrl = "http://localhost:8006/mcp";
configurable string pubmedMcpUrl = "http://localhost:8007/mcp";
configurable int listenPort = 8003;

# Choose "openai" (routed through the AMP gateway via AmpModelProvider) or "anthropic" (direct).
configurable string modelProvider = "openai";

configurable string openAiApiKey = "";
configurable string openAiServiceUrl = "https://api.openai.com/v1";
configurable string nanoModel = "gpt-4.1-nano";
configurable string fullModel = "gpt-4.1";

configurable string anthropicApiKey = "";
configurable string anthropicServiceUrl = "https://api.anthropic.com/v1";

configurable string dashboardEventsUrl = "http://localhost:3003";
