# TODO

- Need to wire up WSO2 Agent Manager for care-loop-ai-service.
- fhir-sync only mirrors ehr-fhir-server -> care-loop-fhir-server, so Task/RiskAssessment resources care-loop-analysis-service writes to ehr-fhir-server never reconcile back into care-loop-fhir-server.
- care-loop-ai-service's /risk-assessment only returns a probability/risk enum today - needs explainable-AI reasoning plus references to the specific FHIR resources (via the MCP toolkit) it actually used, so front-desk-dashboard can show a real audit trail instead of just the Task's free-text description.
