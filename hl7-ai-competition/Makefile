COMPOSE := docker compose

# bootstrap-fhir.sh takes no built-in identity; two clients share it here.
MCP_CLIENT_NAME := care-loop-fhir-mcp
MCP_SCOPES := openid offline_access api:fhir user/Patient.read user/Observation.read user/Encounter.read user/Condition.read
MCP_ENV_FILE := .fhir-mcp.env

SEED_CLIENT_NAME := care-loop-seed
# Patient.read is required too: seed.ts's idempotency check does a GET.
SEED_SCOPES := openid offline_access api:fhir user/Patient.read user/Patient.write user/Observation.write user/Encounter.write user/Condition.write
SEED_ENV_FILE := .fhir-seed.env

.DEFAULT_GOAL := help

.PHONY: help build up watch down ps clean fhir seed

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

build: ## Build all stack images
	$(COMPOSE) build

up: ## Build and start the stack (incl. FHIR MCP bridge), then seed demo data
	$(COMPOSE) up -d --build
	$(MAKE) fhir
	$(MAKE) seed

fhir: ## (Re)mint the FHIR MCP bridge token and (re)start the bridge
	CLIENT_NAME=$(MCP_CLIENT_NAME) SCOPES="$(MCP_SCOPES)" ENV_FILE=$(MCP_ENV_FILE) ./scripts/bootstrap-fhir.sh
	$(COMPOSE) --profile fhir up -d

seed: ## (Re)mint the write-scoped seed token and load demo patient data
	CLIENT_NAME=$(SEED_CLIENT_NAME) SCOPES="$(SEED_SCOPES)" ENV_FILE=$(SEED_ENV_FILE) ./scripts/bootstrap-fhir.sh
	bun scripts/seed.ts

watch: ## Start the stack in the foreground and rebuild on change
	$(COMPOSE) up --build --watch

down: ## Stop and remove the stack containers (incl. FHIR MCP bridge)
	$(COMPOSE) --profile fhir down

ps: ## Show stack service status
	$(COMPOSE) --profile fhir ps

clean: ## Stop the stack, remove volumes and minted tokens
	$(COMPOSE) --profile fhir down -v
	rm -f $(MCP_ENV_FILE) $(SEED_ENV_FILE)
