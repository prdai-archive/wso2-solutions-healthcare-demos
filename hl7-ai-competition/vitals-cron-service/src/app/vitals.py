from datetime import UTC, datetime, timedelta

import httpx

from app.config import Settings
from app.schemas import CycleResult

# LOINC code, display text, and UCUM unit code per HealthKit quantity type this
# service forwards as a FHIR Observation.
VITALS_OBSERVATION_CODES = {
    "HKQuantityTypeIdentifierHeartRate": ("8867-4", "Heart rate", "beats/minute", "/min"),
    "HKQuantityTypeIdentifierOxygenSaturation": ("59408-5", "Oxygen saturation by pulse oximetry", "%", "%"),
    "HKQuantityTypeIdentifierRespiratoryRate": ("9279-1", "Respiratory rate", "breaths/minute", "/min"),
    "HKQuantityTypeIdentifierBloodPressureSystolic": ("8480-6", "Systolic blood pressure", "mmHg", "mm[Hg]"),
    "HKQuantityTypeIdentifierBloodPressureDiastolic": ("8462-4", "Diastolic blood pressure", "mmHg", "mm[Hg]"),
}


async def fetch_patients(client: httpx.AsyncClient, healthkit_url: str) -> list[dict]:
    response = await client.get(f"{healthkit_url}/patients", params={"limit": 1000})
    response.raise_for_status()
    return response.json()


async def fetch_recent_vitals(
    client: httpx.AsyncClient, healthkit_url: str, patient_id: int, since: datetime, until: datetime
) -> list[dict]:
    response = await client.get(
        f"{healthkit_url}/quantity-samples",
        params={"patient_id": patient_id, "since": since.isoformat(), "until": until.isoformat(), "limit": 1000},
    )
    response.raise_for_status()
    return [sample for sample in response.json() if sample["quantity_type"] in VITALS_OBSERVATION_CODES]


def _as_observation(reading: dict, fhir_patient_id: str) -> dict:
    code, display, unit, ucum_code = VITALS_OBSERVATION_CODES[reading["quantity_type"]]
    category_system = "http://terminology.hl7.org/CodeSystem/observation-category"
    return {
        "resourceType": "Observation",
        "status": "final",
        "category": [{"coding": [{"system": category_system, "code": "vital-signs"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": code, "display": display}]},
        "subject": {"reference": f"Patient/{fhir_patient_id}"},
        "effectiveDateTime": reading["start_date"],
        "valueQuantity": {
            "value": reading["value"],
            "unit": unit,
            "system": "http://unitsofmeasure.org",
            "code": ucum_code,
        },
    }


def _as_transaction_bundle(readings: list[dict], fhir_patient_id: str) -> dict:
    return {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
            {"resource": _as_observation(reading, fhir_patient_id), "request": {"method": "POST", "url": "Observation"}}
            for reading in readings
        ],
    }


async def run_cycle(settings: Settings, client: httpx.AsyncClient | None = None) -> CycleResult:
    """Forward every patient's vitals from the last interval_hours to fhir-server as Observations."""
    ran_at = datetime.now(UTC)
    window_end = ran_at
    window_start = window_end - timedelta(hours=settings.interval_hours)

    readings_forwarded = 0
    patients_forwarded = 0

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=30)
    try:
        patients = await fetch_patients(client, settings.healthkit_url)

        for patient in patients:
            fhir_patient_id = patient.get("fhir_patient_id")
            if not fhir_patient_id:
                continue

            readings = await fetch_recent_vitals(
                client, settings.healthkit_url, patient["id"], window_start, window_end
            )
            if not readings:
                continue

            bundle = _as_transaction_bundle(readings, fhir_patient_id)
            response = await client.post(settings.fhir_server_url, json=bundle)
            response.raise_for_status()

            readings_forwarded += len(readings)
            patients_forwarded += 1
    finally:
        if owns_client:
            await client.aclose()

    return CycleResult(
        ran_at=ran_at,
        window_start=window_start,
        window_end=window_end,
        patients_processed=len(patients),
        patients_forwarded=patients_forwarded,
        readings_forwarded=readings_forwarded,
    )
