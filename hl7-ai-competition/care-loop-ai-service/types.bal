# + patientId - FHIR Patient id to draft a questionnaire for
public type QuestionnaireRequest record {|
    string patientId;
|};

# + questionnaire - the drafted FHIR Questionnaire resource, with no answers filled in
public type QuestionnaireResponse record {|
    json questionnaire;
|};

# + question - the questionnaire item's text
# + answer - the patient's reply to that question
public type QuestionAnswer record {|
    string question;
    string answer;
|};

# + patientId - FHIR Patient id to assess
# + mlProbability - probability of a cardiac event from care-loop-heart-risk-service
# + answers - the patient's questionnaire answers
public type RiskAssessmentRequest record {|
    string patientId;
    float mlProbability;
    QuestionAnswer[] answers;
|};

# + probability - the agent's own assessed probability of a cardiac event, 0-1
# + risk - the agent's own assessed risk level
# + reasoning - plain-language explanation citing the vitals trend, the ML probability, and the answers
# + referencedResources - "Observation/{id}"-style references the agent actually saw in a tool result;
# never a guess - empty if it isn't sure of any real id
public type RiskAssessmentResponse record {|
    float probability;
    "low"|"moderate"|"high" risk;
    string reasoning;
    string[] referencedResources;
|};
