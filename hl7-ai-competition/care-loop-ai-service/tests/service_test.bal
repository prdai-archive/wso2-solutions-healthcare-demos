import ballerina/test;

@test:Config {}
function testStripCodeFenceRemovesJsonFence() {
    string text = "```json\n{\"a\": 1}\n```";
    test:assertEquals(stripCodeFence(text), "{\"a\": 1}");
}

@test:Config {}
function testStripCodeFenceRemovesPlainFence() {
    string text = "```\n{\"a\": 1}\n```";
    test:assertEquals(stripCodeFence(text), "{\"a\": 1}");
}

@test:Config {}
function testStripCodeFenceLeavesUnfencedTextAlone() {
    string text = "{\"a\": 1}";
    test:assertEquals(stripCodeFence(text), "{\"a\": 1}");
}
