BASE = "/api/v1/recruiteone"

PIPELINE = {
    "name": "Engineering hiring",
    "description": "Two steps",
    "stages": [
        {"id": "s1", "name": "HR screening", "max_candidates": 20, "interviewer_ids": ["p-001"]},
        {"id": "s2", "name": "Technical interview", "max_candidates": 5, "interviewer_ids": ["p-005"], "scheduled_date": "2030-02-10"},
    ],
}


def create_jd(client, jd_payload):
    return client.post(f"{BASE}/jds", json=jd_payload).json()["id"]


def test_vacancy_without_options_is_saved_as_open(client, jd_payload):
    jd_id = create_jd(client, jd_payload)
    response = client.post(f"{BASE}/vacancies", json={"title": "Backend Engineer", "jd_id": jd_id})
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "open"
    assert body["share_token"] is None
    assert body["pipeline"] is None


def test_shareable_vacancy_needs_closing_date_and_gets_a_link_token(client, jd_payload):
    jd_id = create_jd(client, jd_payload)
    missing = client.post(f"{BASE}/vacancies", json={"title": "Backend Engineer", "jd_id": jd_id, "shareable": True})
    assert missing.status_code == 400

    created = client.post(
        f"{BASE}/vacancies",
        json={"title": "Backend Engineer", "jd_id": jd_id, "shareable": True, "closing_date": "2030-01-31"},
    )
    assert created.status_code == 201
    assert len(created.json()["share_token"]) >= 8


def test_vacancy_stores_pipeline_stages(client, jd_payload):
    jd_id = create_jd(client, jd_payload)
    created = client.post(f"{BASE}/vacancies", json={"title": "Backend Engineer", "jd_id": jd_id, "pipeline": PIPELINE})
    assert created.status_code == 201
    stages = created.json()["pipeline"]["stages"]
    assert [stage["name"] for stage in stages] == ["HR screening", "Technical interview"]
    assert stages[1]["max_candidates"] == 5
    assert stages[1]["scheduled_date"] == "2030-02-10"
    assert stages[0]["scheduled_date"] is None


def test_pipeline_requires_at_least_one_stage(client, jd_payload):
    jd_id = create_jd(client, jd_payload)
    response = client.post(
        f"{BASE}/vacancies",
        json={"title": "Backend Engineer", "jd_id": jd_id, "pipeline": {"name": "Empty", "stages": []}},
    )
    assert response.status_code == 422
