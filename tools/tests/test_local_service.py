"""The local learning entry reuses one service and never takes over another port."""

import json
from pathlib import Path
import sys
import threading
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from serve import TeachingServer
from systems_science import local_service


@pytest.fixture
def local_server(tmp_path):
    server = TeachingServer(("127.0.0.1", 0), learning_directory=tmp_path / "learning")
    def serve():
        try:
            server.serve_forever(poll_interval=0.01)
        finally:
            server.server_close()
    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    yield server, thread
    if thread.is_alive():
        server.shutdown()
    thread.join(timeout=2)


def test_same_workspace_service_is_reused_without_spawning(local_server, monkeypatch):
    server, _ = local_server
    monkeypatch.setattr(local_service, "_start", lambda *_: pytest.fail("duplicate server started"))
    assert local_service.ensure_course_server(root=ROOT, port=server.server_port)
    with urlopen(f"http://127.0.0.1:{server.server_port}/api/session") as response:
        session = json.load(response)
    assert session["workspace_id"] == local_service.workspace_id(ROOT)
    assert session["content_id"] == local_service.content_id(ROOT)
    assert session["launch_context_id"] == local_service.launch_context_id()


def test_shutdown_requires_matching_workspace_and_waits_for_active_submission(local_server):
    server, thread = local_server
    with urlopen(f"http://127.0.0.1:{server.server_port}/api/session") as response:
        session = json.load(response)

    def stop(workspace):
        body = json.dumps({"workspace_id": workspace}).encode("utf-8")
        request = Request(f"http://127.0.0.1:{server.server_port}/api/local-shutdown",
                          data=body, method="POST",
                          headers={"Content-Type": "application/json", "X-Local-Token": session["token"]})
        try:
            with urlopen(request, timeout=2) as response:
                return response.status
        except HTTPError as error:
            return error.code

    assert stop("different-workspace") == 403
    with server.practice.lock:
        server.practice.active = "calculation-running"
    assert stop(session["workspace_id"]) == 409
    assert thread.is_alive()
    with server.practice.lock:
        server.practice.active = None
    assert stop(session["workspace_id"]) == 202
    thread.join(timeout=2)
    assert not thread.is_alive()


def test_other_course_directory_is_not_reused(local_server, monkeypatch):
    server, _ = local_server
    server.workspace_id = "another-checkout"
    monkeypatch.setattr(local_service, "_start", lambda *_: pytest.fail("foreign port was taken over"))
    with pytest.raises(local_service.LocalServiceError, match="另一份教材目录"):
        local_service.ensure_course_server(root=ROOT, port=server.server_port)


def test_notebook_still_runs_when_page_cannot_start(monkeypatch, capsys):
    def unavailable():
        raise local_service.LocalServiceError("8000 端口已被占用")
    monkeypatch.setattr(local_service, "ensure_course_server", unavailable)
    assert local_service.notebook_service_ready() is None
    assert "练习网页暂时不可用" in capsys.readouterr().out


@pytest.mark.parametrize('field,value', [('launch_context_id', 'other-user-session'),
                                       ('launch_context_id', None), ('content_id', 'old-version')])
def test_same_workspace_stale_or_wrong_context_service_is_stopped(local_server, monkeypatch, field, value):
    server, thread = local_server
    setattr(server, field, value)
    def replacement(*_):
        raise OSError('replacement-start-observed')
    monkeypatch.setattr(local_service, '_start', replacement)
    with pytest.raises(local_service.LocalServiceError, match='replacement-start-observed'):
        local_service.ensure_course_server(root=ROOT, port=server.server_port)
    thread.join(timeout=2)
    assert not thread.is_alive()


def test_wrong_context_never_interrupts_active_judging(local_server, monkeypatch):
    server, thread = local_server
    server.launch_context_id = 'other-session'
    monkeypatch.setattr(local_service, '_start', lambda *_: pytest.fail('interrupted judging'))
    with server.practice.lock:
        server.practice.active = 'calculation-running'
    try:
        with pytest.raises(local_service.LocalServiceError, match='正在判题'):
            local_service.ensure_course_server(root=ROOT, port=server.server_port)
        assert thread.is_alive()
    finally:
        with server.practice.lock:
            server.practice.active = None
