import ballerina/ai;
import ballerina/http;
import ballerina/jballerina.java;
import ballerinax/ai.openai;
import ballerinax/openai.chat;

const int DEFAULT_MAX_TOKEN_COUNT = 512;
const decimal DEFAULT_TEMPERATURE = 0.7;

# OpenAI-compatible model provider for the WSO2 Agent Manager egress AI
# gateway, which authenticates with an `API-Key` header instead of the
# `Authorization: Bearer` header the stock `ballerinax/ai.openai` provider
# sends. `chat` (the method agents use, including tool calling) goes through
# the gateway with the `API-Key` header.
public isolated distinct client class AmpModelProvider {
    *ai:ModelProvider;
    // The borrowed native `generate` implementation reads these two fields, so
    // their names and types must match the ballerinax/ai.openai provider.
    private final chat:Client llmClient;
    private final openai:OPEN_AI_MODEL_NAMES modelType;
    private final http:Client gatewayClient;
    private final string apiKey;
    private final decimal temperature;
    private final int maxTokens;

    public isolated function init(string apiKey, openai:OPEN_AI_MODEL_NAMES modelType,
            string serviceUrl = "https://api.openai.com/v1", int maxTokens = DEFAULT_MAX_TOKEN_COUNT,
            decimal temperature = DEFAULT_TEMPERATURE) returns ai:Error? {
        http:Client|error gatewayClient = new (serviceUrl);
        if gatewayClient is error {
            return error ai:Error("Failed to initialize AmpModelProvider", gatewayClient);
        }
        // Only `generate` uses this Bearer-authenticated client; the gateway does not accept it.
        chat:Client|error llmClient = new ({auth: {token: apiKey}}, serviceUrl);
        if llmClient is error {
            return error ai:Error("Failed to initialize AmpModelProvider", llmClient);
        }
        self.gatewayClient = gatewayClient;
        self.llmClient = llmClient;
        self.modelType = modelType;
        self.apiKey = apiKey;
        self.temperature = temperature;
        self.maxTokens = maxTokens;
    }

    # Sends a chat request to the model through the AMP gateway.
    #
    # + messages - List of chat messages or a single user message
    # + tools - Tool definitions to be used for the tool call
    # + stop - Stop sequence to stop the completion
    # + return - Chat response or an error in case of failures
    isolated remote function chat(ai:ChatMessage[]|ai:ChatUserMessage messages, ai:ChatCompletionFunctions[] tools = [],
            string? stop = ()) returns ai:ChatAssistantMessage|ai:Error {
        chat:CreateChatCompletionRequest request = {
            max_completion_tokens: self.maxTokens,
            temperature: self.temperature,
            stop,
            model: self.modelType,
            messages: check mapToCompletionRequestMessages(messages)
        };
        if tools.length() > 0 {
            request.functions = tools;
        }
        chat:CreateChatCompletionResponse|error response =
            self.gatewayClient->post("/chat/completions", request.toJson(), {"API-Key": self.apiKey});
        if response is error {
            return error ai:LlmConnectionError("Error while connecting to the model", response);
        }
        chat:CreateChatCompletionResponse_choices[] choices = response.choices;
        if choices.length() == 0 {
            return error ai:LlmInvalidResponseError("Empty response from the model when using function call API");
        }
        return mapToAssistantMessage(choices[0].message);
    }

    # Sends a chat request to the model and generates a value that belongs to the type
    # corresponding to the type descriptor argument.
    #
    # + prompt - The prompt to use in the chat messages
    # + td - Type descriptor specifying the expected return type format
    # + return - Generates a value that belongs to the type, or an error if generation fails
    isolated remote function generate(ai:Prompt prompt, typedesc<anydata> td = <>) returns td|ai:Error = @java:Method {
        'class: "io.ballerina.lib.ai.openai.Generator"
    } external;
}

isolated function mapToCompletionRequestMessages(ai:ChatMessage[]|ai:ChatUserMessage messages)
        returns chat:ChatCompletionRequestMessage[]|ai:Error {
    if messages is ai:ChatUserMessage {
        return [{role: ai:USER, content: check mapToStringContent(messages.content)}];
    }
    chat:ChatCompletionRequestMessage[] requestMessages = [];
    foreach ai:ChatMessage message in messages {
        if message is ai:ChatAssistantMessage {
            requestMessages.push(mapToRequestAssistantMessage(message));
        } else if message is ai:ChatUserMessage {
            requestMessages.push({role: ai:USER, content: check mapToStringContent(message.content)});
        } else if message is ai:ChatSystemMessage {
            requestMessages.push({role: ai:SYSTEM, content: check mapToStringContent(message.content)});
        } else if message is ai:ChatFunctionMessage {
            requestMessages.push({role: "function", content: message.content, name: message.name});
        }
    }
    return requestMessages;
}

isolated function mapToRequestAssistantMessage(ai:ChatAssistantMessage message)
        returns chat:ChatCompletionRequestAssistantMessage {
    chat:ChatCompletionRequestAssistantMessage assistantMessage = {role: ai:ASSISTANT};
    ai:FunctionCall[]? toolCalls = message.toolCalls;
    if toolCalls is ai:FunctionCall[] && toolCalls.length() > 0 {
        assistantMessage.function_call = {
            name: toolCalls[0].name,
            arguments: toolCalls[0].arguments.toJsonString()
        };
    }
    string? content = message?.content;
    if content is string {
        assistantMessage.content = content;
    }
    return assistantMessage;
}

isolated function mapToAssistantMessage(chat:ChatCompletionResponseMessage? message)
        returns ai:ChatAssistantMessage|ai:LlmError {
    ai:ChatAssistantMessage assistantMessage = {role: ai:ASSISTANT, content: message?.content};
    chat:ChatCompletionRequestAssistantMessage_function_call? functionCall = message?.function_call;
    if functionCall is () {
        return assistantMessage;
    }
    do {
        json arguments = check functionCall.arguments.fromJsonString();
        assistantMessage.toolCalls = [{name: functionCall.name, arguments: check arguments.cloneWithType()}];
    } on fail error e {
        return error ai:LlmError("Invalid or malformed arguments received in function call response.", e);
    }
    return assistantMessage;
}

isolated function mapToStringContent(ai:Prompt|string prompt) returns string|ai:Error {
    if prompt is string {
        return prompt;
    }
    string[] & readonly strings = prompt.strings;
    anydata[] insertions = prompt.insertions;
    string promptStr = strings[0];
    foreach int i in 0 ..< insertions.length() {
        string str = strings[i + 1];
        anydata insertion = insertions[i];
        if insertion is ai:TextDocument|ai:TextChunk {
            promptStr += insertion.content + " " + str;
            continue;
        }
        if insertion is ai:TextDocument[] {
            foreach ai:TextDocument doc in insertion {
                promptStr += doc.content + " ";
            }
            promptStr += str;
            continue;
        }
        if insertion is ai:Document {
            return error ai:Error("Only text documents are currently supported.");
        }
        promptStr += insertion.toString() + str;
    }
    return promptStr.trim();
}
