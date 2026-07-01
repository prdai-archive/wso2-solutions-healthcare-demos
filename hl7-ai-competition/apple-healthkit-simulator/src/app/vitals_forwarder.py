from datetime import UTC, datetime, timedelta

import httpx
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import Settings
from app.models import Patient, QuantitySample

# LOINC code, display text, and UCUM unit code per HealthKit quantity type this
# module forwards as a FHIR Observation.
VITALS_OBSERVATION_CODES = {
    "HKQuantityTypeIdentifierHeartRate": ("8867-4", "Heart rate", "beats/minute", "/min"),
    "HKQuantityTypeIdentifierOxygenSaturation": ("59408-5", "Oxygen saturation by pulse oximetry", "%", "%"),
    "HKQuantityTypeIdentifierRespiratoryRate": ("9279-1", "Respiratory rate", "breaths/minute", "/min"),
    "HKQuantityTypeIdentifierBloodPressureSystolic": ("8480-6", "Systolic blood pressure", "mmHg", "mm[Hg]"),
    "HKQuantityTypeIdentifierBloodPressureDiastolic": ("8462-4", "Diastolic blood pressure", "mmHg", "mm[Hg]"),
}


class CycleResult(BaseModel):
    """Summary of one hourly forward cycle."""

    ran_at: datetime
    window_start: datetime
    window_end: datetime
    patients_processed: int
    patients_forwarded: int
    readings_forwarded: int


def fetch_recent_vitals(session: Session, patient_id: int, since: datetime, until: datetime) -> list[QuantitySample]:
    statement = (
        select(QuantitySample)
        .where(QuantitySample.patient_id == patient_id)
        .where(QuantitySample.start_date >= since)
        .where(QuantitySample.start_date < until)
    )
    return [s for s in session.exec(statement).all() if s.quantity_type in VITALS_OBSERVATION_CODES]


def _as_observation(reading: QuantitySample, fhir_patient_id: str) -> dict:
    code, display, unit, ucum_code = VITALS_OBSERVATION_CODES[reading.quantity_type]
    category_system = "http://terminology.hl7.org/CodeSystem/observation-category"
    return {
        "resourceType": "Observation",
        "status": "final",
        "category": [{"coding": [{"system": category_system, "code": "vital-signs"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": code, "display": display}]},
        "subject": {"reference": f"Patient/{fhir_patient_id}"},
        "effectiveDateTime": reading.start_date.isoformat(),
        "valueQuantity": {
            "value": reading.value,
            "unit": unit,
            "system": "http://unitsofmeasure.org",
            "code": ucum_code,
        },
    }


def _as_transaction_bundle(readings: list[QuantitySample], fhir_patient_id: str) -> dict:
    return {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [
            {"resource": _as_observation(reading, fhir_patient_id), "request": {"method": "POST", "url": "Observation"}}
            for reading in readings
        ],
    }


async def run_cycle(settings: Settings, session: Session, client: httpx.AsyncClient | None = None) -> CycleResult:
    """Forward every patient's vitals from the last interval to fhir-server as Observations."""
    ran_at = datetime.now(UTC)
    window_end = ran_at.replace(tzinfo=None)
    window_start = window_end - timedelta(hours=settings.vitals_forward_interval_hours)

    patients = list(session.exec(select(Patient)).all())
    readings_forwarded = 0
    patients_forwarded = 0

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=30)
    try:
        for patient in patients:
            if not patient.fhir_patient_id:
                continue

            readings = fetch_recent_vitals(session, patient.id, window_start, window_end)
            if not readings:
                continue

            bundle = _as_transaction_bundle(readings, patient.fhir_patient_id)
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
