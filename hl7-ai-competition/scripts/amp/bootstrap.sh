#!/usr/bin/env bash
# Bootstrap WSO2 Agent Manager (AMP v0.18.0 quick-start) for the Care Loop demo.
#
# Installs the AMP quick-start k3d cluster with every environment fix this
# machine needs applied up front, then registers the Care Loop LLM provider,
# MCP proxy, and the three platform-hosted agents.
#
# Environment fixes baked in (all discovered empirically on this host):
# - CoreDNS: forward to the docker-provided resolver, suppress AAAA answers
#   (pods have no IPv6 egress on an IPv6-first LAN), pin Ballerina Central
#   hostnames, keep NodeHosts/host.k3d.internal intact.
# - kube-proxy's UDP ClusterIP DNAT is broken on this kernel; DNS traffic to
#   the kube-dns VIP is DNAT'ed straight to the CoreDNS pod.
# - The chart's jwt-keys/tls-certs pre-install hooks apk-install tools at run
#   time and cannot work without pod egress; their secrets are pre-created and
#   the hook jobs stripped from a local copy of the chart.
# - Build workflow templates: jq via podman instead of apk, --tls-verify=false
#   for the in-cluster registry, alpine/git pre-imported into the node.
# - ballerina-warm and temurin base images pushed to the in-cluster registry
#   so agent builds run fully offline.
# - Console OAuth on port 13000: Thunder redirect URI, CORS origin, and the
#   console SIGN_IN/SIGN_OUT redirect config all aligned to 13000.
#
# Requires: docker, curl, python3, an OpenAI key in
# care-loop-questionnaire-agent/Config.toml (openAiApiKey), and the local
# docker image cache to hold ballerina/ballerina:2201.13.4 and
# eclipse-temurin:21-jre (pulled automatically when absent).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMP_DIR="$(cd "$HERE/../.." && pwd)"
AMP_VERSION="v0.18.0"
QS_IMAGE="ghcr.io/wso2/amp-quick-start:${AMP_VERSION}"
QS_NAME="amp-quick-start"
NODE="k3d-amp-local-server-0"
REGISTRY="localhost:10082"
GATEWAY_ID_FILE="$HERE/.gateway-id"
GW_KEY_FILE="$HERE/.gateway-api-key"

log() { printf '\n== %s\n' "$*"; }

kexec() { docker exec "$QS_NAME" "$@"; }
kubectl_() { docker exec "$QS_NAME" kubectl "$@"; }

require_openai_key() {
    OPENAI_KEY=$(sed -n 's/^openAiApiKey *= *"\(.*\)"/\1/p' \
        "$COMP_DIR/care-loop-questionnaire-agent/Config.toml" 2>/dev/null | head -1)
    [ -n "$OPENAI_KEY" ] || {
        echo "openAiApiKey not found in care-loop-questionnaire-agent/Config.toml" >&2
        exit 1
    }
}

start_quick_start() {
    log "Starting quick-start container"
    docker rm -f "$QS_NAME" 2>/dev/null || true
    docker run -d --name "$QS_NAME" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        --network=host --entrypoint sleep "$QS_IMAGE" infinity
}

install_prefixes() {
    # Run install.sh up to (not including) the AMP chart; the chart's hook
    # jobs need the network fixes and pre-created secrets first. install.sh
    # is idempotent for completed steps, so run it once, let step 13 fail if
    # it must, fix, and run the AMP chart install separately.
    log "Running platform install (steps 1-12 plus first attempt at 13)"
    kexec ./install.sh || true
}

