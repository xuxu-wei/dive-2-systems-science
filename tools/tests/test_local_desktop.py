"""Desktop launches are mocked here; real Windows checks have separate evidence."""
from pathlib import Path
import subprocess

import pytest
from systems_science import local_desktop as desktop


@pytest.fixture
def windows(monkeypatch):
    monkeypatch.setattr(desktop.sys, 'platform', 'win32')
    monkeypatch.setattr(desktop, 'context_diagnostic', lambda: {'user': 'test-user', 'session': 1})


def win_error(code):
    error = OSError('simulated Windows error')
    error.winerror = code
    return error


def fail_default(monkeypatch, code=1155):
    def fail(*args):
        raise win_error(code)
    monkeypatch.setattr(desktop.os, 'startfile', fail, raising=False)


def test_default_association_has_priority_and_receives_original_unicode_path(windows, monkeypatch, tmp_path):
    notebook = tmp_path / '导论 原文件.ipynb'
    notebook.touch()
    calls = []
    monkeypatch.setattr(desktop.os, 'startfile', lambda *args: calls.append(args), raising=False)
    monkeypatch.setattr(desktop, 'find_vscode', lambda: pytest.fail('unnecessary fallback'))
    assert desktop.open_in_default_app(notebook) == 'default'
    assert calls == [(str(notebook.resolve()), 'open')]


def test_failed_association_uses_exe_arguments_and_clean_electron_environment(windows, monkeypatch, tmp_path):
    fail_default(monkeypatch)
    executable = tmp_path / 'IDE 安装' / 'Code.exe'
    notebook = tmp_path / '导论 中文.ipynb'
    monkeypatch.setattr(desktop, 'find_vscode', lambda: executable)
    monkeypatch.setenv('ELECTRON_RUN_AS_NODE', '1')
    monkeypatch.setenv('NODE_OPTIONS', '--inspect')
    monkeypatch.setenv('VSCODE_IPC_HOOK_CLI', 'stale-socket')
    calls = []
    class Process:
        pid = 123
        def wait(self, timeout):
            raise subprocess.TimeoutExpired('Code.exe', timeout)
    def popen(args, **kwargs):
        calls.append((args, kwargs))
        return Process()
    monkeypatch.setattr(desktop.subprocess, 'Popen', popen)
    assert desktop.open_in_default_app(notebook) == 'vscode'
    args, options = calls[0]
    assert args == [str(executable), '--reuse-window', str(notebook.resolve())]
    assert not options.get('shell')
    assert not desktop.ELECTRON_ENV.intersection(options['env'])
    assert desktop.os.environ['ELECTRON_RUN_AS_NODE'] == '1'  # Caller is not altered.


@pytest.mark.parametrize('code,reason', [(1155, '文件关联'), (5, '没有打开权限'), (2, '程序不存在')])
def test_unavailable_app_reports_actual_windows_error(windows, monkeypatch, tmp_path, caplog, code, reason):
    fail_default(monkeypatch, code)
    monkeypatch.setattr(desktop, 'find_vscode', lambda: None)
    with pytest.raises(desktop.NotebookOpenError, match=reason) as error:
        desktop.open_in_default_app(tmp_path / '课程.ipynb')
    assert str(code) in str(error.value) and '未找到已安装的 VS Code' in str(error.value)
    assert f'winerror={code}' in caplog.text and 'test-user' in caplog.text


def test_vscode_nonzero_exit_is_not_reported_as_success(windows, monkeypatch, tmp_path):
    fail_default(monkeypatch)
    monkeypatch.setattr(desktop, 'find_vscode', lambda: tmp_path / 'Code.exe')
    class Process:
        pid = 123
        def wait(self, timeout):
            return 7
    monkeypatch.setattr(desktop.subprocess, 'Popen', lambda *a, **kw: Process())
    with pytest.raises(desktop.NotebookOpenError, match='退出码 7'):
        desktop.open_in_default_app(tmp_path / '课.ipynb')


def test_cli_location_resolves_binary_without_executing_cmd(windows, monkeypatch, tmp_path):
    folder = tmp_path / 'VS Code 中文'
    (folder / 'bin').mkdir(parents=True)
    (folder / 'Code.exe').touch()
    monkeypatch.setattr(desktop, '_registry_code_paths', lambda: [])
    monkeypatch.setattr(desktop.shutil, 'which', lambda name: str(folder / 'bin/code.cmd') if name == 'code' else None)
    assert desktop.find_vscode() == (folder / 'Code.exe').resolve()


def test_registry_installation_has_priority_and_missing_binary_is_skipped(windows, monkeypatch, tmp_path):
    good = tmp_path / '注册安装' / 'Code.exe'
    good.parent.mkdir()
    good.touch()
    monkeypatch.setattr(desktop, '_registry_code_paths', lambda: [tmp_path / 'missing/Code.exe', good])
    monkeypatch.setattr(desktop.shutil, 'which', lambda _: None)
    assert desktop.find_vscode() == good.resolve()


def test_context_changes_with_effective_user_and_windows_session(monkeypatch):
    monkeypatch.setattr(desktop, 'desktop_identity', lambda: {'user': 'A', 'session': 1})
    initial = desktop.launch_context_id()
    assert initial == desktop.launch_context_id()
    monkeypatch.setattr(desktop, 'desktop_identity', lambda: {'user': 'B', 'session': 1})
    assert desktop.launch_context_id() != initial
    monkeypatch.setattr(desktop, 'desktop_identity', lambda: {'user': 'A', 'session': 2})
    assert desktop.launch_context_id() != initial
