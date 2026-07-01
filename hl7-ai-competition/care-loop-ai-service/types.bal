# + patientId - FHIR Patient id to draft a questionnaire for
# + lookbackDays - how many days of vitals history to consider
public type QuestionnaireRequest record {|
    string patientId;
    int lookbackDays = 3;
|};

# + questionnaire - the drafted FHIR Questionnaire resource, with no answers filled in
public type QuestionnaireResponse record {|
    json questionnaire;
|};
