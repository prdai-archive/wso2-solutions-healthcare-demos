import ballerina/http;
import ballerina/log;

final http:Client dashboardEventsClient = check new (dashboardEventsUrl);

type DashboardEvent record {|
    string patientId;
    string label;
    string detail?;
|};

# Fire-and-forget notification to the ops dashboard's live feed. Never allowed to
# affect this service's real work, so failures are only logged, never surfaced.
#
# + patientId - FHIR Patient id the event is about
# + label - short milestone label shown in the live feed
# + detail - optional extra context shown alongside the label
function reportDashboardEvent(string patientId, string label, string? detail = ()) {
    DashboardEvent event = {patientId, label, detail};
    http:Response|http:ClientError response = dashboardEventsClient->post("/api/events", event);
    if response is http:ClientError {
        log:printWarn("failed to report dashboard event", 'error = response, patientId = patientId, label = label);
    }
}
