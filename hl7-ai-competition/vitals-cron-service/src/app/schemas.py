from datetime import datetime

from pydantic import BaseModel


class CycleResult(BaseModel):
    """Summary of one hourly forward cycle."""

    ran_at: datetime
    window_start: datetime
    window_end: datetime
    patients_processed: int
    patients_forwarded: int
    readings_forwarded: int
