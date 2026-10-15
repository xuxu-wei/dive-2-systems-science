"""本机教材、练习与 JupyterLab 实验入口。"""
import argparse
import io
import json
import logging
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import secrets
import subprocess
import sys
import threading
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
# Resolve the checkout directly: an editable install may still point at a moved directory.
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))
from practice import PracticeEngine, RequestError
from course_content import notebooks, course_chapters
from systems_science.local_service import SERVICE_NAME, content_id, workspace_id
from systems_science.notebook_lab import NotebookLab
from build_home_graph import build_graph, catalog_digest



def home_graph_response(root):
    """Serve the current catalog's graph, independent of Git line endings."""
    try:
        catalog = json.loads((root / 'web/course/catalog.json').read_text(encoding='utf-8'))
        if not isinstance(catalog, dict) or not isinstance(catalog.get('parts'), list):
            raise ValueError('Invalid course catalog')
        digest = catalog_digest(catalog)
        try:
            graph = json.loads((root / 'web/home/graph.json').read_text(encoding='utf-8'))
            if (graph.get('source', {}).get('catalogSha256') == digest
                    and all(isinstance(graph.get(key), list) for key in ('nodes', 'edges', 'taxonomy'))):
                return 200, graph
        except (OSError, ValueError, AttributeError):
            pass
        # Partial rebuilds must not disable the homepage. Do not mutate files.
        terms = json.loads((root / 'docs/术语对照.json').read_text(encoding='utf-8'))
        return 200, build_graph(catalog, terms, catalog_sha256=digest)
    except (OSError, ValueError, TypeError, KeyError):
        logging.exception('Unable to build homepage graph')
        return 503, {'error': '知识星图暂时不可用，请先从全书目录继续学习。', 'catalog_url': '/catalog/'}


class TeachingServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, *, previews=False, lab=None, learning_directory=None):
        super().__init__(address, TeachingHandler)
        self.previews = previews
        self.lab = lab or NotebookLab(ROOT)
        self.token = secrets.token_urlsafe(32)
        self.catalog = notebooks()
        self.course = json.loads((ROOT / 'web/course/catalog.json').read_text(encoding='utf-8'))
        self.workspace_id = workspace_id(ROOT)
        self.content_id = content_id(ROOT)
        self.lifecycle_lock = threading.Lock()
        self.stopping = False
        try:
            self.practice = PracticeEngine(learning_directory or ROOT / '.local/learning')
        except Exception:
            super().server_close()
            raise

    def server_close(self):
        if hasattr(self,'practice'): self.practice.close()
        if hasattr(self,'lab'): self.lab.close()
        super().server_close()


class TeachingHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.html': 'text/html; charset=utf-8',
                      '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                      '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def valid_host(self):
        return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}

    def respond_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.valid_host():
            self.send_error(403)
            return
        if urlsplit(self.path).path == '/api/session':
            self.respond_json(200, {'version': 'course-jupyterlab-1', 'token': self.server.token,
                                    'service': SERVICE_NAME, 'workspace_id': self.server.workspace_id,
                                    'content_id': self.server.content_id,
                                    'notebooks': self.server.catalog,'practice_version':'named-parameters-2','assessment_version':'1'})
            return
        path=urlsplit(self.path).path
        try:
            if path=='/api/v1/catalog':
                self.respond_json(200,{'exercises':self.server.practice.catalog(),'notebooks':self.server.catalog}); return
            if path.startswith('/api/v1/exercises/'):
                self.respond_json(200,self.server.practice.question(path.rsplit('/',1)[-1])); return
            if path.startswith('/api/v1/submissions/'):
                self.respond_json(200,self.server.practice.get(path.rsplit('/',1)[-1])); return
            if path=='/api/v1/progress':
                self.respond_json(200,self.server.practice.progress()); return
        except RequestError as error:
            self.respond_json(error.status,error.payload); return
        super().do_GET()

    def do_POST(self):
        origin = self.headers.get('Origin')
        valid_origin = origin is None or origin == f'http://{self.headers.get("Host")}'
        token=self.headers.get('X-Local-Token','')
        if not self.valid_host() or not valid_origin or not token.isascii() or not secrets.compare_digest(token, self.server.token):
            self.respond_json(403, {'error': '连接已失效，请重新连接本地程序。'})
            return
        endpoint=urlsplit(self.path).path
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 262144 or self.headers.get_content_type() != 'application/json':
                raise ValueError()
            payload = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeError):
            self.respond_json(400, {'error': '请求格式不正确。'})
            return
        if endpoint == '/api/local-shutdown':
            if payload != {'workspace_id': self.server.workspace_id}:
                self.respond_json(403, {'error': '教材目录不匹配。'})
                return
            with self.server.lifecycle_lock:
                with self.server.practice.lock:
                    if self.server.practice.active is not None:
                        self.respond_json(409, {'error': '正在判题，请稍后重试。'})
                        return
                    self.server.stopping = True
            self.respond_json(202, {'status': 'stopping'})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        try:
            if endpoint in ('/api/v1/choice-attempts','/api/v1/submissions'):
                kind='choice' if endpoint.endswith('choice-attempts') else 'python'
                with self.server.lifecycle_lock:
                    if self.server.stopping:
                        self.respond_json(503, {'error': '教材服务正在更新，请稍后重试。'})
                        return
                    result = self.server.practice.submit(payload, kind)
                self.respond_json(200 if kind=='choice' else 202, result); return
            if endpoint.startswith('/api/v1/submissions/') and endpoint.endswith('/cancel'):
                self.respond_json(200,self.server.practice.cancel(endpoint.split('/')[-2])); return
        except RequestError as error:
            self.respond_json(error.status,error.payload); return
        if endpoint != '/api/notebooks/open':
            self.respond_json(404, {'error': '没有这个操作。'}); return
        if not isinstance(payload, dict) or set(payload) != {'id'} or not isinstance(payload['id'], str):
            self.respond_json(400, {'error': 'Notebook 请求格式不正确。'}); return
        entry = next((item for item in self.server.catalog if item['id'] == payload['id']), None)
        if entry is None:
            self.respond_json(404, {'error': '该 Notebook 尚未提供。'})
            return
        path = (ROOT / entry['path']).resolve()
        if not path.is_relative_to(ROOT / 'notebooks') or path.suffix != '.ipynb' or not path.is_file():
            self.respond_json(404, {'error': 'Notebook 文件不可用，请核对教材目录。'})
            return
        try:
            url = self.server.lab.open_url(path)
        except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
            logging.exception('Notebook open failed: id=%s path=%s', entry['id'], path)
            message = str(error)
            self.respond_json(503, {'error': message})
            return
        self.respond_json(200, {'status': 'ready', 'id': entry['id'], 'url': url})


    def send_head(self):
        if not self.valid_host():
            self.send_error(403)
            return None
        requested = unquote(urlsplit(self.path).path).lstrip('/')
        routes={'':'web/home/index.html','catalog/':'web/course/index.html', 'notebook/':'web/notebook/index.html', 'favicon.ico':'web/shared/logo.svg'}
        for part in self.server.course['parts']:
            routes[part['url'].lstrip('/')]='web/course/index.html'
        for chapter in course_chapters(self.server.course):
            base=chapter['url'].lstrip('/')
            routes[base]='web/course/index.html'
            for lesson in chapter.get('lessons', []):
                if lesson.get('reading_url'):
                    routes[lesson['reading_url'].lstrip('/')] = 'web/reading/pages/' + lesson['id'] + '.html'
            if chapter['available']:
                routes[base+'practice/']='web/practice/index.html'
                if chapter.get('visualization'):
                    routes[base+'explore/']=chapter['visualization']
        if requested in routes:
            requested=routes[requested];self.path='/'+requested
        resolved = (ROOT / requested).resolve()
        if not resolved.is_relative_to(ROOT):
            self.send_error(404)
            return None
        parts = resolved.relative_to(ROOT).parts
        allowed = parts and (parts[0] in {'web', 'notebooks', 'docs'} or requested in {'README.md', 'LICENSE'})
        if self.server.previews and len(parts)>=3 and parts[0]=='.work' and parts[1] in {'m1','m2','m3','m3-part01','m4','m5','m6','m7','m5-extension','m7-extension','m8','m8-teaching','m9','m10','m11','m12','m13','m14','m6-label-correction','m19'} and parts[2]=='previews':
            allowed = True
        if not allowed:
            self.send_error(404)
            return None
        if resolved == ROOT / 'web/home/graph.json':
            # Return the checked in-memory snapshot, not a second file read that
            # could race with a course rebuild. HEAD shares the same validation.
            status, payload = home_graph_response(ROOT)
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404, 'Open a named teaching file')
        return None


def main():
    # Root CMD redirects the service output to a file; retain readable Chinese
    # paths/errors there even when the Windows console codepage is legacy.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='backslashreplace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--previews', action='store_true', help='同时提供本地 Notebook 检查预览')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
    server = TeachingServer(('127.0.0.1', args.port), previews=args.previews)
    print(f'http://127.0.0.1:{server.server_port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
