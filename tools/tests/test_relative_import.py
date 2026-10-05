"""A local checkout can move without leaving Notebook imports at the old path."""

import json
from pathlib import Path
import shutil
import subprocess
import sys
import venv

import pytest

from systems_science import local_service


@pytest.mark.parametrize("keep_original", [False, True])
def test_real_venv_import_after_move_or_copy(tmp_path, monkeypatch, keep_original):
    original = tmp_path / "original course"
    package = original / "src/systems_science"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("CHECKOUT = __file__\n", encoding="utf-8")
    environment = original / ".venv"
    venv.EnvBuilder(with_pip=False).create(environment)
    executable = environment / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    probe = subprocess.run([str(executable), "-I", "-c",
                            "import json, sysconfig; print(json.dumps(sysconfig.get_path('purelib')))"],
                           capture_output=True, text=True, encoding="utf-8",
                           check=True, timeout=30)
    site_packages = Path(json.loads(probe.stdout))
    site_relative = site_packages.relative_to(original)
    # Reproduce pip's existing absolute editable link; leave it intact.
    (site_packages / "__editable__.hands_on_systems_science.pth").write_text(
        str(original / "src") + "\n", encoding="utf-8")
    with monkeypatch.context() as scoped:
        scoped.setattr(sys, "prefix", str(environment))
        scoped.setattr(local_service.sysconfig, "get_path", lambda _: str(site_packages))
        local_service._ensure_relative_import(original)
    target = tmp_path / "moved 教材 course"
    assert original.resolve().parent == tmp_path.resolve() == target.resolve().parent
    if keep_original:
        shutil.copytree(original, target)
    else:
        original.rename(target)
    hook = target / site_relative / "00_hands_on_systems_science.pth"
    assert not Path(hook.read_text(encoding="utf-8").strip()).is_absolute()
    moved_python = target / executable.relative_to(original)
    result = subprocess.run([str(moved_python), "-I", "-c",
                             "import json, systems_science; print(json.dumps(systems_science.CHECKOUT))"],
                            cwd=tmp_path, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    assert Path(json.loads(result.stdout)).resolve() == target / "src/systems_science/__init__.py"


def test_registration_is_relative_and_idempotent(tmp_path, monkeypatch):
    root = tmp_path / "course"
    environment = root / ".venv"
    site_packages = environment / "Lib/site-packages"
    site_packages.mkdir(parents=True)
    (root / "src").mkdir()
    monkeypatch.setattr(sys, "prefix", str(environment))
    monkeypatch.setattr(local_service.sysconfig, "get_path", lambda _: str(site_packages))
    local_service._ensure_relative_import(root)
    hook = site_packages / "00_hands_on_systems_science.pth"
    assert hook.read_text(encoding="utf-8") == "../../../src\n"
    monkeypatch.setattr(local_service.tempfile, "NamedTemporaryFile",
                        lambda **_: pytest.fail("unchanged registration was rewritten"))
    local_service._ensure_relative_import(root)


@pytest.mark.parametrize("outside", ["interpreter", "site-packages", "junction"])
def test_no_registration_in_an_external_environment(tmp_path, monkeypatch, outside):
    root = tmp_path / "course"
    root.mkdir()
    shared = tmp_path / "shared"
    shared.mkdir()
    environment = root / ".venv"
    if outside == "junction":
        # Model resolved junction paths without requiring OS symlink privileges.
        original_resolve = Path.resolve
        monkeypatch.setattr(Path, "resolve", lambda self, *a, **k:
                            shared if self == environment else original_resolve(self, *a, **k))
    prefix = shared if outside in {"interpreter", "junction"} else environment
    site_packages = shared if outside == "site-packages" else environment / "Lib/site-packages"
    monkeypatch.setattr(sys, "prefix", str(prefix))
    monkeypatch.setattr(local_service.sysconfig, "get_path", lambda _: str(site_packages))
    monkeypatch.setattr(local_service.tempfile, "NamedTemporaryFile",
                        lambda **_: pytest.fail("external environment was modified"))
    local_service._ensure_relative_import(root)
