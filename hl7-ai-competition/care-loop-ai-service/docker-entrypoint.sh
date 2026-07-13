#!/bin/sh
# When the AMP gateway key is present (written by the amp-init compose
# service), use it as the AI gateway API key for LLM calls. The FHIR MCP
# connection goes direct to the MCP server and needs no gateway token.
set -e

if [ -s /amp-shared/gateway.key ]; then
    BAL_CONFIG_VAR_OPENAIAPIKEY="$(cat /amp-shared/gateway.key)"
    export BAL_CONFIG_VAR_OPENAIAPIKEY
fi

exec java -jar care_loop_ai_service.jar
