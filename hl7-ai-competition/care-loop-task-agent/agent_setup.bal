import ballerina/ai;
import ballerina/http;
import ballerinax/ai.openai;

isolated function createFhirToolkit() returns ai:McpToolKit|ai:Error {
    // Empty token means the MCP server is reached directly, without gateway auth.
    http:BearerTokenConfig? mcpAuth = fhirMcpAuthToken == "" ? () : {token: fhirMcpAuthToken};
    return new (fhirMcpUrl, auth = mcpAuth);
}

isolated function createModelProvider(openai:OPEN_AI_MODEL_NAMES modelType) returns ai:ModelProvider|ai:Error {
    if useAmpGateway {
        return new AmpModelProvider(openAiApiKey, modelType, serviceUrl = openAiServiceUrl);
    }
    return new openai:ModelProvider(openAiApiKey, modelType, serviceUrl = openAiServiceUrl);
}

isolated function createAgent(string role, string instructions, ai:ModelProvider model,
        ai:McpToolKit toolkit) returns ai:Agent|ai:Error {
    return new (systemPrompt = {role, instructions}, model = model, tools = [toolkit], verbose = true);
}
