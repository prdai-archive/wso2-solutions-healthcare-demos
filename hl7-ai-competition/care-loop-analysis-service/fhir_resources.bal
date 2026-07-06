import ballerinax/health.fhir.r4;
import ballerinax/health.fhir.r4.international401;

isolated function buildMlOnlyRiskAssessment(string patientId, string[] observationRefs, HeartRiskResponse heartRisk) returns international401:RiskAssessment {
    r4:Reference[] basis = observationRefs.map(ref => <r4:Reference>{reference: ref});
    return {
        status: international401:CODE_STATUS_FINAL,
        subject: {reference: "Patient/" + patientId},
        basis,
        method: {text: "care-loop-heart-risk-service (" + heartRisk.selected_model + ")"},
        prediction: [{probabilityDecimal: <decimal>heartRisk.probability}]
    };
}

# One RiskAssessment representing both independent probabilities per the explicit "written every case"
# decision - two prediction entries (ML, agentic) rather than picking one, since neither supersedes
# the other and RiskAssessment.prediction is already an array.
#
# + patientId - the FHIR Patient id this assessment is for
# + observationRefs - "Observation/{id}" references for the vitals the ML probability was based on
# + mlProbability - care-loop-heart-risk-service's probability
# + agentic - care-loop-ai-service's own probability/risk assessment
# + return - the combined RiskAssessment, unsaved
isolated function buildCombinedRiskAssessment(string patientId, string[] observationRefs, float mlProbability, AiRiskAssessmentResponse agentic) returns international401:RiskAssessment {
    r4:Reference[] basis = observationRefs.map(ref => <r4:Reference>{reference: ref});
    return {
        status: international401:CODE_STATUS_FINAL,
        subject: {reference: "Patient/" + patientId},
        basis,
        method: {text: "care-loop-heart-risk-service ML probability + care-loop-ai-service agentic assessment"},
        prediction: [
            {probabilityDecimal: <decimal>mlProbability, rationale: "care-loop-heart-risk-service ML probability"},
            {probabilityDecimal: <decimal>agentic.probability, rationale: "care-loop-ai-service agentic assessment, risk=" + agentic.risk}
        ]
    };
}

isolated function buildEscalationTask(string patientId, float mlProbability, AiRiskAssessmentResponse agentic) returns international401:Task {
    string description = string `Care Loop escalation for Patient/${patientId}: ML probability ${mlProbability}, agentic probability ${agentic.probability} (risk=${agentic.risk}). Both escalation thresholds cleared.`;
    return {
        status: international401:CODE_STATUS_REQUESTED,
        intent: international401:CODE_INTENT_ORDER,
        'for: {reference: "Patient/" + patientId},
        description
    };
}

isolated function buildTimeoutEscalationTask(string patientId, float mlProbability) returns international401:Task {
    string description = string `Care Loop escalation for Patient/${patientId}: questionnaire timed out with no patient response. Fail-safe escalation on ML probability ${mlProbability} alone (no agentic probability available).`;
    return {
        status: international401:CODE_STATUS_REQUESTED,
        intent: international401:CODE_INTENT_ORDER,
        'for: {reference: "Patient/" + patientId},
        description
    };
}
