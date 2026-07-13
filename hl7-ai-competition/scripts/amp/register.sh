#!/bin/sh
# Register the Care Loop resources in the compose-hosted Agent Manager:
# the OpenAI LLM provider (deployed to the default AI gateway, upstream auth
# from OPENAI_API_KEY), a gateway API key written to /amp-shared/gateway.key
# for care-loop-ai-service, and the FHIR MCP proxy (registered directly on
# the gateway controller; the AMP API refuses private-IP upstreams).
# Idempotent: safe to re-run against an already-registered AMP.

set -eu

API=${AMP_API_URL:-http://amp:9000}
THUNDER=${AMP_THUNDER_URL:-http://amp:8080}
GATEWAY=${AMP_GATEWAY_URL:-http://amp:22893}
CONTROLLER=${AMP_GATEWAY_CONTROLLER_URL:-http://amp:19090}
MCP_UPSTREAM=${AMP_MCP_UPSTREAM_URL:-http://fhir-mcp-server:8000/mcp}
KEY_FILE=/amp-shared/gateway.key
CURL="curl -s -m 30 --connect-timeout 5"
SCOPES="amp:org:view amp:llm-provider:read amp:llm-provider:create amp:llm-provider:update amp:llm-provider:deploy amp:llm-provider:api-key-manage amp:gateway:read"

log() { printf '\n== %s\n' "$*"; }

[ -n "${OPENAI_API_KEY:-}" ] || {
    echo "OPENAI_API_KEY is not set; add it to hl7-ai-competition/.env" >&2
    exit 1
}

token() {
    $CURL -f -H "Host: thunder.amp.localhost" -u amp-api-client:amp-api-client-secret \
        --data-urlencode "grant_type=client_credentials" \
        --data-urlencode "scope=$SCOPES" \
        "$THUNDER/oauth2/token" | jq -r '.access_token // empty'
}

log "Waiting for the AMP API"
TOK=""
i=0
while [ $i -lt 60 ]; do
    TOK=$(token || true)
    [ -n "$TOK" ] && break
    i=$((i + 1))
    sleep 5
done
[ -n "$TOK" ] || { echo "could not obtain an AMP API token" >&2; exit 1; }

GW_ID=$($CURL -f -H "Authorization: Bearer $TOK" "$API/api/v1/orgs/default/gateways" \
    | jq -r '.gateways[0].uuid')
[ -n "$GW_ID" ] && [ "$GW_ID" != "null" ] || { echo "no gateway found" >&2; exit 1; }
log "Gateway: $GW_ID"

provider_uuid() {
    $CURL -f -H "Authorization: Bearer $TOK" "$API/api/v1/orgs/default/llm-providers" \
        | jq -r '.providers[]? | select(.id == "careloop-openai") | .uuid'
}

# Full provider object: the handle is the `id` field and the template is
# referenced by handle in `template`. Both create and update take this shape;
# a partial body wipes auth/template.
provider_body() {
    jq -n --arg key "$OPENAI_API_KEY" '{
        id: "careloop-openai", name: "Care Loop OpenAI", template: "openai",
        context: "/careloop-openai", version: "v1",
        accessControl: {mode: "allow_all"},
        security: {enabled: true, apiKey: {enabled: true, key: "API-Key", in: "header"}},
        upstream: {main: {url: "https://api.openai.com/v1",
            auth: {type: "api-key", header: "Authorization", value: ("Bearer " + $key)}}}
    }'
}

log "LLM provider careloop-openai"
PROVIDER_UUID=$(provider_uuid)
if [ -z "$PROVIDER_UUID" ]; then
    $CURL -f -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
        "$API/api/v1/orgs/default/llm-providers" -d "$(provider_body)" >/dev/null
    PROVIDER_UUID=$(provider_uuid)
fi
[ -n "$PROVIDER_UUID" ] || { echo "provider creation failed" >&2; exit 1; }

# PUT the full object every run so a rotated key or changed config is reapplied.
$CURL -f -X PUT -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
    "$API/api/v1/orgs/default/llm-providers/$PROVIDER_UUID" -d "$(provider_body)" >/dev/null

# Deploy body must be exactly these fields; the decoder rejects extras.
$CURL -f -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
    "$API/api/v1/orgs/default/llm-providers/$PROVIDER_UUID/deployments" \
    -d "$(jq -n --arg gw "$GW_ID" --arg name "init-$(date +%s)" \
        '{name: $name, base: "current", gatewayId: $gw}')" >/dev/null
log "Provider deployed"

key_valid() {
    [ -s "$KEY_FILE" ] || return 1
    code=$($CURL -o /dev/null -w '%{http_code}' -H "API-Key: $(cat "$KEY_FILE")" \
        "$GATEWAY/careloop-openai/models" || echo 000)
    case "$code" in
        401|403|000) return 1 ;;
        *) return 0 ;;
    esac
}

if key_valid; then
    log "Existing gateway key still accepted; keeping it"
else
    log "Minting gateway API key"
    GW_KEY=$($CURL -f -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
        "$API/api/v1/orgs/default/llm-providers/$PROVIDER_UUID/api-keys" \
        -d "$(jq -n --arg gw "$GW_ID" --arg name "careloop-$(date +%s)" \
            '{name: $name, gatewayId: $gw}')" | jq -r '.apiKey // empty')
    [ -n "$GW_KEY" ] || { echo "gateway key minting failed" >&2; exit 1; }
    umask 077
    printf '%s' "$GW_KEY" > "$KEY_FILE"
    log "Gateway key written to $KEY_FILE"
fi

log "FHIR MCP proxy"
if $CURL -f -u admin:admin "$CONTROLLER/mcp-proxies" | grep -q careloop-fhir-mcp; then
    echo "careloop-fhir-mcp already registered"
else
    cat > /tmp/mcp.yaml <<EOF
apiVersion: gateway.api-platform.wso2.com/v1alpha1
kind: Mcp
metadata:
  name: careloop-fhir-mcp
spec:
  displayName: Care Loop FHIR MCP
  version: v1.0
  context: /fhir-mcp
  specVersion: "2025-06-18"
  upstream:
    url: $MCP_UPSTREAM
  tools: []
  resources: []
  prompts: []
EOF
    $CURL -f -u admin:admin -X POST -H "Content-Type: application/yaml" \
        "$CONTROLLER/mcp-proxies" --data-binary @/tmp/mcp.yaml >/dev/null
    echo "careloop-fhir-mcp registered"
fi

log "Registration complete"
