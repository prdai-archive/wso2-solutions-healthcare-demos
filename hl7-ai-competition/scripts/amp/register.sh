#!/usr/bin/env bash
# Register the Care Loop resources in a freshly bootstrapped Agent Manager:
# the OpenAI LLM provider (deployed to the default AI gateway with an API
# key), the FHIR MCP proxy (registered directly on the gateway controller —
# AMP's console API refuses private-IP upstreams), and the three
# platform-hosted agents built from this repository.
#
# Requires scripts/amp/bootstrap.sh to have completed, amctl on PATH or in
# scripts/amp/, and the OpenAI key in care-loop-questionnaire-agent/Config.toml.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMP_DIR="$(cd "$HERE/../.." && pwd)"
QS_NAME="amp-quick-start"
API=http://localhost:9000
REPO_URL=https://github.com/prdai-archive/wso2-solutions-healthcare-demos
REPO_BRANCH=feat/wso2-agent-manager
RUNTIME_SVC=api-platform-default-default-gateway-gateway-runtime.openchoreo-data-plane.svc.cluster.local

log() { printf '\n== %s\n' "$*"; }

AMCTL=$(command -v amctl || echo "$HERE/amctl")
[ -x "$AMCTL" ] || { echo "amctl not found; install per AMP docs" >&2; exit 1; }

OPENAI_KEY=$(sed -n 's/^openAiApiKey *= *"\(.*\)"/\1/p' \
    "$COMP_DIR/care-loop-questionnaire-agent/Config.toml" | head -1)
[ -n "$OPENAI_KEY" ] || { echo "openAiApiKey missing" >&2; exit 1; }

token() {
    curl -s -H "Host: thunder.amp.localhost" -u amp-api-client:amp-api-client-secret \
        --data-urlencode "grant_type=client_credentials" \
        --data-urlencode "scope=amp:org:view amp:project:read amp:agent:read amp:agent:create amp:agent:build amp:agent:deploy-non-production amp:agent:api-key-manage amp:llm-provider:read amp:llm-provider:create amp:llm-provider:update amp:llm-provider:deploy amp:llm-provider:api-key-manage amp:gateway:read amp:mcp-server:read amp:mcp-server:create amp:environment:read amp:agent-kind:read amp:repository:read" \
        http://localhost:8080/oauth2/token | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])'
}

log "Logging in amctl"
"$AMCTL" login --url $API --client-id amp-api-client --client-secret amp-api-client-secret

TOK=$(token)
GW_ID=$(curl -s -H "Authorization: Bearer $TOK" $API/api/v1/orgs/default/gateways \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["gateways"][0]["uuid"])')
log "Gateway: $GW_ID"

