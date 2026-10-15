"""Start a course-owned JupyterLab for the current checkout."""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import threading
from urllib.parse import quote
from urllib.request import Request, urlopen


class NotebookLab:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.process = None
        self.url = None
        self.log = None
        self.base_url = None
        self.token = None
        self.lock = threading.RLock()

    def notebook_path(self, path):
        path = Path(path).resolve()
        base = self.root / 'notebooks'
        if not path.is_relative_to(base) or not path.is_file() or path.suffix != '.ipynb':
            raise ValueError('Notebook 文件不可用。')
        return path.relative_to(base).as_posix()

    def target_url(self, path):
        workspace = 'experiment-' + secrets.token_hex(6)
        return f"{self.base_url}/lab/workspaces/{workspace}/tree/{quote(path)}?token={self.token}"

    def open_url(self, path):
        target = self.notebook_path(path)
        with self.lock:
            return self._open(target)

    def _open(self, path):
        if self.process and self.process.poll() is None:
            self.url = self.target_url(path)
            return self.url
        self.close()
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        token = secrets.token_urlsafe(32)
        self.token = token
        self.base_url = f"http://127.0.0.1:{port}"
        directory = self.root / ".local/jupyter"
        for name in ['runtime', 'data', 'config', 'ipython', 'settings', 'workspaces']:
            (directory / name).mkdir(parents=True, exist_ok=True)
        preferences = directory / 'settings/@jupyterlab/apputils-extension/notification.jupyterlab-settings'
        if not preferences.exists():
            preferences.parent.mkdir(parents=True, exist_ok=True)
            preferences.write_text(json.dumps({'fetchNews': 'false', 'checkForUpdates': False}), encoding='utf-8')
        kernel = directory / 'data/kernels/python3'
        kernel.mkdir(parents=True, exist_ok=True)
        (kernel / 'kernel.json').write_text(json.dumps({
            'argv': [sys.executable, '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
            'display_name': 'Python · 动手学系统科学', 'language': 'python',
            'env': {'PYTHONPATH': str(self.root / 'src')}
        }, ensure_ascii=False), encoding='utf-8')
        environment = os.environ.copy()
        environment.update(JUPYTER_PATH=str(directory / "data"), JUPYTER_RUNTIME_DIR=str(directory / "runtime"), JUPYTER_DATA_DIR=str(directory / "data"),
                           JUPYTER_CONFIG_DIR=str(directory / "config"), JUPYTERLAB_SETTINGS_DIR=str(directory / "settings"),
                           JUPYTERLAB_WORKSPACES_DIR=str(directory / "workspaces"), IPYTHONDIR=str(directory / "ipython"),
                           JUPYTER_TOKEN=token, PYTHONUTF8="1", PYTHONPATH=str(self.root / "src"))
        self.log = (directory / "server.log").open("w", encoding="utf-8")
        try:
            self.process = subprocess.Popen([sys.executable, "-m", "jupyterlab", "--no-browser", "--ip=127.0.0.1",
                 f"--port={port}", "--ServerApp.port_retries=0", f"--ServerApp.root_dir={self.root / 'notebooks'}", "--ServerApp.allow_remote_access=False"],
                 cwd=self.root, env=environment, stdout=self.log, stderr=subprocess.STDOUT,
                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except OSError:
            self.close()
            raise
        self.url = self.target_url(path)
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                self.close()
                raise RuntimeError("JupyterLab未启动；请检查本机环境和.local/jupyter/server.log。")
            try:
                with urlopen(f"http://127.0.0.1:{port}/api/status?token={token}", timeout=0.5) as response:
                    if response.status == 200:
                        return self.url
            except OSError:
                time.sleep(0.1)
        self.close()
        raise RuntimeError("JupyterLab启动超时，请重试；详情见 .local/jupyter/server.log。")

    def close(self):
        with self.lock:
            if self.process and self.process.poll() is None:
                try:
                    request = Request(self.base_url + '/api/shutdown', data=b'',
                                      headers={'Authorization': 'token ' + self.token})
                    with urlopen(request, timeout=3):
                        pass
                    self.process.wait(timeout=5)
                except (OSError, subprocess.TimeoutExpired):
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                        self.process.wait(timeout=3)
            self.process = None
            if self.log:
                self.log.close()
                self.log = None
