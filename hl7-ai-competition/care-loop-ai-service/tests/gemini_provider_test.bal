import ballerina/ai;
import ballerina/test;

@test:Config {}
function testRetryableDelayParsesRetryInfo() {
    error err = error("Too Many Requests", statusCode = 429, body = {
        'error: {
            details: [
                {"@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "20s"}
            ]
        }
    });
    test:assertEquals(retryableDelay(err), <decimal>20);
}

@test:Config {}
function testRetryableDelayFallsBackToDefault() {
    error err = error("Too Many Requests", statusCode = 429, body = {'error: {details: []}});
    test:assertEquals(retryableDelay(err), DEFAULT_RETRY_DELAY);
}

@test:Config {}
function testRetryableDelayNilForNonRetryableStatus() {
    error err = error("Bad Request", statusCode = 400, body = {});
    test:assertEquals(retryableDelay(err), ());
}

@test:Config {}
function testToGeminiContentUserMessage() returns error? {
    json content = check toGeminiContent({role: ai:USER, content: "hello"});
    test:assertEquals(content, {role: "user", parts: [{text: "hello"}]});
}

@test:Config {}
function testToGeminiContentFunctionResult() returns error? {
    json content = check toGeminiContent({role: "function", name: "search", content: "[]"});
    test:assertEquals(content, {
                                   role: "function",
                                   parts: [{functionResponse: {name: "search", response: {content: "[]"}}}]
                               });
}

@test:Config {}
function testToGeminiContentAssistantToolCall() returns error? {
    ai:ChatAssistantMessage message = {
        role: ai:ASSISTANT,
        content: (),
        toolCalls: [{name: "search", arguments: {"type": "Observation"}}]
    };
    json content = check toGeminiContent(message);
    test:assertEquals(content, {
                                   role: "model",
                                   parts: [{functionCall: {name: "search", args: {"type": "Observation"}}}]
                               });
}

@test:Config {}
function testToAssistantMessageParsesFunctionCall() returns error? {
    json response = {
        candidates: [
            {content: {parts: [{functionCall: {name: "search", args: {"patient": "1"}}}]}}
        ]
    };
    ai:ChatAssistantMessage message = check toAssistantMessage(response);
    test:assertEquals(message.toolCalls, [{name: "search", arguments: {"patient": "1"}}]);
}

@test:Config {}
function testToAssistantMessageParsesText() returns error? {
    json response = {
        candidates: [
            {content: {parts: [{text: "final answer"}]}}
        ]
    };
    ai:ChatAssistantMessage message = check toAssistantMessage(response);
    test:assertEquals(message.content, "final answer");
}

@test:Config {}
function testSanitizeSchemaStripsUnsupportedKeywords() {
    json schema = {
        'type: "object",
        properties: {
            patient: {'type: "string", examples: ["123"], additionalProperties: false}
        },
        "$schema": "https://json-schema.org/draft/2020-12/schema"
    };
    json cleaned = sanitizeSchema(schema);
    test:assertEquals(cleaned, {
                                   'type: "object",
                                   properties: {
                                       patient: {'type: "string"}
                                   }
                               });
}
