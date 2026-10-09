BASE = "/api/v1/recruiteone"


def upload_cv(client, name="Nimal Perera", content=b"Nimal Perera. Python developer with 6 years of experience."):
    return client.post(
        f"{BASE}/cv-pool",
        files={"file": ("nimal_cv.txt", content, "text/plain")},
        data={"full_name": name, "email": "nimal@example.com"},
    )


def test_upload_cv_stores_blob_and_hides_cv_text(client, blob_storage):
    response = upload_cv(client)
    assert response.status_code == 201
    body = response.json()
    assert body["full_name"] == "Nimal Perera"
    assert "cv_text" not in body
    assert body["blob_name"] in blob_storage.blobs


def test_upload_rejects_unsupported_file(client):
    response = client.post(f"{BASE}/cv-pool", files={"file": ("cv.exe", b"binary", "application/octet-stream")})
    assert response.status_code == 400


def test_delete_candidate_removes_blob(client, blob_storage):
    body = upload_cv(client).json()
    assert client.delete(f"{BASE}/cv-pool/{body['id']}").status_code == 204
    assert body["blob_name"] not in blob_storage.blobs


def test_evaluation_flow_and_dashboard(client, jd_payload):
    jd_id = client.post(f"{BASE}/jds", json=jd_payload).json()["id"]
    vacancy = client.post(
        f"{BASE}/vacancies",
        json={"title": "Backend Engineer", "jd_id": jd_id, "department": "Engineering", "status": "open"},
    ).json()
    candidate = upload_cv(client).json()

    response = client.post(
        f"{BASE}/evaluations", json={"vacancy_id": vacancy["id"], "candidate_ids": [candidate["id"]]}
    )
    assert response.status_code == 200
    evaluation = response.json()[0]
    assert evaluation["status"] == "completed"
    assert evaluation["result"]["overall_score"] == 100
    assert evaluation["quality"]["groundedness"] == 4.0

    summary = client.get(f"{BASE}/dashboard/summary").json()
    assert summary["open_vacancies"] == 1
    assert summary["active_jds"] == 1
    assert summary["candidates_in_pool"] == 1
    assert summary["evaluations_completed"] == 1
    assert summary["average_match_score"] == 100.0
    assert summary["recommendation_breakdown"]["strong_match"] == 1


def test_evaluation_unknown_vacancy_returns_404(client):
    response = client.post(f"{BASE}/evaluations", json={"vacancy_id": "missing", "candidate_ids": ["x"]})
    assert response.status_code == 404
