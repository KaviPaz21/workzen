import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app import dialogs
from app.config import Settings
from app.main import create_app
from app.security import ask_user_to_pair, confirm_pairing

ORIGIN = "http://localhost:5173"


class Answers:
    def __init__(self, approve: bool = True):
        self.approve = approve
        self.asked: list[str] = []

    async def __call__(self, settings, origin):
        self.asked.append(origin)
        return self.approve


@pytest.fixture
def answers(app):
    answers = Answers()
    app.state.confirm_pairing = answers
    return answers


def test_pairing_hands_out_the_code_only_after_the_user_allows_it(client, app, answers):
    response = client.post("/pair", headers={"Origin": ORIGIN})
    assert response.status_code == 200
    token = response.json()["token"]
    assert answers.asked == [ORIGIN]
    assert client.get("/status", headers={"Authorization": f"Bearer {token}", "Origin": ORIGIN}).status_code == 200


def test_pairing_is_refused_when_the_user_says_no(client, answers):
    answers.approve = False
    response = client.post("/pair", headers={"Origin": ORIGIN})
    assert response.status_code == 403
    assert "token" not in response.text


def test_unknown_websites_never_get_a_question_or_a_code(client, answers):
    assert client.post("/pair", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/pair").status_code == 403
    assert answers.asked == []


def test_a_second_pairing_request_waits_for_the_first_question(settings):
    app = create_app(settings)
    release = asyncio.Event()

    async def slow_answer(_settings, _origin):
        await release.wait()
        return True

    app.state.confirm_pairing = slow_answer

    async def scenario():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
            first = asyncio.create_task(http.post("/pair", headers={"Origin": ORIGIN}))
            await asyncio.sleep(0.2)
            second = await http.post("/pair", headers={"Origin": ORIGIN})
            release.set()
            return second.status_code, (await first).status_code

    assert asyncio.run(scenario()) == (409, 200)


def test_disconnecting_replaces_the_code_and_closes_the_browser(client, app, answers):
    old = client.post("/pair", headers={"Origin": ORIGIN}).json()["token"]
    headers = {"Authorization": f"Bearer {old}", "Origin": ORIGIN}
    assert client.post("/unpair", headers=headers).json() == {"ok": True}
    assert client.get("/status", headers=headers).status_code == 401
    fresh = client.post("/pair", headers={"Origin": ORIGIN}).json()["token"]
    assert fresh != old
    assert app.state.settings.token_file.read_text(encoding="utf-8").strip() == fresh
    assert client.post("/unpair").status_code == 401


def test_the_question_names_the_website_and_defaults_to_no(monkeypatch):
    seen = {}

    def fake_ask(text, default_no=True):
        seen["text"] = text
        seen["default_no"] = default_no
        return True

    monkeypatch.setattr(dialogs, "ask", fake_ask)
    assert ask_user_to_pair("https://workzen.example.com") is True
    assert "workzen.example.com" in seen["text"]
    assert "ask you before every action" in seen["text"]
    assert seen["default_no"] is True


def test_the_question_can_be_switched_off_for_automated_runs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogs, "ask", lambda *args, **kwargs: pytest.fail("a dialog was shown"))
    quiet = Settings(_env_file=None, coworker_pairing_prompt=False, coworker_token_file=str(tmp_path / "t"))
    assert asyncio.run(confirm_pairing(quiet, ORIGIN)) is True
    assert Settings(_env_file=None).coworker_pairing_prompt is True
