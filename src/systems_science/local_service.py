"""Start or reuse the local course service without adding steps to lessons."""

from __future__ import annotations

import errno
import hashlib
from http.client import HTTPException
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


SERVICE_NAME = "hands-on-systems-science"
_START_LOCK = threading.Lock()


class LocalServiceError(RuntimeError):
    """The course page cannot be reached or safely started."""


def project_root() -> Path:
    candidates = [Path(__file__).resolve().parents[2], Path.cwd().resolve(), *Path.cwd().resolve().parents]
    for root in candidates:
        if (root / "tools/serve.py").is_file() and (root / "web/course/catalog.json").is_file():
            return root
    raise LocalServiceError("未找到教材项目目录；请在项目环境中打开 Notebook。")


def workspace_id(root: Path) -> str:
    path = os.path.normcase(str(root.resolve())).casefold()
    return hashlib.sha256(path.encode("utf-8")).hexdigest()


def content_id(root: Path) -> str:
    """Fingerprint the files loaded into the service at startup."""
    root = root.resolve()
    paths = [root / "web/course/catalog.json", *sorted((root / "notebooks").rglob("catalog.json")),
             *sorted((root / "exercises").rglob("*.json")),
             *sorted((root / "tools").glob("*.py")), root / "src/systems_science/local_service.py"]
    digest = hashlib.sha256()
    for path in paths:
        if not path.is_file():
            raise LocalServiceError(f"缺少教材服务文件：{path.relative_to(root)}")
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _session(port: int) -> dict | None:
    try:
        # Some Windows hosts take about two seconds to reject a closed loopback port.
        with urlopen(f"http://127.0.0.1:{port}/api/session", timeout=3) as response:
            if response.status != 200:
                raise LocalServiceError(f"{port} 端口由其他程序占用。")
            return json.load(response)
    except HTTPError as error:
        raise LocalServiceError(f"{port} 端口由其他程序占用（HTTP {error.code}）。") from error
    except URLError as error:
        reason = error.reason
        if isinstance(reason, ConnectionRefusedError) or getattr(reason, "errno", None) in {errno.ECONNREFUSED, 10061}:
            return None
        raise LocalServiceError(f"无法检查 {port} 端口：{reason}") from error
    except (OSError, HTTPException) as error:
        if isinstance(error, ConnectionRefusedError):
            return None
        raise LocalServiceError(f"无法检查 {port} 端口：{error}") from error
    except (ValueError, TypeError, UnicodeError) as error:
        raise LocalServiceError(f"{port} 端口返回了无法识别的服务信息。") from error


def _validate_session(session: dict, root: Path, port: int) -> None:
    if not isinstance(session, dict) or session.get("service") != SERVICE_NAME:
        raise LocalServiceError(f"{port} 端口已被其他程序或旧版教材服务占用。")
    if session.get("workspace_id") != workspace_id(root):
        raise LocalServiceError(f"{port} 端口正在提供另一份教材目录。")
    if not isinstance(session.get("token"), str) or not session["token"]:
        raise LocalServiceError(f"{port} 端口返回了不完整的教材服务信息。")


def _stop_stale(session: dict, root: Path, port: int) -> None:
    body = json.dumps({"workspace_id": workspace_id(root)}).encode("utf-8")
    request = Request(f"http://127.0.0.1:{port}/api/local-shutdown", data=body, method="POST",
                      headers={"Content-Type": "application/json", "X-Local-Token": session["token"]})
    try:
        with urlopen(request, timeout=2) as response:
            if response.status != 202:
                raise LocalServiceError("旧教材服务未能结束。")
    except HTTPError as error:
        if error.code == 409:
            raise LocalServiceError("正在判题；请等当前提交完成后重新打开教材入口。") from error
        raise LocalServiceError(f"旧教材服务未能结束（HTTP {error.code}）。") from error
    except URLError as error:
        raise LocalServiceError(f"旧教材服务未能结束：{error.reason}") from error
    except (OSError, HTTPException) as error:
        raise LocalServiceError(f"旧教材服务未能结束：{error}") from error
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            if _session(port) is None:
                return
        except LocalServiceError:
            pass  # A connection can close while the old process exits.
        time.sleep(0.1)
    raise LocalServiceError("旧教材服务尚未释放端口，请稍后重试。")


def _start(root: Path, port: int) -> subprocess.Popen:
    interpreter = root / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
    if not interpreter.is_file():
        interpreter = Path(sys.executable)
    log_path = root / ".local/service.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    options = {"cwd": root, "stdin": subprocess.DEVNULL, "stderr": subprocess.STDOUT, "close_fds": True}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        options["start_new_session"] = True
    with log_path.open("ab") as log:
        return subprocess.Popen([str(interpreter), str(root / "tools/serve.py"), "--port", str(port)],
                                stdout=log, **options)


def ensure_course_server(*, root: Path | None = None, port: int = 8000) -> bool:
    """Return when this checkout's current service is ready; start it if needed."""
    root = (root or project_root()).resolve()
    try:
        expected = content_id(root)
    except OSError as error:
        raise LocalServiceError(f"无法读取教材服务文件：{error}") from error
    with _START_LOCK:
        session = _session(port)
        if session is not None:
            _validate_session(session, root, port)
            if session.get("content_id") == expected:
                return True
            _stop_stale(session, root, port)
        try:
            process = _start(root, port)
        except OSError as error:
            raise LocalServiceError(f"教材服务启动失败：{error}") from error
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            try:
                session = _session(port)
            except LocalServiceError:
                if process.poll() is None:
                    time.sleep(0.1)
                    continue
                raise
            if session is not None:
                _validate_session(session, root, port)
                if session.get("content_id") == expected:
                    return True
            if process.poll() is not None:
                raise LocalServiceError("教材服务启动失败；请查看 .local/service.log。")
            time.sleep(0.1)
        raise LocalServiceError("教材服务启动超时；请查看 .local/service.log。")


def notebook_service_ready() -> None:
    """Keep lesson execution usable if the optional web service is unavailable."""
    try:
        ensure_course_server()
    except LocalServiceError as error:
        print(f"练习网页暂时不可用：{error}")
