from datetime import date

from sqlmodel import Field, SQLModel

from app.models.base import RecordIdentity


class PatientBase(SQLModel):
    mrn: str = Field(index=True, unique=True, description="Medical record number shared with OpenEMR.")
    given_name: str = Field(description="Patient given (first) name.")
    family_name: str = Field(description="Patient family (last) name.")
    date_of_birth: date | None = Field(default=None, description="Patient date of birth.")
    # OpenEMR's FHIR Patient create ignores submitted identifiers and assigns its
    # own, so this is the only durable link back to the matching OpenEMR record.
    openemr_patient_uuid: str | None = Field(default=None, index=True, description="Matching OpenEMR FHIR Patient id.")


class Patient(PatientBase, RecordIdentity, table=True):
    __tablename__ = "patient"


class PatientCreate(PatientBase):
    pass


class PatientRead(PatientBase, RecordIdentity):
    pass
