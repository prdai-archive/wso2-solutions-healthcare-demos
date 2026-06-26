from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the care-loop-heart-risk-service."""

    # protected_namespaces=() so the model_* field names below do not collide
    # with pydantic's reserved "model_" namespace.
    model_config = SettingsConfigDict(
        env_prefix="HEART_RISK_",
        env_file=".env",
        extra="ignore",
        protected_namespaces=(),
    )

    app_name: str = "care-loop-heart-risk-service"
    model_path: Path = Path("models/heart_watch_model.onnx")
    metrics_path: Path = Path("models/metrics.json")
    threshold: float = 0.5


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
