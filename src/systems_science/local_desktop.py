"""Desktop identity and Notebook opening for the local teaching service."""

from __future__ import annotations

import ctypes
import getpass
import hashlib
import json
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys

LOG = logging.getLogger(__name__)
ELECTRON_ENV = {'ELECTRON_RUN_AS_NODE', 'ELECTRON_NO_ATTACH_CONSOLE', 'NODE_OPTIONS',
                'NODE_REPL_EXTERNAL_MODULE', 'VSCODE_IPC_HOOK_CLI'}


def desktop_environment():
    """A service/GUI child must not inherit its parent's Electron CLI mode."""
    return {key: value for key, value in os.environ.items() if key.upper() not in ELECTRON_ENV}


def desktop_identity():
    """Read the effective Windows token, not USERNAME inherited from another user."""
    if sys.platform != 'win32':
        return {'user': str(os.getuid()), 'session': os.environ.get('DISPLAY', '') + ':'
                + os.environ.get('WAYLAND_DISPLAY', ''), 'platform': sys.platform}
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    advapi = ctypes.WinDLL('advapi32', use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    advapi.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    advapi.GetTokenInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p,
                                          wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    advapi.ConvertSidToStringSidW.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.LPWSTR)]
    token = wintypes.HANDLE()
    if not advapi.OpenProcessToken(kernel.GetCurrentProcess(), 8, ctypes.byref(token)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        size = wintypes.DWORD()
        advapi.GetTokenInformation(token, 1, None, 0, ctypes.byref(size))  # TokenUser
        buffer = ctypes.create_string_buffer(size.value)
        if not advapi.GetTokenInformation(token, 1, buffer, size, ctypes.byref(size)):
            raise ctypes.WinError(ctypes.get_last_error())
        sid = ctypes.cast(buffer, ctypes.POINTER(ctypes.c_void_p))[0]
        sid_text = wintypes.LPWSTR()
        if not advapi.ConvertSidToStringSidW(sid, ctypes.byref(sid_text)):
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            user = sid_text.value
        finally:
            kernel.LocalFree(sid_text)
    finally:
        kernel.CloseHandle(token)
    session = wintypes.DWORD()
    if not kernel.ProcessIdToSessionId(os.getpid(), ctypes.byref(session)):
        raise ctypes.WinError(ctypes.get_last_error())
    return {'user': user, 'session': session.value, 'platform': sys.platform}


def launch_context_id():
    # The HTTP endpoint exposes only this opaque identity, never usernames/SIDs.
    return hashlib.sha256(json.dumps(desktop_identity(), sort_keys=True).encode()).hexdigest()


def context_diagnostic():
    account = getpass.getuser()
    if sys.platform == 'win32':
        buffer = ctypes.create_unicode_buffer(1024)
        length = ctypes.c_ulong(len(buffer))
        if ctypes.WinDLL('advapi32').GetUserNameW(buffer, ctypes.byref(length)):
            account = buffer.value
    return {**desktop_identity(), 'account': account, 'pid': os.getpid()}


def _registry_code_paths():
    if sys.platform != 'win32':
        return []
    import winreg
    paths = []
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        for view in (winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY):
            try:
                with winreg.OpenKey(hive, r'Software\Microsoft\Windows\CurrentVersion\App Paths\Code.exe',
                                    0, winreg.KEY_READ | view) as key:
                    paths.append(Path(winreg.QueryValueEx(key, '')[0].strip('"')))
            except OSError:
                pass
            try:
                with winreg.OpenKey(hive, r'Software\Microsoft\Windows\CurrentVersion\Uninstall',
                                    0, winreg.KEY_READ | view) as uninstall:
                    for index in range(winreg.QueryInfoKey(uninstall)[0]):
                        name = winreg.EnumKey(uninstall, index)
                        try:
                            with winreg.OpenKey(uninstall, name) as key:
                                display = winreg.QueryValueEx(key, 'DisplayName')[0]
                                if display not in ('Microsoft Visual Studio Code', 'Microsoft Visual Studio Code (User)'):
                                    continue
                                paths.append(Path(winreg.QueryValueEx(key, 'InstallLocation')[0]) / 'Code.exe')
                        except OSError:
                            continue
            except OSError:
                pass
    return paths


def find_vscode():
    candidates = _registry_code_paths()
    for command in ('code', 'code.cmd', 'Code.exe'):
        found = shutil.which(command)
        if found:
            path = Path(found)
            candidates.extend([path, path.parent.parent / 'Code.exe'])
    for path in candidates:
        if path.name.lower() == 'code.exe' and path.is_file():
            return path.resolve()
    return None


def error_description(error):
    code = getattr(error, 'winerror', None) or getattr(error, 'errno', None)
    reason = {2: '文件或关联的程序不存在', 3: '文件或程序路径不存在',
              5: '当前 Windows 账户没有打开权限', 1155: '当前 Windows 账户未找到 .ipynb 文件关联',
              193: '关联的程序不是有效的 Windows 应用', 740: '关联的程序要求提升权限'}.get(code)
    if isinstance(error, subprocess.TimeoutExpired):
        reason = '应用启动超时'
    elif isinstance(error, subprocess.CalledProcessError):
        reason = f'应用启动后退出（退出码 {error.returncode}）'
    return (reason or '操作系统拒绝了打开请求') + (f'（系统错误 {code}）' if code else '')


class NotebookOpenError(OSError):
    """An actionable message; technical details are written to the local log."""


def open_in_default_app(path):
    """Default association first, then installed VS Code; never evaluate a shell."""
    path = Path(path).resolve()
    LOG.info('Notebook open requested: path=%s context=%s', path, context_diagnostic())
    try:
        if sys.platform == 'win32':
            os.startfile(str(path), 'open')
        else:
            subprocess.run(['open' if sys.platform == 'darwin' else 'xdg-open', str(path)],
                           check=True, timeout=10, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           env=desktop_environment())
        LOG.info('Notebook default association accepted: %s', path)
        return 'default'
    except (OSError, subprocess.SubprocessError) as error:
        LOG.warning('Notebook default association failed: %r winerror=%s errno=%s context=%s',
                    error, getattr(error, 'winerror', None), getattr(error, 'errno', None), context_diagnostic())
        reason = error_description(error)
    executable = find_vscode() if sys.platform == 'win32' else None
    if not executable:
        raise NotebookOpenError(f'{reason}；也未找到已安装的 VS Code。请从当前桌面运行“开始学习.cmd”，'
                                '确认 IDE 已安装且可直接打开该 Notebook。')
    try:
        process = subprocess.Popen([str(executable), '--reuse-window', str(path)], cwd=path.parent,
                                   env=desktop_environment(), stdin=subprocess.DEVNULL,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
        try:
            code = process.wait(timeout=0.8)
        except subprocess.TimeoutExpired:
            code = None  # GUI remains running; launch accepted, not proof of a visible document.
        if code not in (None, 0):
            raise subprocess.CalledProcessError(code, [str(executable)])
        LOG.info('Notebook VS Code fallback accepted: executable=%s pid=%s path=%s', executable, process.pid, path)
        return 'vscode'
    except (OSError, subprocess.SubprocessError) as error:
        LOG.exception('Notebook VS Code fallback failed: executable=%s path=%s', executable, path)
        raise NotebookOpenError(f'{reason}；VS Code 回退也未成功：{error_description(error)}。'
                                '请从当前桌面重新运行“开始学习.cmd”；详细原因见 .local/service.log。') from error
