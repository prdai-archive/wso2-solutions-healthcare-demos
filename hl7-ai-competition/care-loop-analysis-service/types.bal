# + patientId - the FHIR Patient id whose vitals were just forwarded
public type VitalsReadyRequest record {|
    string patientId;
|};

# + age - age in years, 0-120
# + max_hr - maximum heart rate in bpm, 40-240
# + sex - biological sex
public type HeartRiskRequest record {|
    float age;
    float max_hr;
    "M"|"F" sex;
|};

# + probability - P(heart disease) in [0, 1]
# + prediction - 1 if probability >= threshold, else 0
# + threshold - heart-risk-service's own model-classification threshold, not analysis-service's escalation policy
# + selected_model - name of the model behind the exported ONNX graph
public type HeartRiskResponse record {|
    float probability;
    int prediction;
    float threshold;
    string selected_model;
|};

# + mlProbability - the ML escalation probability that triggered the emergency questionnaire
public type EmergencyContext record {|
    float mlProbability;
|};

# + emergencyContext - present when this generation was triggered by an ML escalation, so
#   the resulting GeneratedSession can be looked up by /transcripts later
public type GenerateRequest record {|
    EmergencyContext emergencyContext?;
|};

# + question - the question text asked
# + answer - the patient's answer
public type QuestionAnswer record {|
    string question;
    string answer;
|};

# + patientId - the FHIR Patient id the answers belong to
# + answers - flattened question/answer pairs from the emergency questionnaire transcript
public type EmergencyAnswersRequest record {|
    string patientId;
    QuestionAnswer[] answers;
|};

# + patientId - the FHIR Patient id being assessed
# + mlProbability - the heart-risk-service probability that triggered this assessment
# + answers - the patient's emergency-questionnaire answers
public type AiRiskAssessmentRequest record {|
    string patientId;
    float mlProbability;
    QuestionAnswer[] answers;
|};

# + probability - the agent's own assessed probability, 0-1
# + risk - the agent's own assessed risk level
public type AiRiskAssessmentResponse record {|
    float probability;
    "low"|"moderate"|"high" risk;
|};

# + mlProbability - the heart-risk-service probability that triggered escalation
# + observationRefs - "Observation/{id}" references for the vitals used to compute max_hr
public type PendingCase record {|
    float mlProbability;
    string[] observationRefs;
|};