log "LLM provider"
PROVIDER_UUID=$(curl -s -H "Authorization: Bearer $TOK" $API/api/v1/orgs/default/llm-providers \
    | python3 -c 'import sys,json
for p in json.load(sys.stdin).get("providers",[]):
    if p["id"]=="careloop-openai": print(p["uuid"])')
if [ -z "$PROVIDER_UUID" ]; then
    curl -sf -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
        $API/api/v1/orgs/default/llm-providers \
        -d '{"name":"Care Loop OpenAI","displayName":"Care Loop OpenAI","templateId":"openai","version":"v1"}' >/dev/null
    PROVIDER_UUID=$(curl -s -H "Authorization: Bearer $TOK" $API/api/v1/orgs/default/llm-providers \
        | python3 -c 'import sys,json
for p in json.load(sys.stdin).get("providers",[]):
    if p["id"]=="careloop-openai": print(p["uuid"])')
fi
curl -sf -X PUT -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
    "$API/api/v1/orgs/default/llm-providers/$PROVIDER_UUID" \
    -d "{\"name\":\"Care Loop OpenAI\",\"template\":\"openai\",\"context\":\"/careloop-openai\",\"version\":\"v1\",\"accessControl\":{\"mode\":\"allow_all\"},\"security\":{\"enabled\":true,\"apiKey\":{\"enabled\":true,\"key\":\"API-Key\",\"in\":\"header\"}},\"upstream\":{\"main\":{\"url\":\"https://api.openai.com/v1\",\"auth\":{\"type\":\"api-key\",\"header\":\"Authorization\",\"value\":\"Bearer $OPENAI_KEY\"}}}}" >/dev/null
curl -sf -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
    "$API/api/v1/orgs/default/llm-providers/$PROVIDER_UUID/deployments" \
    -d "{\"name\":\"bootstrap-$(date +%s)\",\"base\":\"current\",\"gatewayId\":\"$GW_ID\"}" >/dev/null
GW_KEY=$(curl -sf -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
    "$API/api/v1/orgs/default/llm-providers/$PROVIDER_UUID/api-keys" \
    -d "{\"name\":\"careloop-$(date +%s)\",\"gatewayId\":\"$GW_ID\"}" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["apiKey"])')
umask 077 && printf '%s' "$GW_KEY" > "$HERE/.gateway-api-key"
log "Provider deployed; gateway key written to scripts/amp/.gateway-api-key"

log "MCP proxy (direct on gateway controller; AMP API rejects private upstreams)"
docker exec -d "$QS_NAME" bash -c \
    'kubectl port-forward -n openchoreo-data-plane svc/api-platform-default-default-gateway-controller 19090:9090 --address 127.0.0.1 >/dev/null 2>&1'
sleep 3
docker exec "$QS_NAME" bash -c 'printf "apiVersion: gateway.api-platform.wso2.com/v1alpha1\nkind: Mcp\nmetadata:\n  name: careloop-fhir-mcp\nspec:\n  displayName: Care Loop FHIR MCP\n  version: v1.0\n  context: /fhir-mcp\n  specVersion: \"2025-06-18\"\n  upstream:\n    url: http://host.k3d.internal:8001/mcp\n  tools: []\n  resources: []\n  prompts: []\n" > /tmp/mcp.yaml
curl -s -u admin:admin -X POST -H "Content-Type: application/yaml" http://127.0.0.1:19090/mcp-proxies --data-binary @/tmp/mcp.yaml | head -c 120; echo'

log "Agents"
for spec in \
    "careloop-questionnaire|Care Loop Questionnaire Agent|care-loop-questionnaire-agent" \
    "careloop-risk|Care Loop Risk Agent|care-loop-risk-agent" \
    "careloop-task|Care Loop Task Agent|care-loop-task-agent"; do
    IFS="|" read -r name display path <<< "$spec"
    if "$AMCTL" agent list --project default 2>/dev/null | grep -q "^$name\b"; then
        echo "$name exists"
        continue
    fi
    "$AMCTL" agent create "$name" \
        --display-name "$display" \
        --provisioning internal --subtype custom-api --build-type docker \
        --repo-url "$REPO_URL" --repo-branch "$REPO_BRANCH" \
        --repo-path "hl7-ai-competition/$path" \
        --dockerfile Dockerfile --port 8000 --base-path / --openapi-spec openapi.yaml \
        --env BAL_CONFIG_VAR_USEAMPGATEWAY=true \
        --env "BAL_CONFIG_VAR_OPENAISERVICEURL=http://$RUNTIME_SVC:22893/careloop-openai" \
        --env-secret "BAL_CONFIG_VAR_OPENAIAPIKEY=$GW_KEY" \
        --env "BAL_CONFIG_VAR_FHIRMCPURL=http://$RUNTIME_SVC:22893/fhir-mcp/mcp" \
        --project default
done

log "Triggering builds (one at a time)"
for name in careloop-questionnaire careloop-risk careloop-task; do
    "$AMCTL" agent build create "$name" --project default
    for i in $(seq 1 60); do
        st=$("$AMCTL" agent build list "$name" --project default 2>/dev/null | awk 'NR==1{print $2}')
        case "$st" in
            Succeeded) echo "$name build Succeeded"; break;;
            Failed) echo "$name build Failed" >&2; break;;
        esac
        sleep 20
    done
done

log "Done. Deploy each agent from the console or with amctl agent deploy."
