import ballerina/ai;
import ballerina/http;
import ballerina/jballerina.java;
import ballerina/lang.regexp;
import ballerina/lang.runtime;
import ballerina/lang.value;
import ballerina/log;

const int MAX_RETRIES = 3;
const decimal DEFAULT_RETRY_DELAY = 2;

# A minimal `ai:ModelProvider` for Gemini's `generateContent` REST API - no official one ships for Ballerina.
public isolated distinct client class GeminiModelProvider {
    *ai:ModelProvider;

    private final http:Client geminiClient;
    private final string model;
    private final string apiKey;

    public isolated function init(string apiKey, string model, string serviceUrl = "https://generativelanguage.googleapis.com") returns ai:Error? {
        http:Client|error geminiClient = new (serviceUrl);
        if geminiClient is error {
            return error ai:LlmConnectionError("failed to initialize Gemini client", geminiClient);
        }
        self.geminiClient = geminiClient;
        self.model = model;
        self.apiKey = apiKey;
    }

    isolated remote function chat(ai:ChatMessage[]|ai:ChatUserMessage messages, ai:ChatCompletionFunctions[] tools = [],
            string? stop = ()) returns ai:ChatAssistantMessage|ai:Error {
        ai:ChatMessage[] messageList = messages is ai:ChatMessage[] ? messages : [messages];
        json[] contents = [];
        string? systemInstruction = ();
        foreach ai:ChatMessage message in messageList {
            if message is ai:ChatSystemMessage {
                string|error text = asPlainText(message.content);
                if text is string {
                    systemInstruction = text;
                }
                continue;
            }
            json|error content = toGeminiContent(message);
            if content is error {
                return error ai:LlmInvalidGenerationError("failed to convert chat message for Gemini", content);
            }
            contents.push(content);
        }

        map<json> requestBody = {contents};
        if stop is string {
            requestBody["generationConfig"] = {stopSequences: [stop]};
        }
        if systemInstruction is string {
            requestBody["systemInstruction"] = {parts: [{text: systemInstruction}]};
        }
        if tools.length() > 0 {
            requestBody["tools"] = [{functionDeclarations: toFunctionDeclarations(tools)}];
        }

        json|ai:Error response = self.postWithRetry(requestBody);
        if response is ai:Error {
            return response;
        }
        return toAssistantMessage(response);
    }

    private isolated function postWithRetry(json requestBody) returns json|ai:Error {
        foreach int attempt in 0 ..< MAX_RETRIES {
            json|error response = self.geminiClient->post(
                string `/v1beta/models/${self.model}:generateContent?key=${self.apiKey}`, requestBody);
            if response !is error {
                return response;
            }
            decimal? retryDelay = retryableDelay(response);
            if retryDelay is () || attempt == MAX_RETRIES - 1 {
                return error ai:LlmConnectionError("failed to call Gemini", response);
            }
            log:printWarn("Gemini call failed, retrying", attempt = attempt, retryDelay = retryDelay, 'error = response);
            runtime:sleep(retryDelay);
        }
        return error ai:LlmConnectionError("failed to call Gemini: retries exhausted");
    }

    // Unused by ai:Agent; dependently-typed generate() must be external in Ballerina, so this binds to the stub in libs/.
    isolated remote function generate(ai:Prompt prompt, typedesc<anydata> td = <>) returns td|ai:Error = @java:Method {
        'class: "care_loop.care_loop_ai_service.GeminiGenerateStub"
    } external;
}

// Retryable Gemini errors are 429 (rate limit) and 5xx; other errors (bad request, auth) are not.
isolated function retryableDelay(error err) returns decimal? {
    value:Cloneable statusCode = err.detail()["statusCode"];
    if statusCode !is int || (statusCode != 429 && statusCode < 500) {
        return ();
    }
    value:Cloneable body = err.detail()["body"];
    if body !is anydata {
        return DEFAULT_RETRY_DELAY;
    }
    return retryDelaySeconds(body) ?: DEFAULT_RETRY_DELAY;
}

// Gemini's 429/503 bodies include a RetryInfo detail like {"retryDelay": "20s"}.
isolated function retryDelaySeconds(anydata body) returns decimal? {
    json|error errorBody = body.cloneWithType();
    if errorBody is error {
        return ();
    }
    json[]|error details = errorBody.'error.details.ensureType();
    if details is error {
        return ();
    }
    foreach json detail in details {
        string|error retryDelay = detail.retryDelay.ensureType();
        if retryDelay is string {
            string digits = regexp:replaceAll(re `[^0-9.]`, retryDelay, "");
            decimal|error seconds = decimal:fromString(digits);
            if seconds is decimal {
                return seconds;
            }
        }
    }
    return ();
}

isolated function toGeminiContent(ai:ChatMessage message) returns json|error {
    if message is ai:ChatUserMessage {
        return {role: "user", parts: [{text: check asPlainText(message.content)}]};
    }
    if message is ai:ChatFunctionMessage {
        return {
            role: "function",
            parts: [{functionResponse: {name: message.name, response: {content: message.content}}}]
        };
    }
    if message is ai:ChatAssistantMessage {
        ai:FunctionCall[] toolCalls = message.toolCalls ?: [];
        if toolCalls.length() > 0 {
            json[] parts = from ai:FunctionCall toolCall in toolCalls
                select {functionCall: {name: toolCall.name, args: toolCall.arguments ?: {}}};
            return {role: "model", parts};
        }
        return {role: "model", parts: [{text: message.content ?: ""}]};
    }
    return error("system messages are not sent as chat content, handled separately");
}

isolated function asPlainText(string|ai:Prompt content) returns string|error {
    if content is string {
        return content;
    }
    return string:'join("", ...content.strings);
}

isolated function toFunctionDeclarations(ai:ChatCompletionFunctions[] tools) returns json[] {
    return from ai:ChatCompletionFunctions tool in tools
        select {name: tool.name, description: tool.description, parameters: sanitizeSchema(tool.parameters ?: {})};
}

// Gemini's function-declaration schema rejects JSON Schema keywords fhir-mcp-server's tool schemas include.
isolated function sanitizeSchema(json schema) returns json {
    if schema is map<json> {
        map<json> cleaned = {};
        foreach [string, json] [key, value] in schema.entries() {
            if key == "examples" || key == "additionalProperties" || key == "$schema" {
                continue;
            }
            cleaned[key] = sanitizeSchema(value);
        }
        return cleaned;
    }
    if schema is json[] {
        return from json item in schema
            select sanitizeSchema(item);
    }
    return schema;
}

isolated function toAssistantMessage(json response) returns ai:ChatAssistantMessage|ai:Error {
    json[]|error candidates = response.candidates.ensureType();
    if candidates is error || candidates.length() == 0 {
        return error ai:LlmInvalidResponseError("Gemini returned no candidates");
    }
    json[]|error parts = candidates[0].content.parts.ensureType();
    if parts is error {
        return error ai:LlmInvalidResponseError("Gemini response missing content parts", parts);
    }

    ai:FunctionCall[] toolCalls = [];
    string? text = ();
    foreach json part in parts {
        json|error functionCall = part.functionCall;
        if functionCall is json && functionCall != () {
            string|error name = functionCall.name.ensureType();
            map<json>|error args = functionCall.args.ensureType();
            if name is string {
                toolCalls.push({name, arguments: args is map<json> ? args : {}});
            }
            continue;
        }
        json|error textPart = part.text;
        if textPart is string {
            text = textPart;
        }
    }

    if toolCalls.length() > 0 {
        return {role: ai:ASSISTANT, content: text, toolCalls};
    }
    return {role: ai:ASSISTANT, content: text ?: ""};
}