fix_cluster_dns() {
    log "Fixing cluster DNS"
    local api_ip fs_ip cip
    api_ip=$(getent ahostsv4 api.central.ballerina.io | awk '{print $1}' | head -1)
    fs_ip=$(getent ahostsv4 fileserver.central.ballerina.io | awk '{print $1}' | head -1)
    kubectl_ get cm coredns -n kube-system -o jsonpath='{.data.Corefile}' > /tmp/amp-Corefile.$$ 2>/dev/null || true
    docker cp /tmp/amp-Corefile.$$ "$QS_NAME:/tmp/Corefile" 2>/dev/null || \
        docker exec -i "$QS_NAME" sh -c 'cat > /tmp/Corefile' < /tmp/amp-Corefile.$$
    rm -f /tmp/amp-Corefile.$$
    kexec bash -c '
        sed -i "s#forward . /etc/resolv.conf#forward . 172.20.0.1#" /tmp/Corefile
        grep -q "template IN AAAA" /tmp/Corefile || sed -i \
            "s#    hosts /etc/coredns/NodeHosts {#    template IN AAAA . {\n      rcode NOERROR\n    }\n    hosts /etc/coredns/NodeHosts {#" \
            /tmp/Corefile'
    kubectl_ create cm coredns -n kube-system \
        --from-file=Corefile=/tmp/Corefile \
        --from-literal=NodeHosts="172.20.0.2 $NODE
172.20.0.1 host.k3d.internal
$api_ip api.central.ballerina.io
$fs_ip fileserver.central.ballerina.io" \
        --dry-run=client -o yaml | kexec kubectl apply -f - >/dev/null 2>&1 || \
        kubectl_ create cm coredns -n kube-system --from-file=Corefile=/tmp/Corefile --dry-run=client -o yaml | kexec kubectl apply -f -
    kubectl_ rollout restart deployment/coredns -n kube-system
    kubectl_ rollout status deployment/coredns -n kube-system --timeout=120s
    apply_dns_dnat
}

apply_dns_dnat() {
    local cip
    cip=$(kubectl_ get pod -n kube-system -l k8s-app=kube-dns -o jsonpath='{.items[0].status.podIP}')
    docker exec "$NODE" sh -c "
        iptables -t nat -D PREROUTING -d 10.43.0.10/32 -p udp --dport 53 -j DNAT --to-destination \$(iptables -t nat -S PREROUTING | sed -n 's/.*--to-destination \([0-9.]*\):53.*/\1/p' | head -1):53 2>/dev/null || true
        iptables -t nat -D PREROUTING -d 10.43.0.10/32 -p tcp --dport 53 -j DNAT --to-destination \$(iptables -t nat -S PREROUTING | sed -n 's/.*--to-destination \([0-9.]*\):53.*/\1/p' | head -1):53 2>/dev/null || true
        iptables -t nat -I PREROUTING 1 -d 10.43.0.10/32 -p udp --dport 53 -j DNAT --to-destination $cip:53
        iptables -t nat -I PREROUTING 1 -d 10.43.0.10/32 -p tcp --dport 53 -j DNAT --to-destination $cip:53"
    echo "DNS DNAT -> $cip"
}

precreate_amp_secrets() {
    log "Pre-creating AMP hook secrets"
    kexec bash -c '
        set -e
        kubectl create ns wso2-amp --dry-run=client -o yaml | kubectl apply -f - >/dev/null
        if ! kubectl get secret amp-jwt-keys -n wso2-amp >/dev/null 2>&1; then
            mkdir -p /tmp/keys && cd /tmp/keys
            openssl genrsa -out private.pem 4096 2>/dev/null
            openssl rsa -in private.pem -pubout -out public.pem 2>/dev/null
            TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
            printf "{\n \"keys\": [\n  {\n   \"kid\": \"key-1\",\n   \"algorithm\": \"RS256\",\n   \"publicKeyPath\": \"/app/keys/public.pem\",\n   \"description\": \"JWT signing key generated by bootstrap\",\n   \"createdAt\": \"%s\"\n  }\n ]\n}\n" "$TS" > public-keys-config.json
            kubectl create secret generic amp-jwt-keys -n wso2-amp \
                --from-file=private.pem --from-file=public.pem --from-file=public-keys-config.json
            kubectl annotate secret amp-jwt-keys -n wso2-amp \
                amp.wso2.com/keys-version=1 amp.wso2.com/key-id=key-1 "amp.wso2.com/generated-at=$TS" --overwrite
        fi
        if ! kubectl get secret amp-tls-certs -n wso2-amp >/dev/null 2>&1; then
            cd /tmp/keys
            openssl genrsa -out key.pem 2048 2>/dev/null
            openssl req -new -x509 -sha256 -key key.pem -out cert.pem -days 365 \
                -subj "/C=US/O=Agent Manager Dev" \
                -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
                -addext "extendedKeyUsage=serverAuth" \
                -addext "subjectAltName=DNS:localhost,DNS:amp-api.wso2-amp.svc.cluster.local,DNS:amp-api.wso2-amp.svc,DNS:amp-api,DNS:amp-api-gateway-manager.wso2-amp.svc.cluster.local,IP:127.0.0.1,IP:::1"
            kubectl create secret generic amp-tls-certs -n wso2-amp --from-file=cert.pem --from-file=key.pem
        fi'
}

