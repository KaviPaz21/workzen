from app.agents.recruiteone.jd_decomposer import build_jd_decomposition_graph
from app.services.recruiteone.evaluation_service import build_jd_text


def test_jd_text_includes_buckets_and_weights():
    jd = {
        "name": "Head of Marketing",
        "role": "Marketing Director",
        "sector": "Marketing",
        "level": "executive",
        "buckets": {"experience": ["12+ years in marketing"], "technical_skills": []},
        "weights": {"experience": 95},
    }
    text = build_jd_text(jd)
    assert "Level: executive" in text
    assert "Experience (weight 95 out of 100):\n- 12+ years in marketing" in text
    assert "Technical skills (weight 50 out of 100):\n- none stated" in text


def test_decomposition_graph_compiles():
    graph = build_jd_decomposition_graph()
    assert "decompose_jd" in set(graph.get_graph().nodes)
