import json

from app.agents.recruiteone.cv_scorer import build_cv_scoring_graph, finalize_score
from app.agents.recruiteone.grade_points import checklist_grade_point, experience_grade_point
from app.schemas.recruiteone.jd import Buckets, Weights
from app.schemas.recruiteone.scoring import (
    BENCHMARK_LABELS,
    AlternativeMatch,
    BenchmarkLlmResult,
    CvScoringLlmOutput,
    JdForScoring,
    RequirementCheck,
)

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


def result_for(key, matched=(), alternatives=(), required_months=0, available_months=0):
    return BenchmarkLlmResult(
        key=key,
        checks=[RequirementCheck(requirement=f"item {number}", matched=hit) for number, hit in enumerate(matched, start=1)],
        alternatives=[AlternativeMatch(name=f"alternative {number}", relevance=value) for number, value in enumerate(alternatives, start=1)],
        required_months=required_months,
        available_months=available_months,
        reasoning="r",
    )


def finalize(jd, results):
    output = CvScoringLlmOutput(benchmarks=results, summary="s")
    return finalize_score({"jd": jd, "llm_output": output})["result"]


def jd_with(buckets, weights=None):
    return JdForScoring(name="Role", role="Role", sector="Sector", level="mid", buckets=buckets, weights=weights or Weights())


def benchmark(result, key):
    return next(item for item in result.benchmarks if item.key == key)


def test_scoring_endpoint_returns_overall_and_eight_benchmarks(client):
    response = client.post(
        BASE,
        files={"file": ("cv.txt", b"Python developer with FastAPI and 6 years of experience", "text/plain")},
        data={"jd": json.dumps(jd_payload())},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["overall_score"] == 100
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


def test_checklist_grade_point_gives_required_items_more_credit_than_alternatives():
    assert checklist_grade_point([True, True], []) == 4.0
    assert checklist_grade_point([True, False], []) == 2.0
    assert checklist_grade_point([False], [90]) == 1.6
    assert checklist_grade_point([True], [50]) == (10 + 4) / 4.5
    assert checklist_grade_point([], []) == 0.0


def test_experience_grade_point_is_continuous_below_the_requirement():
    assert experience_grade_point(0, 0) == 4.0
    assert experience_grade_point(12, 12) == 4.0
    assert experience_grade_point(12, 30) == 4.0
    assert experience_grade_point(12, 6) == 2.25
    assert experience_grade_point(12, 0) == 0.5


def test_benchmark_scores_come_from_grade_points_and_overall_uses_jd_weights():
    jd = jd_with(
        Buckets(technical_skills=["Python"], education=["Degree"], soft_skills=[]),
        Weights(technical_skills=90, education=10, soft_skills=100),
    )
    result = finalize(
        jd,
        [
            result_for("technical_skills", matched=[True], alternatives=[50]),
            result_for("education", matched=[False], alternatives=[90]),
            result_for("soft_skills", matched=[True]),
        ],
    )
    assert benchmark(result, "technical_skills").score == 78
    assert benchmark(result, "education").score == 40
    assert result.overall_score == 74
    assert result.recommendation == "potential_match"
    soft = benchmark(result, "soft_skills")
    assert soft.applicable is False and soft.score == 0


def test_alternatives_are_ignored_for_benchmarks_that_do_not_allow_them():
    jd = jd_with(Buckets(soft_skills=["Teamwork"]))
    result = finalize(jd, [result_for("soft_skills", matched=[False], alternatives=[100])])
    assert benchmark(result, "soft_skills").score == 0


def test_missing_checks_count_as_not_matched():
    jd = jd_with(Buckets(responsibilities=["Design APIs", "Lead a team"]))
    result = finalize(jd, [result_for("responsibilities", matched=[True])])
    assert benchmark(result, "responsibilities").score == 50


def test_extra_curricular_achievements_always_earn_full_grade():
    jd = jd_with(Buckets(extra_curricular=["Team captain"]))
    result = finalize(jd, [result_for("extra_curricular", matched=[False], alternatives=[10, 20])])
    assert benchmark(result, "extra_curricular").score == 62


def test_experience_uses_months_not_a_checklist():
    jd = jd_with(Buckets(experience=["1 year of backend work"]))
    result = finalize(jd, [result_for("experience", required_months=12, available_months=6)])
    assert benchmark(result, "experience").score == 56


def test_zero_weights_fall_back_to_a_plain_average():
    jd = jd_with(Buckets(technical_skills=["Python"], education=["Degree"]), Weights(technical_skills=0, education=0))
    result = finalize(jd, [result_for("technical_skills", matched=[True]), result_for("education", matched=[False])])
    assert result.overall_score == 50


def test_unreturned_benchmark_scores_zero_with_a_fallback_reason():
    jd = jd_with(Buckets(technical_skills=["Python"]))
    result = finalize(jd, [])
    technical = benchmark(result, "technical_skills")
    assert technical.score == 0 and technical.applicable is True
    assert technical.reasoning.startswith("The AI did not return")


def test_scoring_graph_compiles():
    nodes = set(build_cv_scoring_graph().get_graph().nodes)
    assert {"score_benchmarks", "finalize_score"} <= nodes
