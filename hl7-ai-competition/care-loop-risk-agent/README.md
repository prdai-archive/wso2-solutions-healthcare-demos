# care-loop-risk-agent

Standalone Ballerina agent (port 8000). `POST /risk-assessment {patientId,
mlProbability, answers}` runs an `ai:Agent` (GPT-4.1) wired to fhir-mcp-server
via `ai:McpToolKit`: it looks up whatever FHIR resources it judges relevant
(vitals, active conditions, medications, allergies), weighs them against the
ML probability and the patient's questionnaire answers, and returns its own
probability, risk level, reasoning, and cited resources. Split out of
care-loop-ai-service so it can be deployed as a WSO2 Agent Manager (AMP)
platform-hosted agent.

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
`hl7-ai-competition/care-loop-risk-agent`, and port 8000 (AMP's default agent
port; `listenPort` defaults to it). AMP injects configuration as environment
variables; Ballerina maps `BAL_CONFIG_VAR_<NAME>` to the matching
configurable, e.g. `BAL_CONFIG_VAR_OPENAIAPIKEY`,
`BAL_CONFIG_VAR_OPENAISERVICEURL`, `BAL_CONFIG_VAR_USEAMPGATEWAY=true`,
`BAL_CONFIG_VAR_FHIRMCPURL`, `BAL_CONFIG_VAR_FHIRMCPAUTHTOKEN`.
