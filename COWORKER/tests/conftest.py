import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

ORIGIN = "http://localhost:5173"


@pytest.fixture
def settings(tmp_path):
    return Settings(
        _env_file=None,
        coworker_workspace=str(tmp_path / "workspace"),
        coworker_token_file=str(tmp_path / "token"),
        coworker_headless=True,
        coworker_launch_apps=False,
        coworker_allowed_origins=[ORIGIN],
    )


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth(app):
    return {"Authorization": f"Bearer {app.state.token}", "Origin": ORIGIN}
