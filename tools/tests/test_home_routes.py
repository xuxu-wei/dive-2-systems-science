"""首页星图使用当前课程快照；独立 HTTP 目录不加载或改写学习记录。"""
import hashlib
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import threading
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest


spec = importlib.util.spec_from_file_location('home_routes_server', Path(__file__).resolve().parents[1] / 'serve.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


@pytest.fixture
def home_server(tmp_path, monkeypatch):
    course = tmp_path / 'web/course'
    home = tmp_path / 'web/home'
    course.mkdir(parents=True)
    home.mkdir(parents=True)
    catalog = course / 'catalog.json'
    catalog.write_text('{"parts": []}', encoding='utf-8')
    graph = {'source': {'catalogSha256': module.catalog_digest(json.loads(catalog.read_text(encoding='utf-8')))},
             'nodes': [], 'edges': [], 'taxonomy': []}
    (home / 'graph.json').write_text(json.dumps(graph), encoding='utf-8')
    (course / 'index.html').write_text('<!doctype html><title>全书目录</title>', encoding='utf-8')
    (tmp_path / 'docs').mkdir()
    (tmp_path / 'docs/术语对照.json').write_text('[]', encoding='utf-8')
    monkeypatch.setattr(module, 'ROOT', tmp_path)
    instance = ThreadingHTTPServer(('127.0.0.1', 0), module.TeachingHandler)
    instance.course = {'parts': []}
    instance.previews = False
    thread = threading.Thread(target=instance.serve_forever, kwargs={'poll_interval': .01}, daemon=True)
    thread.start()
    yield instance, tmp_path, graph
    instance.shutdown()
    instance.server_close()
    thread.join(timeout=2)


def request(server, path, method='GET'):
    req = Request(f'http://127.0.0.1:{server.server_port}{path}', method=method)
    try:
        response = urlopen(req, timeout=3)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


def test_matching_home_graph_is_served_without_cache(home_server):
    server, _, expected = home_server
    status, headers, body = request(server, '/web/home/graph.json')
    assert status == 200 and json.loads(body) == expected
    assert headers.get_content_type() == 'application/json'
    assert headers['Cache-Control'] == 'no-store'


@pytest.mark.parametrize('problem,status', [
    ('changed_catalog', 200), ('missing_graph', 200), ('corrupt_graph', 200),
    ('missing_hash', 200), ('missing_catalog', 503), ('corrupt_catalog', 503),
])
def test_unavailable_home_graph_preserves_catalog_route(home_server, problem, status):
    server, root, graph = home_server
    graph_path = root / 'web/home/graph.json'
    catalog_path = root / 'web/course/catalog.json'
    if problem == 'changed_catalog':
        catalog_path.write_text('{"parts": [], "revision": 2}', encoding='utf-8')
    elif problem == 'missing_graph':
        graph_path.unlink()
    elif problem == 'corrupt_graph':
        graph_path.write_text('{', encoding='utf-8')
    elif problem == 'missing_hash':
        graph['source'] = {}
        graph_path.write_text(json.dumps(graph), encoding='utf-8')
    elif problem == 'missing_catalog':
        catalog_path.unlink()
    else:
        catalog_path.write_text('not json', encoding='utf-8')
    code, headers, body = request(server, '/web/home/graph.json')
    assert code == status and headers.get_content_type() == 'application/json'
    payload = json.loads(body)
    if status == 503:
        assert '全书目录' in payload['error'] and payload['catalog_url'] == '/catalog/'
        assert 'nodes' not in payload
    else:
        assert payload['nodes'] == []
        assert payload['source']['catalogSha256'] == module.catalog_digest(json.loads(catalog_path.read_text(encoding='utf-8')))
    assert request(server, '/catalog/')[0] == 200


def test_alternate_graph_path_and_head_cannot_bypass_snapshot_check(home_server):
    server, root, _ = home_server
    (root / 'web/course/catalog.json').write_text('{"parts": [], "revision": 3}', encoding='utf-8')
    assert request(server, '/web/home/./graph.json')[0] == 200
    code, headers, body = request(server, '/web/home/graph.json', method='HEAD')
    assert code == 200 and headers.get_content_type() == 'application/json'
    assert body == b''


def test_git_line_ending_conversion_does_not_disable_graph(home_server):
    server, root, expected = home_server
    path = root / 'web/course/catalog.json'
    value = json.loads(path.read_text(encoding='utf-8'))
    path.write_bytes(json.dumps(value, indent=2).replace('\n','\r\n').encode('utf-8'))
    assert json.loads(request(server, '/web/home/graph.json')[2]) == expected
