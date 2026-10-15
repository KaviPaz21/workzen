from docx import Document


def act(client, auth, name, args):
    return client.post(f"/actions/{name}", json={"args": args}, headers=auth).json()


def test_ping_needs_no_pairing_code_but_status_does(client, auth):
    assert client.get("/ping").json()["name"] == "workzen-coworker"
    assert client.get("/status").status_code == 401
    assert client.get("/status", headers={"Authorization": "Bearer wrong"}).status_code == 401
    status = client.get("/status", headers=auth).json()
    assert "create_word_document" in status["actions"] and "browser_open" in status["actions"]
    assert status["launch_apps"] is False


def test_token_is_created_once_and_reused(settings):
    from app.main import create_app

    first = create_app(settings).state.token
    assert create_app(settings).state.token == first
    assert len(first) >= 20


def test_other_websites_are_refused_even_with_the_right_code(client, app):
    headers = {"Authorization": f"Bearer {app.state.token}", "Origin": "https://evil.example"}
    assert client.get("/status", headers=headers).status_code == 403
    assert client.post("/actions/list_files", json={"args": {}}, headers=headers).status_code == 403


def test_cors_preflight_allows_only_the_workzen_origin_and_private_network(client):
    allowed = client.options(
        "/status",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization", "Access-Control-Request-Private-Network": "true"},
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert allowed.headers["access-control-allow-private-network"] == "true"
    refused = client.options("/status", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in refused.headers


def test_unknown_actions_and_bad_arguments_are_reported(client, auth):
    assert client.post("/actions/format_disk", json={"args": {}}, headers=auth).status_code == 404
    bad = act(client, auth, "write_text_file", {"filename": "a.txt"})
    assert bad["ok"] is False and "not valid" in bad["error"]


def test_word_document_is_created_in_the_workspace(client, auth, settings):
    blocks = [
        {"type": "paragraph", "text": "Dear Ms Perera,"},
        {"type": "paragraph", "text": "Thank you for the opportunity."},
        {"type": "bullet", "text": "Point one"},
        {"type": "heading", "text": "Next steps"},
    ]
    result = act(client, auth, "create_word_document", {"filename": "Thank you letter", "title": "Letter", "blocks": blocks, "open_after": True})
    assert result["ok"] is True
    assert result["result"]["filename"] == "Thank you letter.docx"
    assert result["result"]["opened"] is False
    document = Document(settings.workspace / "Thank you letter.docx")
    assert [p.text for p in document.paragraphs][:3] == ["Letter", "Dear Ms Perera,", "Thank you for the opportunity."]


def test_existing_files_are_never_overwritten(client, auth, settings):
    blocks = [{"type": "paragraph", "text": "one"}]
    first = act(client, auth, "create_word_document", {"filename": "memo.docx", "blocks": blocks})
    second = act(client, auth, "create_word_document", {"filename": "memo.docx", "blocks": blocks})
    assert first["result"]["filename"] == "memo.docx"
    assert second["result"]["filename"] == "memo (2).docx"


def test_file_names_cannot_escape_the_workspace(client, auth, settings):
    for name in ["..\\..\\evil.txt", "../evil.txt", "C:\\Windows\\evil.txt", "sub/evil.txt", "..", "bad|name.txt"]:
        result = act(client, auth, "write_text_file", {"filename": name, "content": "x"})
        assert result["ok"] is False, name
    assert not (settings.workspace.parent / "evil.txt").exists()
    assert list(settings.workspace.glob("*")) == []


def test_text_files_can_be_written_read_and_listed(client, auth):
    written = act(client, auth, "write_text_file", {"filename": "notes.md", "content": "# Notes\nhello"})
    assert written["ok"] is True
    assert act(client, auth, "read_text_file", {"filename": "notes.md"})["result"]["text"] == "# Notes\nhello"
    listing = act(client, auth, "list_files", {})["result"]
    assert [item["name"] for item in listing["files"]] == ["notes.md"]
    assert act(client, auth, "write_text_file", {"filename": "run.exe", "content": "x"})["ok"] is False
    assert act(client, auth, "read_text_file", {"filename": "missing.txt"})["ok"] is False


def test_only_web_addresses_can_be_opened_and_apps_can_be_switched_off(client, auth):
    assert act(client, auth, "open_in_default_browser", {"url": "file:///C:/Windows/system.ini"})["ok"] is False
    assert act(client, auth, "open_in_default_browser", {"url": "javascript:alert(1)"})["ok"] is False
    allowed = act(client, auth, "open_in_default_browser", {"url": "https://example.com"})
    assert allowed["ok"] is True and allowed["result"]["opened"] is False
    act(client, auth, "write_text_file", {"filename": "a.txt", "content": "x"})
    assert act(client, auth, "open_file", {"filename": "a.txt"})["result"]["opened"] is False
    assert act(client, auth, "open_file", {"filename": "nope.txt"})["ok"] is False
