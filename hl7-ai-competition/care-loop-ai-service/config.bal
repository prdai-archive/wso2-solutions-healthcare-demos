configurable string fhirMcpUrl = "http://localhost:8001/mcp/";
configurable string fhirMcpAuthToken = "";
configurable string knowledgeMcpUrl = "http://localhost:8006/mcp";
configurable string pubmedMcpUrl = "http://localhost:8007/mcp";
configurable int listenPort = 8003;

# modelProvider: "openai" or "anthropic". Both route only through the AMP AI gateway via one OpenAI-shaped client; there is no direct-to-provider mode. Set nanoModel/fullModel to the chosen provider's model ids (gpt-* for openai, claude-* for anthropic).
configurable string modelProvider = "openai";

# openAiApiKey is the minted careloop-openai gateway key; openAiServiceUrl is the gateway route, never api.openai.com.
configurable string openAiApiKey = "";
configurable string openAiServiceUrl = "http://amp:22893/careloop-openai";
configurable string nanoModel = "gpt-4.1-nano";
configurable string fullModel = "gpt-4.1";

# anthropicApiKey is the minted careloop-anthropic gateway key; anthropicServiceUrl is the gateway route, never api.anthropic.com. AMP registers careloop-anthropic under the OpenAI-compatible template against Anthropic's OpenAI-compatible endpoint, so the same OpenAI chat-completions client reaches Claude.
configurable string anthropicApiKey = "";
configurable string anthropicServiceUrl = "http://amp:22893/careloop-anthropic";

configurable string dashboardEventsUrl = "http://localhost:3003";
