import ballerinax/health.clients.fhir;
import ballerinax/health.fhir.r4.international401;

# create()'s default MINIMAL preference returns {resourceId, version}, not a full resource - fall
# back to "id" in case that ever changes. Same pattern already used in care-loop-collector-service.
isolated function extractFhirId(fhir:FHIRResponse response) returns string? {
    json|xml resourceValue = response.'resource;
    if resourceValue is xml {
        return ();
    }
    string|error resourceId = trap <string>(checkpanic resourceValue.resourceId);
    if resourceId is string {
        return resourceId;
    }
    string|error id = trap <string>(checkpanic resourceValue.id);
    return id is string ? id : ();
}

isolated function answersNarrative(QuestionAnswer[] answers) returns string {
    if answers.length() == 0 {
        return "";
    }
    string[] parts = answers.map(qa => string `"${qa.question}" -> "${qa.answer}"`);
    return "Patient-reported answers: " + string:'join(" | ", ...parts) + ".";
}

isolated function priorityForProbability(float probability) returns international401:TaskPriority {
    if probability >= 0.85 {
        return international401:CODE_PRIORITY_STAT;
    }
    if probability >= 0.65 {
        return international401:CODE_PRIORITY_URGENT;
    }
    return international401:CODE_PRIORITY_ROUTINE;
}

isolated function buildEscalationTask(string patientId, float mlProbability, AiRiskAssessmentResponse agentic,
        PatientDisplay display, QuestionAnswer[] answers, string? riskAssessmentId) returns international401:Task {
    float worstProbability = mlProbability > agentic.probability ? mlProbability : agentic.probability;

    string citations = agentic.referencedResources.length() > 0
        ? " Cited: " + string:'join(", ", ...agentic.referencedResources) + "."
        : "";

    string description = string `Patient ${display.patientName} (${display.ageSexSummary}) flagged for review.
ML risk model probability: ${mlProbability}. Agentic assessment probability: ${agentic.probability} (risk=${agentic.risk}). Both escalation thresholds cleared.
Agentic reasoning: ${agentic.reasoning}${citations}
${answersNarrative(answers)}`;

    international401:Task task = {
        status: international401:CODE_STATUS_REQUESTED,
        intent: international401:CODE_INTENT_ORDER,
        priority: priorityForProbability(worstProbability),
        'for: {reference: "Patient/" + patientId, display: display.patientName},
        description
    };
    if riskAssessmentId is string {
        task.reasonReference = {
            reference: fhirServerUrl + "/RiskAssessment/" + riskAssessmentId,
            display: "Combined ML + agentic RiskAssessment"
        };
    }
    return task;
}

isolated function buildTimeoutEscalationTask(string patientId, float mlProbability, PatientDisplay display, string? riskAssessmentId) returns international401:Task {
    string description = string `Patient ${display.patientName} (${display.ageSexSummary}) flagged for review.
Questionnaire timed out with no patient response. Fail-safe escalation on ML probability ${mlProbability} alone (no agentic probability available).`;

    international401:Task task = {
        status: international401:CODE_STATUS_REQUESTED,
        intent: international401:CODE_INTENT_ORDER,
        priority: priorityForProbability(mlProbability),
        'for: {reference: "Patient/" + patientId, display: display.patientName},
        description
    };
    if riskAssessmentId is string {
        task.reasonReference = {
            reference: fhirServerUrl + "/RiskAssessment/" + riskAssessmentId,
            display: "ML-only RiskAssessment (questionnaire timeout)"
        };
    }
    return task;
}