install_amp_chart() {
    log "Installing AMP chart (hook jobs stripped)"
    kexec bash -c "
        set -e
        if helm status amp -n wso2-amp >/dev/null 2>&1; then echo 'amp release present'; exit 0; fi
        rm -rf /tmp/chart && mkdir -p /tmp/chart
        helm pull oci://ghcr.io/wso2/wso2-agent-manager --version 0.18.0 --untar -d /tmp/chart
        rm -f /tmp/chart/wso2-agent-manager/templates/jobs/jwt-keys-generation-job.yaml \
              /tmp/chart/wso2-agent-manager/templates/jobs/tls-certs-job.yaml
        helm install amp /tmp/chart/wso2-agent-manager -n wso2-amp --create-namespace \
            --timeout 1800s --set console.config.instrumentationUrl=http://localhost:22893/otel"
    # Remaining step-13 extensions are idempotent through install-helpers.
    kexec bash -c '
        source ./install-helpers.sh
        install_platform_resources_extension || true
        install_observability_extension || true
        install_evaluation_extension || true
        install_gateway_extension || true
        kubectl apply -f https://raw.githubusercontent.com/wso2/agent-manager/amp/v0.18.0/deployments/values/otel-collector-rest-api.yaml || true'
}

patch_build_templates() {
    log "Patching build workflow templates"
    kexec bash -c '
        set -e
        kubectl get clusterworkflowtemplate containerfile-build -o yaml > /tmp/cfb.yaml
        sed -i "s|set -- podman build -t \"\$IMAGE\" -f|set -- podman build --tls-verify=false -t \"\$IMAGE\" -f|" /tmp/cfb.yaml
        kubectl apply -f /tmp/cfb.yaml
        kubectl get clusterworkflowtemplate amp-generate-workload -o yaml > /tmp/agw.yaml
        sed -i "s|apk add --no-cache jq|jq() { podman run --rm -i -v /mnt/vol:/mnt/vol ghcr.io/jqlang/jq:1.7.1 \"\$@\"; }|" /tmp/agw.yaml
        kubectl apply -f /tmp/agw.yaml'
}

seed_images() {
    log "Seeding node and registry images"
    docker image inspect alpine/git:latest >/dev/null 2>&1 || docker pull alpine/git:latest
    kexec k3d image import alpine/git:latest -c amp-local
    docker image inspect eclipse-temurin:21-jre >/dev/null 2>&1 || docker pull eclipse-temurin:21-jre
    docker tag eclipse-temurin:21-jre "$REGISTRY/temurin:21-jre"
    docker push "$REGISTRY/temurin:21-jre"
    if ! curl -sf "http://$REGISTRY/v2/ballerina-warm/tags/list" | grep -q 2201.13.4; then
        log "Building ballerina-warm (Central cache from ~/.ballerina)"
        local w; w=$(mktemp -d)
        mkdir -p "$w/dotballerina/repositories"
        cp -r "$HOME/.ballerina/repositories/central.ballerina.io" "$w/dotballerina/repositories/"
        printf 'FROM ballerina/ballerina:2201.13.4\nCOPY --chown=100:1000 dotballerina /home/ballerina/.ballerina\n' > "$w/Dockerfile"
        tar -C "$w" -cf - Dockerfile dotballerina | docker build -q -t "$REGISTRY/ballerina-warm:2201.13.4" -
        docker push "$REGISTRY/ballerina-warm:2201.13.4"
        rm -rf "$w"
    fi
}

