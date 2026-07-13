#!/bin/sh
# When the AMP gateway key is present (written by the amp-init compose
# service), use it for both the AI gateway and the MCP proxy Bearer token.
set -e

if [ -s /amp-shared/gateway.key ]; then
    BAL_CONFIG_VAR_OPENAIAPIKEY="$(cat /amp-shared/gateway.key)"
    export BAL_CONFIG_VAR_OPENAIAPIKEY
    export BAL_CONFIG_VAR_FHIRMCPAUTHTOKEN="${BAL_CONFIG_VAR_FHIRMCPAUTHTOKEN:-$BAL_CONFIG_VAR_OPENAIAPIKEY}"
fi

exec java -jar care_loop_ai_service.jar
