import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    # Instantiated without a context manager so the lifespan warm-up does not
    # run; get_model() still loads lazily on the first request from the
    # committed ONNX artifact under models/.
    return TestClient(app)
