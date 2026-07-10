# care-loop-task-agent

Standalone Ballerina agent (port 8000). `POST /task-description {patientId,
mlProbability, answers, display, agentic}` runs an `ai:Agent` (GPT-4.1-nano)
wired to fhir-mcp-server via `ai:McpToolKit`: it optionally looks up the
resources the risk assessment cited, then writes the narrative description for
the clinical review Task. If the agent fails, the service falls back to a
plain summary built from the request so a Task can still be created. Deployed
as a WSO2 Agent Manager (AMP) platform-hosted agent.

## Config

Copy `Config.toml.example` to `Config.toml` (gitignored) and set
`openAiApiKey`. With `useAmpGateway = false` (default) the agent calls OpenAI
directly through the stock `ballerinax/ai.openai` provider. With
`useAmpGateway = true` it uses `AmpModelProvider`, which speaks the same
OpenAI chat-completions wire format (including tool calling) but authenticates
with the `API-Key` header the AMP egress AI gateway requires; point
`openAiServiceUrl` at the gateway invoke URL and set `openAiApiKey` to the
gateway API key. Set `fhirMcpAuthToken` to send bearer auth to the MCP server
(e.g. the AMP MCP proxy key).

## Run locally

```sh
bal run
```

## Deploy on AMP (platform-hosted)

Register the agent as platform-hosted with build type Docker, project path
`hl7-ai-competition/care-loop-task-agent`, and port 8000 (AMP's default agent
port; `listenPort` defaults to it). AMP injects configuration as environment
variables; Ballerina maps `BAL_CONFIG_VAR_<NAME>` to the matching
configurable, e.g. `BAL_CONFIG_VAR_OPENAIAPIKEY`,
`BAL_CONFIG_VAR_OPENAISERVICEURL`, `BAL_CONFIG_VAR_USEAMPGATEWAY=true`,
`BAL_CONFIG_VAR_FHIRMCPURL`, `BAL_CONFIG_VAR_FHIRMCPAUTHTOKEN`.
