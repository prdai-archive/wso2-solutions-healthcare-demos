# care-loop-ai-service

Ballerina agent service (port 8003) using either OpenAI (`GPT-4.1` / `GPT-4.1-nano`) or Anthropic (`Claude Sonnet 4.5` / `Claude Haiku 4.5`) via `ai:McpToolKit`s for FHIR, the knowledge base, and PubMed. Endpoints: `POST /questionnaires` drafts a FHIR `Questionnaire` from the patient's vitals trend; `POST /conversation/turn` drives the live adaptive check-in one turn at a time; `POST /risk-assessment` scores risk, grounding thresholds in the knowledge base and citing guideline sections; `POST /task-description` narrates the Task. Called by care-loop-collector-service and care-loop-analysis-service.

## Config

All LLM calls route only through the AMP AI gateway; there is no direct-provider mode. `modelProvider` (`openai` or `anthropic`) selects the gateway route: `openai` uses `AmpModelProvider` (sends the gateway's `API-Key` header) and `anthropic` uses the stock `anthropic:ModelProvider` (its native `x-api-key` header, which `amp-init` registers `careloop-anthropic` to accept). In compose, `Config.compose.toml` is mounted as `Config.toml` and points the service URLs at the gateway, while `docker-entrypoint.sh` injects the minted gateway keys from the `amp-shared` volume and refuses to boot without one. For a standalone run, copy `Config.toml.example` to `Config.toml` and fill in the gateway URLs and minted keys. See the WSO2 Agent Manager section of the main README.

`fhirMcpUrl`, `knowledgeMcpUrl`, and `pubmedMcpUrl` in the example already point at the compose service names; switch them to `localhost` if running with `bal run` on the host instead.

## Run locally

```sh
bal run
```

## Run with Docker

From the `hl7-ai-competition` root (docker stack):

```sh
make up        # build and start care-loop-ai-service on :8003
make ps        # show status
make down      # stop it
```
