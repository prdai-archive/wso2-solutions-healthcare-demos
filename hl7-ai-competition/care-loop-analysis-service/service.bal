import ballerina/http;

service / on new http:Listener(listenPort) {

    # Acks immediately, then runs the fetch/score/escalate cycle in the background so
    # care-loop-collector-service's own POST /vitals call - which waits on this response
    # before returning to apple-healthkit-simulator - isn't held up by it.
    resource function post vitals\-ready(VitalsReadyRequest request) returns http:Accepted {
        _ = start runVitalsReadyCycle(request.patientId);
        return http:ACCEPTED;
    }

    # Acks immediately once the pending case is confirmed to exist, then runs the (potentially
    # multi-tool-call, slower) agentic assessment + FHIR writes in the background - see the
    # comment on runEmergencyAnswersCycle for why.
    resource function post emergency\-answers(EmergencyAnswersRequest request) returns http:Accepted|http:NotFound {
        PendingCase? pendingCase = getPendingCase(request.patientId);
        if pendingCase is () {
            return <http:NotFound>{body: {message: "no pending case for patientId: " + request.patientId}};
        }
        resolvePendingCase(request.patientId);
        _ = start runEmergencyAnswersCycle(request, pendingCase);
        return http:ACCEPTED;
    }
}
