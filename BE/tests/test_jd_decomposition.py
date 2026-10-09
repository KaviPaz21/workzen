from fastapi.testclient import TestClient

from app.api import deps
from app.core.config import Settings
from app.main import create_app
from app.services.recruiteone.jd_service import JdDecomposerService
from tests.conftest import FailingDecompositionGraph

BASE = "/api/v1/recruiteone"


def test_decompose_returns_role_sector_level_and_buckets(client):
    response = client.post(f"{BASE}/jds/decompose", json={"name": "Backend", "text": "Python developer wanted"})
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "Backend Engineer"
    assert body["sector"] == "Information Technology"
    assert body["level"] == "senior"
    assert body["buckets"]["technical_skills"] == ["Python", "FastAPI"]
    assert body["buckets"]["certifications"] == []
    assert set(body["buckets"]) == {
        "technical_skills",
        "soft_skills",
        "experience",
        "responsibilities",
        "education",
        "certifications",
        "job_requirements",
        "extra_curricular",
    }


def test_decompose_rejects_empty_text(client):
    response = client.post(f"{BASE}/jds/decompose", json={"name": "Backend", "text": ""})
    assert response.status_code == 422


def test_decompose_reports_ai_failure_as_bad_gateway():
    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[deps.get_jd_decomposer] = lambda: JdDecomposerService(graph=FailingDecompositionGraph())
    response = TestClient(app).post(f"{BASE}/jds/decompose", json={"name": "Backend", "text": "Python developer"})
    assert response.status_code == 502
    assert "AI analysis failed" in response.json()["detail"]


def test_decompose_returns_503_when_foundry_is_not_configured():
    response = TestClient(create_app(Settings(_env_file=None))).post(
        f"{BASE}/jds/decompose", json={"name": "Backend", "text": "Python developer"}
    )
    assert response.status_code == 503
