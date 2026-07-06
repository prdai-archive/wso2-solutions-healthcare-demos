import ballerina/http;
import ballerina/log;

service / on new http:Listener(listenPort) {

    # Acks immediately, then runs the fetch/score/escalate cycle in the background so
    # care-loop-collector-service's own POST /vitals call - which waits on this response
    # before returning to apple-healthkit-simulator - isn't held up by it.
    resource function post vitals\-ready(VitalsReadyRequest request) returns http:Accepted {
        _ = start runVitalsReadyCycle(request.patientId);
        return http:ACCEPTED;
    }

    resource function post emergency\-answers(EmergencyAnswersRequest request) returns http:Ok|http:NotFound|http:InternalServerError {
        error? result = runEmergencyAnswersCycle(request);
        if result is error {
            log:printError("emergency-answers failed", patientId = request.patientId, 'error = result);
            if result.message().startsWith("no pending case") {
                return <http:NotFound>{body: {message: result.message()}};
            }
            return <http:InternalServerError>{body: {message: result.message()}};
        }
        return http:OK;
    }
}
