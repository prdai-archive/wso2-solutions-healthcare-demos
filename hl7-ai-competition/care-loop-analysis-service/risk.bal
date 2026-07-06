import ballerina/http;
import ballerina/lang.runtime;
import ballerina/lang.'string as strings;
import ballerina/log;
import ballerina/time;
import ballerinax/health.clients.fhir;
import ballerinax/health.fhir.r4.international401;

# Runs the whole vitals-ready cycle in the background: fetch patient, derive demographics,
# find the last hour of vitals, score against heart-risk-service, then either save a
# RiskAssessment (below threshold) or kick off the emergency questionnaire (at/above it).
isolated function runVitalsReadyCycle(string patientId) {
    fhir:FHIRResponse|fhir:FHIRError patientResponse = fhirConnector->getById("Patient", patientId);
    if patientResponse is fhir:FHIRError {
        log:printError("vitals-ready: failed to fetch patient", patientId = patientId, 'error = patientResponse);
        return;
    }
    international401:Patient|error patient = (<json>patientResponse.'resource).cloneWithType(international401:Patient);
    if patient is error {
        log:printError("vitals-ready: failed to parse patient", patientId = patientId, 'error = patient);
        return;
    }

    string? birthDate = patient.birthDate;
    if birthDate is () {
        log:printWarn("vitals-ready: skipping, patient has no birthDate", patientId = patientId);
        return;
    }
    int|error age = deriveAge(birthDate, time:utcNow());
    if age is error {
        log:printWarn("vitals-ready: skipping, unparseable birthDate", patientId = patientId, birthDate = birthDate);
        return;
    }

    "M"|"F"? sex = deriveSex(patient.gender);
    if sex is () {
        log:printWarn("vitals-ready: skipping, patient has no usable gender", patientId = patientId, gender = patient.gender);
        return;
    }

    time:Utc now = time:utcNow();
    time:Utc windowStart = time:utcAddSeconds(now, -3600);

    map<string[]> observationSearchParams = {
        "patient": [patientId],
        "code": [strings:'join(",", ...VITALS_LOINC_CODES)]
    };
    fhir:FHIRResponse|fhir:FHIRError observationsResponse = fhirConnector->search("Observation", searchParameters = observationSearchParams);
    if observationsResponse is fhir:FHIRError {
        log:printError("vitals-ready: failed to search observations", patientId = patientId, 'error = observationsResponse);
        return;
    }

    VitalReading[] readings = withinWindow(extractVitalReadings(<json>observationsResponse.'resource), windowStart, now);
    VitalReading? maxHr = maxHeartRate(readings);
    if maxHr is () {
        log:printWarn("vitals-ready: skipping, no heart-rate observations in the last hour", patientId = patientId);
        return;
    }

    HeartRiskRequest heartRiskRequest = {age: <float>age, max_hr: maxHr.value, sex};
    HeartRiskResponse|http:ClientError heartRiskResponse = heartRiskClient->post("/predict", heartRiskRequest, targetType = HeartRiskResponse);
    if heartRiskResponse is http:ClientError {
        log:printError("vitals-ready: heart-risk-service call failed", patientId = patientId, 'error = heartRiskResponse);
        return;
    }

    string[] observationRefs = readings.map(r => "Observation/" + r.id);

    if heartRiskResponse.probability < mlEscalationThreshold {
        international401:RiskAssessment riskAssessment = buildMlOnlyRiskAssessment(patientId, observationRefs, heartRiskResponse);
        fhir:FHIRResponse|fhir:FHIRError saveResult = fhirConnector->create(riskAssessment.toJson());
        if saveResult is fhir:FHIRError {
            log:printError("vitals-ready: failed to save RiskAssessment", patientId = patientId, 'error = saveResult);
        }
        return;
    }

    log:printWarn("vitals-ready: ML probability crossed escalation threshold, starting emergency questionnaire",
            patientId = patientId, probability = heartRiskResponse.probability);
    putPendingCase(patientId, {mlProbability: heartRiskResponse.probability, observationRefs});

    http:Response|http:ClientError generateResult = collectorClient->post(
            "/patients/" + patientId + "/generate",
            {emergencyContext: {mlProbability: heartRiskResponse.probability}});
    if generateResult is http:ClientError {
        log:printError("vitals-ready: failed to start emergency questionnaire", patientId = patientId, 'error = generateResult);
    }

    _ = start runTimeoutWatcher(patientId, heartRiskResponse.probability);
}

isolated function runTimeoutWatcher(string patientId, float mlProbability) {
    runtime:sleep(<decimal>questionnaireTimeoutHours * 3600);
    if !isPendingCaseStillOutstanding(patientId) {
        return;
    }
    log:printWarn("emergency questionnaire timed out with no patient response, fail-safe escalating on ML probability alone",
            patientId = patientId, mlProbability = mlProbability);
    resolvePendingCase(patientId);

    international401:Task task = buildTimeoutEscalationTask(patientId, mlProbability);
    fhir:FHIRResponse|fhir:FHIRError saveResult = ehrFhirConnector->create(task.toJson());
    if saveResult is fhir:FHIRError {
        log:printError("timeout escalation: failed to save Task to ehr-fhir-server", patientId = patientId, 'error = saveResult);
    }
}

# Runs the emergency-answers cycle: cancel the timeout watcher (via the checked-resolved-flag
# pattern), get the agent's own assessment, always save a combined RiskAssessment, and escalate
# to ehr-fhir-server only if both the ML and agentic thresholds independently clear.
isolated function runEmergencyAnswersCycle(EmergencyAnswersRequest request) returns error? {
    PendingCase? pendingCase = getPendingCase(request.patientId);
    if pendingCase is () {
        return error("no pending case for patientId: " + request.patientId);
    }
    resolvePendingCase(request.patientId);

    AiRiskAssessmentRequest aiRequest = {
        patientId: request.patientId,
        mlProbability: pendingCase.mlProbability,
        answers: request.answers
    };
    AiRiskAssessmentResponse aiResponse = check aiClient->post("/risk-assessment", aiRequest, targetType = AiRiskAssessmentResponse);

    international401:RiskAssessment riskAssessment = buildCombinedRiskAssessment(
            request.patientId, pendingCase.observationRefs, pendingCase.mlProbability, aiResponse);
    fhir:FHIRResponse|fhir:FHIRError saveResult = fhirConnector->create(riskAssessment.toJson());
    if saveResult is fhir:FHIRError {
        log:printError("emergency-answers: failed to save RiskAssessment", patientId = request.patientId, 'error = saveResult);
    }

    if pendingCase.mlProbability >= mlEscalationThreshold && aiResponse.probability >= agenticEscalationThreshold {
        international401:Task task = buildEscalationTask(request.patientId, pendingCase.mlProbability, aiResponse);
        fhir:FHIRResponse|fhir:FHIRError taskSaveResult = ehrFhirConnector->create(task.toJson());
        if taskSaveResult is fhir:FHIRError {
            return error("failed to save Task to ehr-fhir-server: " + taskSaveResult.message());
        }
    }
}
