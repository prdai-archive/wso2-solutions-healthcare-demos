from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for vitals-cron-service."""

    model_config = SettingsConfigDict(env_prefix="VITALS_CRON_", env_file=".env", extra="ignore")

    app_name: str = "vitals-cron-service"
    healthkit_url: str = "http://apple-healthkit-simulator:8000"
    fhir_server_url: str = "http://fhir-server:9090/fhir/r4"
    interval_hours: int = 1


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
