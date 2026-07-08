COMPOSE := docker compose
KIND_CLUSTER := openchoreo-migration
KUBE_CONTEXT := kind-$(KIND_CLUSTER)
KCTL := kubectl --context=$(KUBE_CONTEXT)

.DEFAULT_GOAL := help

.PHONY: help build up watch down ps clean seed trigger-vitals \
	up-compose down-compose ps-compose clean-compose watch-compose build-compose

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Deploy the full stack to OpenChoreo on a local kind cluster (primary path, see openchoreo/README.md)
	kind get clusters 2>/dev/null | grep -qx "$(KIND_CLUSTER)" || kind create cluster --name $(KIND_CLUSTER) --image kindest/node:v1.32.0
	./openchoreo/install.sh $(KUBE_CONTEXT)
	./openchoreo/deploy-components.sh $(KIND_CLUSTER) $(KUBE_CONTEXT)
	@echo "care-loop-ai-service needs a real openAiApiKey supplied out-of-band - see openchoreo/README.md."

down: ## Delete the OpenChoreo kind cluster
	kind delete cluster --name $(KIND_CLUSTER)

ps: ## Show OpenChoreo pod status across all namespaces
	$(KCTL) get pods -A

clean: down ## Alias for down (no persistent volumes to remove outside the cluster itself)

# docker-compose is kept as a fallback/dev path; seed and trigger-vitals are compose-only for
# now (they haven't been ported to target OpenChoreo-deployed services yet).
build-compose: ## Build all stack images (docker-compose fallback)
	$(COMPOSE) build

up-compose: ## Build and start the stack via docker-compose, then seed demo data (fallback)
	$(COMPOSE) up -d --build
	$(MAKE) seed

seed: ## Load demo patient data into apple-healthkit-simulator and ehr-fhir-server, then sync it into care-loop-fhir-server (docker-compose only)
	bun scripts/seed/index.ts
	$(COMPOSE) restart fhir-sync

watch-compose: ## Start the stack in the foreground and rebuild on change (docker-compose fallback)
	$(COMPOSE) up --build --watch

down-compose: ## Stop and remove the docker-compose stack containers (fallback)
	$(COMPOSE) down

ps-compose: ## Show docker-compose stack service status (fallback)
	$(COMPOSE) ps

clean-compose: ## Stop the docker-compose stack and remove volumes (fallback)
	$(COMPOSE) down -v

trigger-vitals: ## Force an immediate vitals-forward cycle instead of waiting for the automatic one
	@response=$$(curl -sS -w '\n%{http_code}' -X POST http://localhost:8000/vitals-cron/run-now); \
	body=$$(echo "$$response" | sed '$$d'); \
	status=$$(echo "$$response" | tail -n1); \
	if [ "$$status" = "200" ]; then echo "$$body" | jq .; else echo "request failed (HTTP $$status): $$body"; exit 1; fi
