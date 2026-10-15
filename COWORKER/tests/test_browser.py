import http.server
import os
import threading

import pytest

PAGE = b"""<!DOCTYPE html><html><head><title>Test shop</title></head><body>
<h1>Welcome to the test shop</h1>
<form action="/results" method="get"><input name="q" placeholder="Search products"><button type="submit">Go</button></form>
<a href="/about">About us</a>
<script>document.title = 'Test shop (loaded)'</script>
</body></html>"""
RESULTS = b"<!DOCTYPE html><html><head><title>Results</title></head><body><h1>Results page</h1><p>Nothing yet</p></body></html>"
ABOUT = b"<!DOCTYPE html><html><head><title>About</title></head><body><h1>About the test shop</h1></body></html>"


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        body = {"/": PAGE, "/results": RESULTS, "/about": ABOUT}.get(path, b"missing")
        if path == "/results" and "q=laptops" in self.path:
            body = RESULTS.replace(b"Nothing yet", b"Found 3 laptops")
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        return


@pytest.fixture
def site():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


def act(client, auth, name, args):
    return client.post(f"/actions/{name}", json={"args": args}, headers=auth).json()


def test_browser_can_open_read_type_click_and_close(client, auth, site):
    opened = act(client, auth, "browser_open", {"url": site + "/"})
    if not opened["ok"] and "could not be started" in opened["error"]:
        pytest.skip("Chrome is not available for the browser test")
    assert opened["ok"], opened
    page = opened["result"]
    assert page["title"] == "Test shop (loaded)"
    assert "Welcome to the test shop" in page["text"]
    assert {"text": "About us", "href": site + "/about"} in page["links"]
    assert any(field["label"] == "Search products" for field in page["fields"])

    typed = act(client, auth, "browser_type", {"target": "Search products", "text": "laptops", "submit": True})
    assert typed["ok"], typed
    assert typed["result"]["url"].endswith("/results?q=laptops")
    assert "Found 3 laptops" in typed["result"]["text"]

    back = act(client, auth, "browser_open", {"url": site + "/"})["result"]
    assert back["title"].startswith("Test shop")
    clicked = act(client, auth, "browser_click", {"target": "About us"})
    assert clicked["ok"], clicked
    assert "About the test shop" in clicked["result"]["text"]

    assert act(client, auth, "browser_read", {})["result"]["title"] == "About"
    assert act(client, auth, "browser_click", {"target": "nothing like this exists"})["ok"] is False
    assert act(client, auth, "browser_press", {"key": "PageDown"})["ok"] is True
    assert act(client, auth, "browser_press", {"key": "bad key!"})["ok"] is False
    assert act(client, auth, "browser_close", {})["result"]["closed"] is True


def test_browser_refuses_non_web_addresses(client, auth):
    for url in ["file:///C:/Windows/win.ini", "javascript:alert(1)", "data:text/html,<p>x</p>", "ftp://example.com"]:
        assert act(client, auth, "browser_open", {"url": url})["ok"] is False, url
