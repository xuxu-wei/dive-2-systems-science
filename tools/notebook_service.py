"""Maintain one unobtrusive service initializer in every teaching Notebook."""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ["from systems_science.local_service import notebook_service_ready\n", "notebook_service_ready()"]


def initializer(path: Path) -> dict:
    relative = path.relative_to(ROOT).as_posix()
    return {
        "cell_type": "code",
        "execution_count": None,
        "id": "service-" + hashlib.sha256(relative.encode("utf-8")).hexdigest()[:12],
        "metadata": {"jupyter": {"source_hidden": True}, "teaching_role": "local_service"},
        "outputs": [],
        "source": SOURCE,
    }


def check_or_update(path: Path, *, write: bool) -> bool:
    notebook = json.loads(path.read_text(encoding="utf-8"))
    cells = notebook["cells"]
    found = [index for index, cell in enumerate(cells)
             if cell.get("metadata", {}).get("teaching_role") == "local_service"]
    expected = initializer(path)
    if not found and write:
        cells.insert(1, expected)
        path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        return True
    if found != [1] or cells[1] != expected:
        raise ValueError(f"服务初始化单元缺失或已改变：{path.relative_to(ROOT)}")
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    paths = sorted((ROOT / "notebooks").rglob("*.ipynb"))
    changed = sum(check_or_update(path, write=args.write) for path in paths)
    print(f"Notebook service initializer: {len(paths)} checked, {changed} added.")


if __name__ == "__main__":
    main()
