import json

import httpx

from app.config import Settings
from app.vitals import run_cycle

EXPECTED_PATIENT_COUNT = 2
EXPECTED_BUNDLE_ENTRIES = 1

PATIENTS = [
    {"id": 1, "mrn": "MRN-A", "fhir_patient_id": "fhir-patient-1"},
    {"id": 2, "mrn": "MRN-B", "fhir_patient_id": None},
]
PATIENT_1_SAMPLES = [
    {"quantity_type": "HKQuantityTypeIdentifierHeartRate", "value": 72, "start_date": "2026-06-24T07:00:00"},
    {"quantity_type": "HKQuantityTypeIdentifierStepCount", "value": 500, "start_date": "2026-06-24T07:00:00"},
]


def _handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/patients":
        return httpx.Response(200, json=PATIENTS)
    if request.url.path == "/quantity-samples":
        patient_id = request.url.params["patient_id"]
        samples = PATIENT_1_SAMPLES if patient_id == "1" else []
        return httpx.Response(200, json=samples)
    if request.url.path == "/fhir/r4" and request.method == "POST":
        return httpx.Response(200, json={"resourceType": "Bundle", "type": "transaction-response", "entry": []})
    return httpx.Response(404)


async def test_run_cycle_skips_patients_without_fhir_link() -> None:
    settings = Settings(healthkit_url="http://healthkit.test", fhir_server_url="http://fhir.test/fhir/r4")
    async with httpx.AsyncClient(transport=httpx.MockTransport(_handler)) as client:
        result = await run_cycle(settings, client=client)

    assert result.patients_processed == EXPECTED_PATIENT_COUNT
    assert result.patients_forwarded == 1
    assert result.readings_forwarded == 1


async def test_run_cycle_posts_a_transaction_bundle_of_observations() -> None:
    posted = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/fhir/r4" and request.method == "POST":
            posted["bundle"] = json.loads(request.content)
            return httpx.Response(200, json={"resourceType": "Bundle", "type": "transaction-response", "entry": []})
        return _handler(request)

    settings = Settings(healthkit_url="http://healthkit.test", fhir_server_url="http://fhir.test/fhir/r4")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        await run_cycle(settings, client=client)

    bundle = posted["bundle"]
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "transaction"
    assert len(bundle["entry"]) == EXPECTED_BUNDLE_ENTRIES
    observation = bundle["entry"][0]["resource"]
    assert observation["subject"] == {"reference": "Patient/fhir-patient-1"}
    assert observation["code"]["coding"][0]["code"] == "8867-4"
