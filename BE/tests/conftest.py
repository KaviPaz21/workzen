from dataclasses import dataclass, field

import pytest
from fastapi.testclient import TestClient

from app.agents.recruiteone.graph import get_evaluation_graph
from app.api import deps
from app.core.config import Settings
from app.main import create_app
from app.schemas.recruiteone.evaluation import MatchResult, QualityScores
from app.schemas.recruiteone.jd import Buckets, JdDecomposition
from app.schemas.recruiteone.scoring import BENCHMARK_LABELS, BenchmarkLlmResult, CvScoringLlmOutput
from app.services.recruiteone.cv_scoring_service import CvScoringService
from app.services.recruiteone.jd_service import JdDecomposerService


@dataclass
class FakeRepository:
    items: dict = field(default_factory=dict)

    async def create(self, item):
        self.items[item["id"]] = item
        return item

    async def get(self, item_id):
        return self.items.get(item_id)

    async def list_all(self, limit=100):
        ordered = sorted(self.items.values(), key=lambda item: item["created_at"], reverse=True)
        return ordered[:limit]

    async def count(self, status=None):
        return len([item for item in self.items.values() if status is None or item.get("status") == status])

    async def replace(self, item_id, item):
        self.items[item_id] = item
        return item

    async def delete(self, item_id):
        return self.items.pop(item_id, None) is not None


@dataclass
class FakeRecordRepository:
    items: dict = field(default_factory=dict)

    async def list_all(self):
        return list(self.items.values())

    async def get(self, collection, item_id):
        return self.items.get((collection, item_id))

    async def upsert(self, item):
        self.items[(item["collection"], item["id"])] = item
        return item

    async def delete(self, collection, item_id):
        return self.items.pop((collection, item_id), None) is not None

    async def find_vacancy_by_token(self, token):
        for (collection, _), item in self.items.items():
            if collection == "vacancies" and item.get("share_token") == token:
                return item
        return None


@dataclass
class FakeBlobStorage:
    blobs: dict = field(default_factory=dict)

    async def upload(self, blob_name, data, content_type):
        self.blobs[blob_name] = data
        return blob_name

    async def download(self, blob_name):
        return self.blobs[blob_name]

    async def fetch(self, blob_name):
        if blob_name not in self.blobs:
            return None
        return self.blobs[blob_name], "text/plain"

    async def delete(self, blob_name):
        self.blobs.pop(blob_name, None)


class FakeDecompositionGraph:
    async def ainvoke(self, state):
        decomposition = JdDecomposition(
            role="Backend Engineer",
            sector="Information Technology",
            level="senior",
            buckets=Buckets(
                technical_skills=["Python", "FastAPI"],
                experience=["5+ years of backend development"],
                education=["Bachelor's degree in computer science"],
            ),
        )
        return {"decomposition": decomposition}


class FakeScoringGraph:
    async def ainvoke(self, state):
        from app.agents.recruiteone.cv_scorer import finalize_score

        output = CvScoringLlmOutput(
            benchmarks=[BenchmarkLlmResult(key=key, score=80, reasoning=f"Evidence found for {label}.") for key, label in BENCHMARK_LABELS.items()],
            summary="Good overall fit.",
        )
        return finalize_score({"jd": state["jd"], "llm_output": output})


class FailingDecompositionGraph:
    async def ainvoke(self, state):
        raise RuntimeError("model unavailable")


class FakeGraph:
    async def ainvoke(self, state):
        match = MatchResult(
            overall_score=130,
            skills_score=88,
            experience_score=80,
            education_score=75,
            strengths=["Strong Python background"],
            gaps=["No people management experience"],
            summary="Solid fit for the role.",
            recommendation="strong_match",
        )
        return {"match": match, "quality": QualityScores(relevance=4.0, coherence=5.0, groundedness=4.0)}


@pytest.fixture
def repositories():
    return {
        "jds": FakeRepository(),
        "vacancies": FakeRepository(),
        "candidates": FakeRepository(),
        "evaluations": FakeRepository(),
    }


@pytest.fixture
def record_repository():
    return FakeRecordRepository()


@pytest.fixture
def blob_storage():
    return FakeBlobStorage()


@pytest.fixture
def client(repositories, blob_storage, record_repository):
    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[deps.get_jd_repository] = lambda: repositories["jds"]
    app.dependency_overrides[deps.get_vacancy_repository] = lambda: repositories["vacancies"]
    app.dependency_overrides[deps.get_candidate_repository] = lambda: repositories["candidates"]
    app.dependency_overrides[deps.get_evaluation_repository] = lambda: repositories["evaluations"]
    app.dependency_overrides[deps.get_record_repository] = lambda: record_repository
    app.dependency_overrides[deps.get_blob_storage] = lambda: blob_storage
    app.dependency_overrides[get_evaluation_graph] = lambda: FakeGraph()
    app.dependency_overrides[deps.get_jd_decomposer] = lambda: JdDecomposerService(graph=FakeDecompositionGraph())
    app.dependency_overrides[deps.get_cv_scorer] = lambda: CvScoringService(graph=FakeScoringGraph(), max_upload_bytes=1024 * 1024)
    return TestClient(app)


@pytest.fixture
def jd_payload():
    return {
        "name": "Senior Backend Engineer",
        "role": "Backend Engineer",
        "sector": "Information Technology",
        "level": "senior",
        "raw_text": "We need a senior backend engineer with Python and FastAPI.",
        "buckets": {
            "technical_skills": ["Python", "FastAPI"],
            "experience": ["5+ years Python"],
            "responsibilities": ["Design APIs"],
        },
        "weights": {"technical_skills": 80, "education": 20},
    }
