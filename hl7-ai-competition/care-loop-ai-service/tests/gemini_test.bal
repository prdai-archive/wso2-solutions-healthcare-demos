import ballerina/test;

@test:Config {}
function testBuildPromptIncludesVitalsAndSchemaHint() {
    VitalSummary[] vitals = [
        {code: "8867-4", display: "Heart rate", unit: "beats/minute", values: [72, 75, 90]}
    ];
    string prompt = buildPrompt("patient-1", vitals);
    test:assertTrue(prompt.includes("Heart rate"));
    test:assertTrue(prompt.includes("patient-1"));
    test:assertTrue(prompt.includes("Questionnaire"));
}

@test:Config {}
function testBuildPromptHandlesNoVitals() {
    string prompt = buildPrompt("patient-2", []);
    test:assertTrue(prompt.includes("No recent vitals"));
}
