import json
from datetime import date, timedelta

BASE = "/api/v1/recruiteone"


def future_date():
    return (date.today() + timedelta(days=30)).isoformat()


def seed_vacancy(client, closing_date=None, collection_closed_at=None, token="tok123"):
    client.put(
        f"{BASE}/records/jds/jd-1",
        json={
            "name": "Backend",
            "role": "Backend Engineer",
            "sector": "IT",
            "level": "senior",
            "buckets": {"technical_skills": ["Python"]},
            "weights": {},
        },
    )
    client.put(
        f"{BASE}/records/vacancies/vac-1",
        json={
            "title": "Senior Backend Engineer",
            "jd_id": "jd-1",
            "share_token": token,
            "closing_date": closing_date or future_date(),
            "status": "open",
            "collection_closed_at": collection_closed_at,
        },
    )


def test_snapshot_is_empty_without_records(client):
    response = client.get(f"{BASE}/records")
    assert response.status_code == 200
    body = response.json()
    assert body["jds"] == []
    assert set(body) == {"jds", "vacancies", "candidates", "batches", "interviews", "scorecards", "interview_scores", "approvals"}


def test_save_list_and_delete_record(client):
    saved = client.put(f"{BASE}/records/jds/jd-1", json={"name": "Backend"})
    assert saved.status_code == 200
    assert saved.json() == {"name": "Backend", "id": "jd-1"}
    assert client.get(f"{BASE}/records").json()["jds"] == [{"name": "Backend", "id": "jd-1"}]
    client.put(f"{BASE}/records/jds/jd-1", json={"name": "Backend v2"})
    assert client.get(f"{BASE}/records").json()["jds"][0]["name"] == "Backend v2"
    assert client.delete(f"{BASE}/records/jds/jd-1").status_code == 204
    assert client.get(f"{BASE}/records").json()["jds"] == []


def test_unknown_collection_and_bad_id_are_rejected(client):
    assert client.put(f"{BASE}/records/secrets/x-1", json={}).status_code == 400
    assert client.put(f"{BASE}/records/jds/bad id", json={}).status_code == 400
    assert client.put(f"{BASE}/records/jds/jd-1", json={"id": "other"}).status_code == 400


def test_cv_file_round_trip(client):
    upload = client.put(f"{BASE}/files/cand-1", files={"file": ("cv.txt", b"Python developer", "text/plain")})
    assert upload.status_code == 204
    download = client.get(f"{BASE}/files/cand-1")
    assert download.status_code == 200
    assert download.content == b"Python developer"
    assert client.get(f"{BASE}/files/cand-9").status_code == 404


def test_cv_file_rejects_empty_and_unreadable(client):
    assert client.put(f"{BASE}/files/cand-1", files={"file": ("cv.txt", b"", "text/plain")}).status_code == 400
    assert client.put(f"{BASE}/files/cand-1", files={"file": ("cv.exe", b"abc", "application/octet-stream")}).status_code == 400


def test_public_vacancy_hides_internal_details(client):
    seed_vacancy(client)
    response = client.get(f"{BASE}/public/vacancies/tok123")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Senior Backend Engineer"
    assert body["accepting"] is True
    assert body["jd"]["role"] == "Backend Engineer"
    assert "pipeline" not in body
    assert client.get(f"{BASE}/public/vacancies/missing").status_code == 404


def test_application_creates_candidate_and_file(client):
    seed_vacancy(client)
    response = client.post(
        f"{BASE}/public/vacancies/tok123/applications",
        files={"file": ("cv.txt", b"Python developer with FastAPI", "text/plain")},
        data={"full_name": "Ada Lovelace", "email": "ada@example.com", "phone": "0123456", "application": json.dumps({"location": "London"})},
    )
    assert response.status_code == 201
    candidate_id = response.json()["id"]
    candidates = client.get(f"{BASE}/records").json()["candidates"]
    assert len(candidates) == 1
    assert candidates[0]["id"] == candidate_id
    assert candidates[0]["vacancy_ids"] == ["vac-1"]
    assert candidates[0]["batch_id"] is None
    assert candidates[0]["application"] == {"location": "London"}
    assert client.get(f"{BASE}/files/{candidate_id}").content == b"Python developer with FastAPI"


def test_application_rejected_when_closed(client):
    seed_vacancy(client, collection_closed_at="2026-01-01")
    response = client.post(
        f"{BASE}/public/vacancies/tok123/applications",
        files={"file": ("cv.txt", b"Python developer", "text/plain")},
        data={"full_name": "Ada", "email": "ada@example.com"},
    )
    assert response.status_code == 400
    assert client.get(f"{BASE}/records").json()["candidates"] == []


def test_application_rejected_after_closing_date(client):
    seed_vacancy(client, closing_date="2020-01-01")
    response = client.post(
        f"{BASE}/public/vacancies/tok123/applications",
        files={"file": ("cv.txt", b"Python developer", "text/plain")},
        data={"full_name": "Ada", "email": "ada@example.com"},
    )
    assert response.status_code == 400


def test_stored_cv_scoring(client):
    seed_vacancy(client)
    application = client.post(
        f"{BASE}/public/vacancies/tok123/applications",
        files={"file": ("cv.txt", b"Python developer with FastAPI", "text/plain")},
        data={"full_name": "Ada", "email": "ada@example.com"},
    )
    candidate_id = application.json()["id"]
    jd = {"name": "Backend", "role": "Backend Engineer", "sector": "IT", "level": "senior", "buckets": {"technical_skills": ["Python"]}, "weights": {}}
    response = client.post(f"{BASE}/scoring/candidates/{candidate_id}", json=jd)
    assert response.status_code == 200
    assert response.json()["overall_score"] == 100
    assert client.post(f"{BASE}/scoring/candidates/cand-none", json=jd).status_code == 404
