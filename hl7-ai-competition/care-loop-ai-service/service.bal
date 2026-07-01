import ballerina/http;
import ballerinax/amp as _;

service /questionnaires on new http:Listener(listenPort) {

    # Generates a FHIR Questionnaire (no answers) from a patient's recent vitals,
    # by pulling Observations via fhir-mcp-server and asking Gemini to draft the questions.
    #
    # + request - the patient to draft a questionnaire for
    # + return - the drafted FHIR Questionnaire, or an error if vitals lookup or drafting failed
    resource function post .(QuestionnaireRequest request) returns QuestionnaireResponse|http:InternalServerError {
        VitalSummary[]|error vitals = fetchRecentVitals(request.patientId, request.lookbackDays);
        if vitals is error {
            return <http:InternalServerError>{body: {message: "failed to fetch vitals: " + vitals.message()}};
        }
        json|error questionnaire = draftQuestionnaire(request.patientId, vitals);
        if questionnaire is error {
            return <http:InternalServerError>{body: {message: "failed to draft questionnaire: " + questionnaire.message()}};
        }
        return {questionnaire};
    }
}
