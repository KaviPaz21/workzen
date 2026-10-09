from app.agents.recruiteone.graph import build_evaluation_graph


def test_evaluation_graph_has_expected_nodes():
    graph = build_evaluation_graph()
    nodes = set(graph.get_graph().nodes)
    assert {"extract_requirements", "profile_candidate", "score_match", "quality_check"} <= nodes
