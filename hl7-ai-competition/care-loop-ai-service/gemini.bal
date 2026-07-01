import ballerina/http;
import ballerina/lang.value;

final http:Client geminiClient = check new ("https://generativelanguage.googleapis.com");

const string QUESTIONNAIRE_SCHEMA_HINT = string `
Return a FHIR R4 Questionnaire resource as JSON. Populate resourceType, status
("active"), title, and item (an array of QuestionnaireItem, each with linkId,
text, and type - use "choice", "boolean", "decimal", or "string" as
appropriate). Do NOT include any answers, QuestionnaireResponse, or values -
only the questions themselves. Ask 4 to 6 short, plain-language symptom
questions targeted at the vitals trend described below, the kind a heart
failure clinic would want a patient to answer during a symptom check-in.`;

# Asks Gemini to draft a FHIR Questionnaire (no answers) from a patient's recent vitals trend.
#
# + patientId - FHIR Patient id, included in the prompt for context only
# + vitals - the patient's recent vitals, summarized per observation code
# + return - the drafted FHIR Questionnaire resource as JSON, or an error
public isolated function draftQuestionnaire(string patientId, VitalSummary[] vitals) returns json|error {
    string prompt = buildPrompt(patientId, vitals);

    json requestBody = {
        contents: [
            {role: "user", parts: [{text: prompt}]}
        ],
        generationConfig: {responseMimeType: "application/json"}
    };

    json response = check geminiClient->post(
        string `/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
        requestBody
    );

    json[] candidates = check response.candidates.ensureType();
    if candidates.length() == 0 {
        return error("Gemini returned no candidates");
    }
    json[] parts = check candidates[0].content.parts.ensureType();
    string text = check parts[0].text.ensureType();
    return check parseJsonString(text);
}

isolated function buildPrompt(string patientId, VitalSummary[] vitals) returns string {
    string vitalsText = "";
    foreach VitalSummary v in vitals {
        vitalsText += string `- ${v.display} (${v.code}): ${v.values.toString()} ${v.unit}` + "\n";
    }
    if vitalsText == "" {
        vitalsText = "No recent vitals were found for this patient.\n";
    }
    return string `Patient ${patientId}'s vitals over the last few days:
${vitalsText}
${QUESTIONNAIRE_SCHEMA_HINT}`;
}

isolated function parseJsonString(string text) returns json|error {
    return value:fromJsonString(text);
}
