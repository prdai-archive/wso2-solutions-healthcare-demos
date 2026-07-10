import ballerina/http;
import ballerina/log;

// http:Client defaults to HTTP_2_0, which probes with an h2c upgrade that Bun's HTTP server
// resets the connection on instead of answering - pinning HTTP_1_1 avoids it (same fix as the
// other services' dashboardEventsClient).
final http:Client dashboardEventsClient = check new (dashboardEventsUrl, httpVersion = http:HTTP_1_1);

type DashboardEvent record {|
    string patientId;
    string label;
    string detail?;
    map<string> payload?;
|};

# Fire-and-forget notification to the ops dashboard's live feed. Never allowed to
# affect this service's real work, so failures are only logged, never surfaced.
#
# + patientId - FHIR Patient id the event is about
# + label - short milestone label shown in the live feed
# + detail - optional extra context shown alongside the label
# + payload - optional structured key/value fields rendered in the dashboard's detail panel
function reportDashboardEvent(string patientId, string label, string? detail = (), map<string>? payload = ()) {
    DashboardEvent event = {patientId, label, detail, payload};
    http:Response|http:ClientError response = dashboardEventsClient->post("/api/events", event);
    if response is http:ClientError {
        log:printWarn("failed to report dashboard event", 'error = response, patientId = patientId, label = label);
    }
}
