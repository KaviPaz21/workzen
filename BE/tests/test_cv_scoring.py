import json

from app.agents.recruiteone.cv_scorer import build_cv_scoring_graph, finalize_score
from app.schemas.recruiteone.jd import Buckets, Weights
from app.schemas.recruiteone.scoring import BENCHMARK_LABELS, BenchmarkLlmResult, CvScoringLlmOutput, JdForScoring

BASE = "/api/v1/recruiteone/scoring/cv"


def jd_payload(weights=None):
    return {
        "name": "Senior Backend Engineer",
        "role": "Backend Engineer",
        "sector": "Information Technology",
        "level": "senior",
        "buckets": {"technical_skills": ["Python", "FastAPI"], "experience": ["5+ years"], "education": ["Bachelor's degree"]},
        "weights": weights or {},
    }


def test_scoring_endpoint_returns_overall_and_eight_benchmarks(client):
    response = client.post(
        BASE,
        files={"file": ("cv.txt", b"Python developer with FastAPI and 6 years of experience", "text/plain")},
        data={"jd": json.dumps(jd_payload())},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["overall_score"] == 80
    assert body["recommendation"] == "strong_match"
    assert [item["key"] for item in body["benchmarks"]] == list(BENCHMARK_LABELS)
    technical = body["benchmarks"][0]
    assert technical["applicable"] is True
    assert technical["reasoning"].startswith("Evidence found")
    assert body["benchmarks"][1]["applicable"] is False
    assert body["benchmarks"][1]["score"] == 0


def test_scoring_rejects_bad_payload_and_unreadable_files(client):
    bad_jd = client.post(BASE, files={"file": ("cv.txt", b"text", "text/plain")}, data={"jd": "not json"})
    assert bad_jd.status_code == 400
    empty = client.post(BASE, files={"file": ("cv.txt", b"   ", "text/plain")}, data={"jd": json.dumps(jd_payload())})
    assert empty.status_code == 400
    wrong_type = client.post(BASE, files={"file": ("cv.exe", b"binary", "application/octet-stream")}, data={"jd": json.dumps(jd_payload())})
    assert wrong_type.status_code == 400


def test_overall_score_uses_jd_weights_and_skips_benchmarks_the_jd_does_not_list():
    jd = JdForScoring(
        name="Role",
        role="Role",
        sector="Sector",
        level="mid",
        buckets=Buckets(technical_skills=["Python"], education=["Degree"], soft_skills=[]),
        weights=Weights(technical_skills=90, education=10, soft_skills=100),
    )
    scores = {"technical_skills": 100, "education": 0, "soft_skills": 40}
    output = CvScoringLlmOutput(
        benchmarks=[BenchmarkLlmResult(key=key, score=value, reasoning="r") for key, value in scores.items()],
        summary="s",
    )
    result = finalize_score({"jd": jd, "llm_output": output})["result"]
    assert result.overall_score == 90
    assert result.recommendation == "strong_match"
    soft = next(item for item in result.benchmarks if item.key == "soft_skills")
    assert soft.applicable is False and soft.score == 0


def test_zero_weights_fall_back_to_a_plain_average():
    jd = JdForScoring(
        name="Role",
        role="Role",
        sector="Sector",
        level="mid",
        buckets=Buckets(technical_skills=["Python"], education=["Degree"]),
        weights=Weights(technical_skills=0, education=0),
    )
    output = CvScoringLlmOutput(
        benchmarks=[
            BenchmarkLlmResult(key="technical_skills", score=80, reasoning="r"),
            BenchmarkLlmResult(key="education", score=40, reasoning="r"),
        ],
        summary="s",
    )
    assert finalize_score({"jd": jd, "llm_output": output})["result"].overall_score == 60


def test_scoring_graph_compiles():
    nodes = set(build_cv_scoring_graph().get_graph().nodes)
    assert {"score_benchmarks", "finalize_score"} <= nodes
