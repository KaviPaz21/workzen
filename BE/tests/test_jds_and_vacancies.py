BASE = "/api/v1/recruiteone"


def test_jd_crud(client, jd_payload):
    created = client.post(f"{BASE}/jds", json=jd_payload)
    assert created.status_code == 201
    jd_id = created.json()["id"]

    assert client.get(f"{BASE}/jds").json()[0]["id"] == jd_id

    updated = client.patch(f"{BASE}/jds/{jd_id}", json={"weights": {"technical_skills": 90}})
    assert updated.status_code == 200
    assert updated.json()["weights"]["technical_skills"] == 90
    assert updated.json()["weights"]["education"] == 50
    assert updated.json()["name"] == jd_payload["name"]


def test_new_jd_defaults_to_equal_weights(client, jd_payload):
    jd_payload.pop("weights")
    body = client.post(f"{BASE}/jds", json=jd_payload).json()
    assert set(body["weights"].values()) == {50}
    assert body["status"] == "active"


def test_delete_jd_is_soft_and_restorable(client, jd_payload):
    jd_id = client.post(f"{BASE}/jds", json=jd_payload).json()["id"]

    assert client.delete(f"{BASE}/jds/{jd_id}").status_code == 204
    assert client.get(f"{BASE}/jds/{jd_id}").json()["status"] == "deleted"

    restored = client.patch(f"{BASE}/jds/{jd_id}", json={"status": "active"})
    assert restored.json()["status"] == "active"


def test_vacancy_requires_existing_jd(client):
    payload = {"title": "Backend Engineer", "jd_id": "missing", "department": "Engineering"}
    response = client.post(f"{BASE}/vacancies", json=payload)
    assert response.status_code == 400


def test_vacancy_create_and_update(client, jd_payload):
    jd_id = client.post(f"{BASE}/jds", json=jd_payload).json()["id"]
    payload = {"title": "Backend Engineer", "jd_id": jd_id, "department": "Engineering", "closing_date": "2026-12-31"}
    created = client.post(f"{BASE}/vacancies", json=payload)
    assert created.status_code == 201
    vacancy_id = created.json()["id"]

    updated = client.patch(f"{BASE}/vacancies/{vacancy_id}", json={"status": "open"})
    assert updated.json()["status"] == "open"
    assert updated.json()["closing_date"] == "2026-12-31"