fix_console_port() {
    log "Aligning console OAuth with port 13000"
    kubectl_ patch cm amp-console -n wso2-amp --type merge -p \
        '{"data":{"SIGN_IN_REDIRECT_URL":"http://localhost:13000/login","SIGN_OUT_REDIRECT_URL":"http://localhost:13000/login"}}'
    kubectl_ rollout restart deploy/amp-console -n wso2-amp
    # Thunder: add 13000 redirect URI and CORS origin.
    local sec tok app_id
    sec=$(kubectl_ get secret amp-api -n wso2-amp -o jsonpath='{.data.thunder-client-secret}' | base64 -d)
    tok=$(curl -s -H "Host: thunder.amp.localhost" -u "amp-system-client:$sec" \
        -d "grant_type=client_credentials&scope=system" http://localhost:8080/oauth2/token \
        | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
    app_id=$(curl -s -H "Host: thunder.amp.localhost" -H "Authorization: Bearer $tok" \
        http://localhost:8080/applications | python3 -c '
import sys,json
for a in json.load(sys.stdin).get("applications",[]):
    if a.get("name")=="AMP Console": print(a["id"])')
    curl -s -H "Host: thunder.amp.localhost" -H "Authorization: Bearer $tok" \
        "http://localhost:8080/applications/$app_id" > /tmp/amp-console-app.$$
    python3 - <<PYEOF
import json
p="/tmp/amp-console-app.$$"
d=json.load(open(p))
for c in d["inboundAuthConfig"]:
    if c["type"]=="oauth2":
        uris=set(c["config"].get("redirectUris",[]))
        uris.update(["http://localhost:13000/login","http://localhost:3000/login"])
        c["config"]["redirectUris"]=sorted(uris)
json.dump(d,open(p,"w"))
PYEOF
    curl -s -X PUT -H "Host: thunder.amp.localhost" -H "Authorization: Bearer $tok" \
        -H "Content-Type: application/json" "http://localhost:8080/applications/$app_id" \
        -d @/tmp/amp-console-app.$$ -o /dev/null
    rm -f /tmp/amp-console-app.$$
    kubectl_ get cm amp-thunder-extension-config-map -n amp-thunder -o json > /tmp/amp-tcm.$$
    python3 - <<PYEOF
import json
p="/tmp/amp-tcm.$$"
d=json.load(open(p))
for k,v in list(d["data"].items()):
    if "allowed_origins" in v and "http://localhost:13000" not in v:
        d["data"][k]=v.replace('allowed_origins:\n    - "http://localhost:3000"',
            'allowed_origins:\n    - "http://localhost:3000"\n    - "http://localhost:13000"',1)
for f in ("resourceVersion","uid","creationTimestamp","managedFields"):
    d["metadata"].pop(f,None)
json.dump(d,open(p,"w"))
PYEOF
    docker exec -i "$QS_NAME" sh -c 'cat > /tmp/tcm.json' < /tmp/amp-tcm.$$
    rm -f /tmp/amp-tcm.$$
    kubectl_ apply -f /tmp/tcm.json
    kubectl_ rollout restart deploy -n amp-thunder
}

main() {
    require_openai_key
    start_quick_start
    install_prefixes
    fix_cluster_dns
    precreate_amp_secrets
    install_amp_chart
    patch_build_templates
    seed_images
    fix_console_port
    log "Bootstrap complete. Console: http://localhost:13000 (admin/admin)."
    log "Next: scripts/amp/register.sh registers the provider, MCP proxy, and agents."
}

main "$@"
