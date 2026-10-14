# Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
#
# WSO2 LLC. licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

CLUSTER_NAME ?= clinic-rush
NAMESPACE ?= clinic-rush

.DEFAULT_GOAL := help

.PHONY: help up cluster deploy monitoring seed load status down stop clean

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: cluster deploy monitoring ## Create the cluster, deploy the stack, install monitoring

cluster: ## Create the k3d cluster (idempotent)
	bash scripts/cluster-up.sh

deploy: ## Apply the Postgres, FHIR server, and HPA manifests
	bash scripts/deploy.sh

monitoring: ## Install Prometheus, Grafana, and the metrics adapter
	bash scripts/monitoring-up.sh

seed: ## Seed the Synthea sample dataset into the FHIR server
	bash scripts/seed.sh

load: ## Run the k6 clinic-opening rush load test from the host
	bash scripts/load-test.sh

status: ## Show pods, services, and HPA state
	kubectl -n $(NAMESPACE) get pods,svc,hpa

down: ## Delete the k3d cluster
	bash scripts/cluster-down.sh delete

stop: ## Stop the k3d cluster (keep its data)
	bash scripts/cluster-down.sh stop

clean: ## Delete the k3d cluster and all its volumes
	k3d cluster delete $(CLUSTER_NAME)
