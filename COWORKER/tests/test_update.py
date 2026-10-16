import shutil
import socket
import subprocess
import sys
import time

import pytest

from app import desktop
from app.config import Settings
from app.installer import copy_with_retries, is_older
from app.main import APP_VERSION
from tests.test_installer import make


def free_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def test_versions_are_compared_numerically():
    assert is_older("0.1.0", "0.2.0") and is_older("0.9.9", "0.10.0") and is_older("0", "0.1.0")
    assert not is_older("0.2.0", "0.2.0") and not is_older("1.0.0", "0.9.0")


def test_copying_waits_for_a_locked_file_to_be_released(tmp_path, monkeypatch):
    source = tmp_path / "new.exe"
    source.write_bytes(b"new")
    target = tmp_path / "old.exe"
    calls = {"count": 0}

    def locked_twice(src, dst):
        calls["count"] += 1
        if calls["count"] < 3:
            raise PermissionError("in use")
        return shutil.copyfile(src, dst)

    monkeypatch.setattr("app.installer.shutil.copy2", locked_twice)
    monkeypatch.setattr("app.installer.time.sleep", lambda seconds: None)
    copy_with_retries(source, target)
    assert target.read_bytes() == b"new" and calls["count"] == 3


def settings_for(port):
    return Settings(_env_file=None, coworker_port=port)


def test_an_older_copy_is_asked_to_update_and_is_replaced(monkeypatch, tmp_path):
    installer, source = make(tmp_path)
    steps = []
    monkeypatch.setattr(desktop, "running_version", lambda settings: "0.1.0")
    monkeypatch.setattr(desktop, "frozen_app", lambda: True)
    monkeypatch.setattr(desktop, "current_executable", lambda: source)
    monkeypatch.setattr(desktop, "Installer", lambda *args, **kwargs: installer)
    monkeypatch.setattr(desktop.dialogs, "ask", lambda text, default_no=True: steps.append(("ask", default_no)) or True)
    monkeypatch.setattr(desktop.dialogs, "tell", lambda text: steps.append(("tell", text)))
    monkeypatch.setattr(desktop, "stop_running_copy", lambda settings: steps.append(("stop",)))
    monkeypatch.setattr(desktop.subprocess, "Popen", lambda command, **kwargs: steps.append(("start", command[0])))
    desktop.run_desktop(settings_for(8765))
    assert [step[0] for step in steps] == ["ask", "stop", "start", "tell"]
    assert steps[0] == ("ask", False)
    assert steps[2][1] == str(installer.installed_exe) and installer.installed_exe.read_bytes() == b"program"
    assert installer.startup.enabled()


def test_declining_the_update_leaves_the_running_copy_alone(monkeypatch, tmp_path):
    installer, source = make(tmp_path)
    steps = []
    monkeypatch.setattr(desktop, "running_version", lambda settings: "0.1.0")
    monkeypatch.setattr(desktop, "frozen_app", lambda: True)
    monkeypatch.setattr(desktop, "current_executable", lambda: source)
    monkeypatch.setattr(desktop, "Installer", lambda *args, **kwargs: installer)
    monkeypatch.setattr(desktop.dialogs, "ask", lambda text, default_no=True: False)
    monkeypatch.setattr(desktop, "stop_running_copy", lambda settings: steps.append("stop"))
    desktop.run_desktop(settings_for(8765))
    assert steps == [] and not installer.installed_exe.exists()


def test_the_same_or_a_newer_copy_is_just_reported_as_running(monkeypatch, tmp_path):
    installer, source = make(tmp_path)
    for running in (APP_VERSION, "9.0.0"):
        messages = []
        monkeypatch.setattr(desktop, "running_version", lambda settings, running=running: running)
        monkeypatch.setattr(desktop, "frozen_app", lambda: True)
        monkeypatch.setattr(desktop, "current_executable", lambda: source)
        monkeypatch.setattr(desktop, "Installer", lambda *args, **kwargs: installer)
        monkeypatch.setattr(desktop.dialogs, "tell", lambda text: messages.append(text))
        monkeypatch.setattr(desktop.dialogs, "ask", lambda *args, **kwargs: pytest.fail("must not ask"))
        desktop.run_desktop(settings_for(8765))
        assert messages == [desktop.RUNNING_MESSAGE]


OLD_SERVER = """
import http.server, json, sys
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps({"name": "workzen-coworker", "version": "0.1.0"}).encode())
    def log_message(self, *args): pass
http.server.HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
"""


def test_the_old_copy_listening_on_the_port_is_stopped():
    port = free_port()
    process = subprocess.Popen([sys.executable, "-c", OLD_SERVER, str(port)])
    try:
        settings = settings_for(port)
        for _ in range(40):
            if desktop.running_version(settings) == "0.1.0":
                break
            time.sleep(0.25)
        assert desktop.running_version(settings) == "0.1.0"
        desktop.stop_running_copy(settings)
        assert desktop.running_version(settings) is None
        assert process.wait(timeout=10) is not None
    finally:
        process.kill()