"""The service entry point must use the checkout it was launched from."""

from pathlib import Path
import shutil
import subprocess
import sys
import sysconfig


ROOT = Path(__file__).resolve().parents[2]


def test_relocated_service_imports_without_an_editable_install(tmp_path):
    checkout = tmp_path / "relocated \u6559\u6750 course"
    shutil.copytree(ROOT / "src", checkout / "src", ignore=shutil.ignore_patterns("__pycache__", "*.egg-info"))
    (checkout / "tools").mkdir()
    for source in (ROOT / "tools").glob("*.py"):
        shutil.copy2(source, checkout / "tools" / source.name)

    # Keep third-party dependencies, but skip all .pth/editable registrations and PYTHONPATH.
    site_paths = list(dict.fromkeys(sysconfig.get_path(key) for key in ("purelib", "platlib")))
    entry = checkout / "tools/serve.py"
    script = (
        "import runpy, sys\n"
        f"sys.path.extend({site_paths!r})\n"
        f"sys.argv = [{str(entry)!r}, '--help']\n"
        "try:\n"
        f"    runpy.run_path({str(entry)!r}, run_name='__main__')\n"
        "except SystemExit as error:\n"
        "    if error.code not in (None, 0):\n"
        "        raise\n"
        f"assert sys.modules['systems_science'].__file__ == {str(checkout / 'src/systems_science/__init__.py')!r}\n"
    )
    result = subprocess.run([sys.executable, "-I", "-S", "-c", script], cwd=tmp_path,
                            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
    assert result.returncode == 0, result.stderr
    assert "--port" in result.stdout
