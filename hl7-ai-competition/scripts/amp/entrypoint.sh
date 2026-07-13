#!/bin/bash
# Boot WSO2 Agent Manager (AMP v0.18.0 quick-start) inside this container.
#
# Runs dockerd (docker-in-docker), brings up the quick-start k3d cluster via
# the image's own install.sh, then applies the environment fixes this stack
# needs before the AMP chart can work: cluster DNS forwarding with AAAA
# suppression, a DNAT bypass for kube-proxy's broken UDP ClusterIP handling,
# pre-created jwt/tls hook secrets with the hook jobs stripped from the chart,
# and the console OAuth alignment for host port 13000. Every step is
# idempotent so container restarts resume the existing cluster (persisted in
# the /var/lib/docker volume) instead of reinstalling.
#
# Agent in-cluster build support from the original bootstrap (builder image
# seeding, workflow template patches, registry warm-up) is intentionally
# omitted: agents are no longer built inside the cluster.

set -euo pipefail

CLUSTER=amp-local
NODE=k3d-${CLUSTER}-server-0
QS_HOME=/home/wso2-amp
READY_FILE=/var/run/amp-ready
AMP_VERSION=0.18.0

log() { printf '\n== %s\n' "$*"; }

# Delegate cgroup v2 controllers to child cgroups (the docker:dind evacuation
# dance); without this, nested k3s dies with "failed to find memory cgroup".
setup_cgroups() {
    [ -f /sys/fs/cgroup/cgroup.controllers ] || return 0
    mkdir -p /sys/fs/cgroup/init
    xargs -rn1 </sys/fs/cgroup/cgroup.procs >/sys/fs/cgroup/init/cgroup.procs 2>/dev/null || true
    sed -e 's/ / +/g' -e 's/^/+/' </sys/fs/cgroup/cgroup.controllers >/sys/fs/cgroup/cgroup.subtree_control
}

start_dockerd() {
    setup_cgroups
    docker info >/dev/null 2>&1 && return 0
    log "Starting dockerd"
    rm -f /var/run/docker.pid
    dockerd --host=unix:///var/run/docker.sock >/var/log/dockerd.log 2>&1 &
    local i
    for i in $(seq 1 60); do
        docker info >/dev/null 2>&1 && return 0
        sleep 2
    done
    echo "dockerd did not become ready" >&2
    tail -50 /var/log/dockerd.log >&2 || true
    return 1
}

resume_cluster() {
    k3d cluster list "$CLUSTER" >/dev/null 2>&1 || return 0
    log "Resuming existing k3d cluster"
    k3d cluster start "$CLUSTER" || true
}

run_install() {
    # install.sh is idempotent for completed steps; its final AMP chart step
    # needs the DNS fixes and pre-created secrets first, so let it fail there
    # and install the chart separately below.
    log "Running quick-start install (AMP chart step may fail; handled below)"
    (cd "$QS_HOME" && ./install.sh) || true
}

