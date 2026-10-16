import http.server
import threading

import pytest

APP = b"""<!DOCTYPE html><html><head><title>Demo app</title></head><body>
<h1>Contacts</h1>
<label for="name">Full name</label><input id="name" name="fullname" required>
<label for="pw">Password</label><input id="pw" type="password">
<label for="role">Role</label><select id="role"><option>Viewer</option><option>Editor</option></select>
<label><input type="checkbox" id="agree"> I agree</label>
<button id="hello" onclick="document.getElementById('out').textContent='Hello ' + document.getElementById('name').value">Greet</button>
<button id="save" onclick="document.getElementById('out').textContent='Saved'">Save contact</button>
<button id="del" onclick="document.getElementById('out').textContent='Deleted'">Delete contact</button>
<button id="boom" onclick="console.error('boom happened')">Break</button>
<p id="out">Nothing yet</p>
<div id="chat"><textarea id="chatbox" placeholder="Ask anything..."></textarea><button id="sendchat" onclick="document.getElementById('out').textContent='Chat: ' + document.getElementById('chatbox').value">Send message</button></div>
<form onsubmit="document.getElementById('out').textContent='Enquiry sent'; return false"><input name="who" placeholder="Your name"><input name="mail" placeholder="Email address"><button type="submit">Send enquiry</button></form>
<img src="/missing.png" alt="">
</body></html>"""


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        found = self.path == "/"
        self.send_response(200 if found else 404)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(APP if found else b"missing")

    def log_message(self, *args):
        return


@pytest.fixture
def app_site():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}/"
    server.shutdown()


def act(client, auth, name, args):
    return client.post(f"/actions/{name}", json={"args": args}, headers=auth).json()


@pytest.fixture
def opened(client, auth, app_site):
    result = act(client, auth, "browser_open", {"url": app_site})
    if not result["ok"] and "could not be started" in result["error"]:
        pytest.skip("Chrome is not available for the browser test")
    assert result["ok"], result
    yield
    act(client, auth, "browser_close", {})


def test_inspect_lists_tags_and_inputs_with_references(client, auth, opened):
    found = act(client, auth, "browser_inspect", {})["result"]
    by_label = {item.get("label"): item for item in found["items"]}
    assert by_label["Full name"]["tag"] == "input" and by_label["Full name"]["required"] is True
    assert by_label["Password"]["type"] == "password"
    assert by_label["Role"]["options"] == ["Viewer", "Editor"]
    assert by_label["Greet"]["tag"] == "button"
    assert all(item["ref"].startswith("e") for item in found["items"])
    inputs = act(client, auth, "browser_inspect", {"filter": "inputs"})["result"]
    assert {item["tag"] for item in inputs["items"]} <= {"input", "select", "textarea"}


def test_type_select_check_and_click_by_reference_and_text(client, auth, opened):
    items = act(client, auth, "browser_inspect", {})["result"]["items"]
    name_ref = next(item["ref"] for item in items if item.get("label") == "Full name")
    assert act(client, auth, "browser_type", {"target": name_ref, "text": "Ada"})["ok"]
    assert act(client, auth, "browser_select", {"target": "Role", "option": "Editor"})["ok"]
    assert act(client, auth, "browser_click", {"target": "I agree"})["ok"]
    clicked = act(client, auth, "browser_click", {"target": "Greet"})
    assert clicked["ok"] and "Hello Ada" in clicked["result"]["text"]
    verdict = act(
        client,
        auth,
        "browser_expect",
        {
            "checks": [
                {"kind": "text_visible", "value": "Hello Ada"},
                {"kind": "value_equals", "target": "Full name", "value": "Ada"},
                {"kind": "element_visible", "target": "Greet"},
                {"kind": "text_absent", "value": "Deleted"},
                {"kind": "title_contains", "value": "demo"},
                {"kind": "text_visible", "value": "this text is not there"},
            ]
        },
    )["result"]
    assert [item["passed"] for item in verdict["results"]] == [True, True, True, True, True, False]
    assert verdict["all_passed"] is False


def test_creating_needs_approval_and_deleting_is_refused(client, auth, opened):
    held = act(client, auth, "browser_click", {"target": "Save contact"})
    assert held["ok"] is False and held["needs_approval"]["label"].startswith("Save contact")
    assert "Saved" not in act(client, auth, "browser_read", {})["result"]["text"]

    allowed = act(client, auth, "browser_click", {"target": "Save contact", "allow_create": True})
    assert allowed["ok"] and "Saved" in allowed["result"]["text"]

    for allow in (False, True):
        refused = act(client, auth, "browser_click", {"target": "Delete contact", "allow_create": allow})
        assert refused["ok"] is False and "cannot delete" in refused["error"] and "needs_approval" not in refused
    assert "Deleted" not in act(client, auth, "browser_read", {})["result"]["text"]


def test_passwords_are_never_typed(client, auth, opened):
    refused = act(client, auth, "browser_type", {"target": "Password", "text": "secret"})
    assert refused["ok"] is False and "password" in refused["error"].lower()


def test_scroll_wait_hover_and_page_issues(client, auth, opened):
    assert act(client, auth, "browser_hover", {"target": "Greet"})["ok"]
    assert act(client, auth, "browser_scroll", {"direction": "down"})["result"]["scroll"]["max"] >= 0
    assert act(client, auth, "browser_wait", {"seconds": 0.2})["ok"]
    assert act(client, auth, "browser_wait", {"text": "never appears", "seconds": 1})["ok"] is False
    act(client, auth, "browser_click", {"target": "Break"})
    issues = act(client, auth, "browser_issues", {})["result"]
    text = " ".join(issues["issues"])
    assert "boom happened" in text and "404" in text
    assert act(client, auth, "browser_issues", {})["result"]["count"] == 0


def test_the_visible_cursor_follows_the_mouse(client, auth, opened):
    act(client, auth, "browser_click", {"target": "Greet"})
    assert act(client, auth, "browser_expect", {"checks": [{"kind": "text_visible", "value": "Hello"}]})["ok"]


def test_chat_boxes_can_be_used_without_approval(client, auth, opened):
    typed = act(client, auth, "browser_type", {"target": "Ask anything...", "text": "Hello bot", "submit": True})
    assert typed["ok"], typed
    sent = act(client, auth, "browser_click", {"target": "Send message"})
    assert sent["ok"] and "Chat: Hello bot" in sent["result"]["text"]


def test_a_real_form_still_needs_approval_to_send(client, auth, opened):
    held = act(client, auth, "browser_click", {"target": "Send enquiry"})
    assert held["ok"] is False and held["needs_approval"]["effect"] == "create"
    held_enter = act(client, auth, "browser_type", {"target": "Email address", "text": "a@b.c", "submit": True})
    assert held_enter["ok"] is False and "needs_approval" in held_enter
    allowed = act(client, auth, "browser_click", {"target": "Send enquiry", "allow_create": True})
    assert allowed["ok"] and "Enquiry sent" in allowed["result"]["text"]