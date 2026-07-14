import ballerina/http;
import ballerina/log;

# A milestone event surfaced in the ops dashboard's live feed.
#
# + patientId - FHIR Patient id the event is about
# + label - short milestone label shown in the live feed
# + detail - optional extra context shown alongside the label
# + payload - optional structured key/value fields rendered in the dashboard's detail panel
public type DashboardEvent record {|
    string patientId;
    string label;
    string detail?;
    map<string> payload?;
|};

# Bun's dashboard HTTP server resets the connection on http:Client's default HTTP_2_0 h2c upgrade probe;
# pinning HTTP_1_1 avoids it (verified 0/50 failures vs 50/50 before, across every service that calls it).
public isolated function newDashboardEventsClient(string dashboardEventsUrl) returns http:Client|error =>
    new (dashboardEventsUrl, httpVersion = http:HTTP_1_1);

# Fire-and-forget notification to the ops dashboard's live feed. Never allowed to affect the caller's
# real work, so failures are only logged, never surfaced or retried.
#
# + dashboardEventsClient - client constructed via newDashboardEventsClient, owned by the caller
# + patientId - FHIR Patient id the event is about
# + label - short milestone label shown in the live feed
# + detail - optional extra context shown alongside the label
# + payload - optional structured key/value fields rendered in the dashboard's detail panel
public isolated function notifyDashboard(http:Client dashboardEventsClient, string patientId, string label,
        string? detail = (), map<string>? payload = ()) {
    DashboardEvent event = {patientId, label, detail, payload};
    http:Response|http:ClientError result = dashboardEventsClient->post("/api/events", event);
    if result is http:ClientError {
        log:printWarn("failed to notify dashboard", patientId = patientId, label = label, 'error = result);
    }
}
