# A LOINC-coded vital's readings over the lookback window, summarized for the LLM prompt.
#
# + code - LOINC code (e.g. "8867-4" for heart rate)
# + display - human-readable name of the observation
# + unit - unit of measure
# + values - all readings found for this code within the lookback window, oldest first
public type VitalSummary record {|
    string code;
    string display;
    string unit;
    decimal[] values;
|};

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
