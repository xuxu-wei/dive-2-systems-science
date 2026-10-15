"""One-click entry for the local course homepage and JupyterLab experiments."""

import argparse
from pathlib import Path
import sys
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from systems_science.local_service import LocalServiceError, ensure_course_server, stop_course_server


def main() -> int:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--ensure-only", action="store_true")
    actions.add_argument("--stop", action="store_true", help="保存实验后关闭教材服务与 JupyterLab")
    args = parser.parse_args()
    try:
        if args.stop:
            stop_course_server(root=ROOT)
            print("教材服务已关闭。")
            return 0
        ensure_course_server(root=ROOT)
    except LocalServiceError as error:
        print(f"教材网页无法启动：{error}", file=sys.stderr)
        return 1
    if not args.ensure_only:
        webbrowser.open("http://127.0.0.1:8000/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
