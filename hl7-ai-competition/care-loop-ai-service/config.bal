configurable string fhirMcpUrl = "http://localhost:8001/mcp/";
configurable string fhirMcpAuthToken = "";
configurable string knowledgeMcpUrl = "http://localhost:8006/mcp";
configurable string pubmedMcpUrl = "http://localhost:8007/mcp";
configurable int listenPort = 8003;

# modelProvider: "openai" or "anthropic". Both route only through the AMP AI gateway; there is no direct-to-provider mode.
configurable string modelProvider = "openai";

# openAiApiKey is the minted careloop-openai gateway key; openAiServiceUrl is the gateway invoke URL, never api.openai.com.
configurable string openAiApiKey = "";
configurable string openAiServiceUrl = "http://amp:22893/careloop-openai";
configurable string nanoModel = "gpt-4.1-nano";
configurable string fullModel = "gpt-4.1";

# anthropicApiKey is the minted careloop-anthropic gateway key; anthropicServiceUrl is the gateway invoke URL (with the /v1 suffix, since the stock provider appends /messages), never api.anthropic.com.
configurable string anthropicApiKey = "";
configurable string anthropicServiceUrl = "http://amp:22893/careloop-anthropic/v1";

configurable string dashboardEventsUrl = "http://localhost:3003";
