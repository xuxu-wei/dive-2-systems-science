"""One-click entry for the local course homepage and editor startup task."""

import argparse
from pathlib import Path
import sys
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from systems_science.local_service import LocalServiceError, ensure_course_server


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ensure-only", action="store_true")
    args = parser.parse_args()
    try:
        ensure_course_server(root=ROOT)
    except LocalServiceError as error:
        print(f"教材网页无法启动：{error}", file=sys.stderr)
        return 1
    if not args.ensure_only:
        webbrowser.open("http://127.0.0.1:8000/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
