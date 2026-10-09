from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_health_reports_service_configuration(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert set(body["services"]) == {"cosmos_db", "blob_storage", "ai_foundry"}


def test_data_endpoints_return_503_when_cosmos_is_not_configured():
    bare_client = TestClient(create_app(Settings(_env_file=None)))
    response = bare_client.get("/api/v1/recruiteone/jds")
    assert response.status_code == 503