fix_cluster_dns() {
    log "Fixing cluster DNS"
    local gw node_ip
    gw=$(docker network inspect "k3d-$CLUSTER" -f '{{(index .IPAM.Config 0).Gateway}}')
    node_ip=$(docker inspect "$NODE" -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    kubectl get cm coredns -n kube-system -o jsonpath='{.data.Corefile}' > /tmp/Corefile
    # Pods have no IPv6 egress on an IPv6-first LAN; suppress AAAA answers.
    sed -i "s#forward . /etc/resolv.conf#forward . $gw#" /tmp/Corefile
    grep -q "template IN AAAA" /tmp/Corefile || sed -i \
        "s#    hosts /etc/coredns/NodeHosts {#    template IN AAAA . {\n      rcode NOERROR\n    }\n    hosts /etc/coredns/NodeHosts {#" \
        /tmp/Corefile
    kubectl create cm coredns -n kube-system \
        --from-file=Corefile=/tmp/Corefile \
        --from-literal=NodeHosts="$node_ip $NODE
$gw host.k3d.internal" \
        --dry-run=client -o yaml | kubectl apply -f -
    kubectl rollout restart deployment/coredns -n kube-system
    kubectl rollout status deployment/coredns -n kube-system --timeout=120s
    apply_dns_dnat
}

apply_dns_dnat() {
    # kube-proxy's UDP ClusterIP DNAT is broken on this kernel; send DNS
    # traffic for the kube-dns VIP straight to the CoreDNS pod.
    local cip
    cip=$(kubectl get pod -n kube-system -l k8s-app=kube-dns -o jsonpath='{.items[0].status.podIP}')
    docker exec "$NODE" sh -c "
        iptables -t nat -S PREROUTING | grep '10\\.43\\.0\\.10/32' | sed 's/^-A/-D/' | while read -r r; do iptables -t nat \$r; done
        iptables -t nat -I PREROUTING 1 -d 10.43.0.10/32 -p udp --dport 53 -j DNAT --to-destination $cip:53
        iptables -t nat -I PREROUTING 1 -d 10.43.0.10/32 -p tcp --dport 53 -j DNAT --to-destination $cip:53"
    echo "DNS DNAT -> $cip"
}

precreate_amp_secrets() {
    log "Pre-creating AMP hook secrets"
    # The chart's hook jobs apk-install tools at run time and need pod egress;
    # pre-create their secrets and strip the jobs from the chart instead.
    kubectl create ns wso2-amp --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    if ! kubectl get secret amp-jwt-keys -n wso2-amp >/dev/null 2>&1; then
        mkdir -p /tmp/keys && cd /tmp/keys
        openssl genrsa -out private.pem 4096 2>/dev/null
        openssl rsa -in private.pem -pubout -out public.pem 2>/dev/null
        local ts
        ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
        printf '{\n "keys": [\n  {\n   "kid": "key-1",\n   "algorithm": "RS256",\n   "publicKeyPath": "/app/keys/public.pem",\n   "description": "JWT signing key generated by bootstrap",\n   "createdAt": "%s"\n  }\n ]\n}\n' "$ts" > public-keys-config.json
        kubectl create secret generic amp-jwt-keys -n wso2-amp \
            --from-file=private.pem --from-file=public.pem --from-file=public-keys-config.json
        kubectl annotate secret amp-jwt-keys -n wso2-amp \
            amp.wso2.com/keys-version=1 amp.wso2.com/key-id=key-1 \
            "amp.wso2.com/generated-at=$ts" --overwrite
        cd /
    fi
    if ! kubectl get secret amp-tls-certs -n wso2-amp >/dev/null 2>&1; then
        mkdir -p /tmp/keys && cd /tmp/keys
        openssl genrsa -out key.pem 2048 2>/dev/null
        openssl req -new -x509 -sha256 -key key.pem -out cert.pem -days 365 \
            -subj "/C=US/O=Agent Manager Dev" \
            -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
            -addext "extendedKeyUsage=serverAuth" \
            -addext "subjectAltName=DNS:localhost,DNS:amp-api.wso2-amp.svc.cluster.local,DNS:amp-api.wso2-amp.svc,DNS:amp-api,DNS:amp-api-gateway-manager.wso2-amp.svc.cluster.local,IP:127.0.0.1,IP:::1"
        kubectl create secret generic amp-tls-certs -n wso2-amp --from-file=cert.pem --from-file=key.pem
        cd /
    fi
}

install_amp_chart() {
    log "Installing AMP chart (hook jobs stripped)"
    if helm status amp -n wso2-amp >/dev/null 2>&1; then
        echo "amp release present"
    else
        rm -rf /tmp/chart && mkdir -p /tmp/chart
        helm pull oci://ghcr.io/wso2/wso2-agent-manager --version "$AMP_VERSION" --untar -d /tmp/chart
        rm -f /tmp/chart/wso2-agent-manager/templates/jobs/jwt-keys-generation-job.yaml \
              /tmp/chart/wso2-agent-manager/templates/jobs/tls-certs-job.yaml
        # instrumentationUrl is browser-side; 22893 is published to the host.
        helm install amp /tmp/chart/wso2-agent-manager -n wso2-amp --create-namespace \
            --timeout 1800s --set console.config.instrumentationUrl=http://localhost:22893/otel
    fi
    # Remaining install extensions are idempotent through install-helpers.
    (
        cd "$QS_HOME"
        # shellcheck disable=SC1091
        source ./install-helpers.sh
        install_platform_resources_extension || true
        install_observability_extension || true
        install_evaluation_extension || true
        install_gateway_extension || true
        kubectl apply -f "https://raw.githubusercontent.com/wso2/agent-manager/amp/v${AMP_VERSION}/deployments/values/otel-collector-rest-api.yaml" || true
    )
}

fix_console_port() {
    log "Aligning console OAuth with host port 13000"
    kubectl patch cm amp-console -n wso2-amp --type merge -p \
        '{"data":{"SIGN_IN_REDIRECT_URL":"http://localhost:13000/login","SIGN_OUT_REDIRECT_URL":"http://localhost:13000/login"}}'
    kubectl rollout restart deploy/amp-console -n wso2-amp
    local sec tok app_id
    sec=$(kubectl get secret amp-api -n wso2-amp -o jsonpath='{.data.thunder-client-secret}' | base64 -d)
    tok=$(curl -s -m 20 -H "Host: thunder.amp.localhost" -u "amp-system-client:$sec" \
        -d "grant_type=client_credentials&scope=system" http://localhost:8080/oauth2/token \
        | jq -r .access_token)
    app_id=$(curl -s -m 20 -H "Host: thunder.amp.localhost" -H "Authorization: Bearer $tok" \
        http://localhost:8080/applications \
        | jq -r '.applications[] | select(.name=="AMP Console") | .id')
    curl -s -m 20 -H "Host: thunder.amp.localhost" -H "Authorization: Bearer $tok" \
        "http://localhost:8080/applications/$app_id" \
        | jq '(.inboundAuthConfig[] | select(.type=="oauth2") | .config.redirectUris) |=
              ((. // []) + ["http://localhost:13000/login","http://localhost:3000/login"] | unique)' \
        > /tmp/console-app.json
    curl -s -m 20 -X PUT -H "Host: thunder.amp.localhost" -H "Authorization: Bearer $tok" \
        -H "Content-Type: application/json" "http://localhost:8080/applications/$app_id" \
        -d @/tmp/console-app.json -o /dev/null
    rm -f /tmp/console-app.json
    kubectl get cm amp-thunder-extension-config-map -n amp-thunder -o json \
        | jq '.data |= with_entries(
                if (.value | contains("allowed_origins") and (contains("http://localhost:13000") | not))
                then .value |= sub("allowed_origins:\n    - \"http://localhost:3000\"";
                                   "allowed_origins:\n    - \"http://localhost:3000\"\n    - \"http://localhost:13000\"")
                else . end)
              | del(.metadata.resourceVersion, .metadata.uid, .metadata.creationTimestamp, .metadata.managedFields)' \
        > /tmp/thunder-cm.json
    kubectl apply -f /tmp/thunder-cm.json
    rm -f /tmp/thunder-cm.json
    kubectl rollout restart deploy -n amp-thunder
}

start_controller_forward() {
    # The gateway-controller REST API (:9090 in-cluster) is not exposed by
    # k3d; amp-init registers the MCP proxy on it directly at amp:19090.
    log "Starting gateway-controller port-forward on 0.0.0.0:19090"
    (
        while true; do
            kubectl port-forward -n openchoreo-data-plane \
                svc/api-platform-default-default-gateway-controller \
                --address 0.0.0.0 19090:9090 >/dev/null 2>&1 || true
            sleep 5
        done
    ) &
}

main() {
    rm -f "$READY_FILE"
    export HOME=/root
    start_dockerd
    resume_cluster
    run_install
    fix_cluster_dns
    precreate_amp_secrets
    install_amp_chart
    fix_console_port
    start_controller_forward
    touch "$READY_FILE"
    log "AMP ready. Console: http://localhost:13000 (admin/admin)."
    while docker info >/dev/null 2>&1; do sleep 30; done
    echo "dockerd exited" >&2
    exit 1
}

main "$@"
