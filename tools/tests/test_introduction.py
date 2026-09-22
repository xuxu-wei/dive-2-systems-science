"""独立导论的教学输入、旧目录兼容、路由及成绩隔离。"""
import ast
from collections import deque
from copy import deepcopy
import json
from pathlib import Path
import sys
import threading
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import uuid4

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from build_course import build
from course_content import course_chapters
from practice import PracticeEngine
from serve import TeachingServer

COURSE = json.loads((ROOT/'web/course/catalog.json').read_text('utf-8'))
CHOICES = {
    'p00-recovery': ['A','C'], 'p00-connections': ['B'], 'p00-purpose': ['A','C'],
    'p00-traditions': ['A','B','D'], 'p00-perspectives': ['A'], 'p00-complement': ['A','C'],
    'p00-rounds': ['A'], 'p00-evidence': ['A','C'], 'p00-route': ['A'],
}


def test_introduction_is_separate_from_the_numbered_curriculum():
    generated = build(write=False)
    assert generated == COURSE
    assert len(generated['parts']) == 17
    assert sum(len(p['chapters']) for p in generated['parts']) == 85
    intro = generated['introduction']
    assert intro['id'] == '0.1' and intro['introduction'] and intro['available']
    assert intro['url'] == '/introduction/'
    assert [l['number'] for l in intro['lessons']] == ['导论·1','导论·2','导论·3']
    assert {q['id'] for l in intro['lessons'] for q in l['questions']} == CHOICES.keys()
    assert all(q['type']=='choice' for l in intro['lessons'] for q in l['questions'])
    legacy = deepcopy(generated)
    del legacy['introduction']
    assert list(course_chapters(generated))[1:] == list(course_chapters(legacy))
    assert all(not c.get('introduction') for c in course_chapters(legacy))


def notebook_model():
    path=ROOT/'notebooks/00-导论/03-从系统问题走向计算与证据.ipynb'
    nb=json.loads(path.read_text('utf-8'))
    cell=next(c for c in nb['cells'] if c.get('metadata',{}).get('teaching_role')=='model')
    tree=ast.parse(''.join(cell['source']))
    function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='propagate')
    namespace={}
    exec(compile(ast.Module(body=[function],type_ignores=[]),str(path),'exec'),namespace)
    return namespace['propagate']


def reference_distances(edges,start):
    """独立参考：一次广度优先搜索得到最短联系数，再与轮次比较。"""
    neighbours=[[] for _ in range(6)]
    for left,right in edges:
        neighbours[left].append(right);neighbours[right].append(left)
    distance=[float('inf')]*6
    distance[start]=0;queue=deque([start])
    while queue:
        node=queue.popleft()
        for other in neighbours[node]:
            if distance[other]==float('inf'):
                distance[other]=distance[node]+1;queue.append(other)
    return distance


@pytest.mark.parametrize('edges',[
    [(0,1),(1,2),(2,3),(3,4),(4,5)],
    [(0,1),(0,2),(0,3),(0,4),(0,5)], [],
    [(0,1),(1,2),(2,0),(3,4)],
])
def test_notebook_synchronous_steps_match_independent_path_lengths(edges):
    propagate=notebook_model()
    for start in range(6):
        distances=reference_distances(edges,start)
        for rounds in range(6):
            expected=[[d<=t for d in distances] for t in range(rounds+1)]
            assert propagate(edges,start,rounds)==expected
            assert propagate(list(reversed(edges)),start,rounds)==expected


def submit_choice(engine,qid,selected):
    return engine.submit(dict(exercise_id=qid,exercise_version=engine.questions[qid]['version'],
                              request_id=str(uuid4()),selected=selected),'choice')


def test_self_checks_preserve_existing_records_and_all_capstone_scores(tmp_path):
    directory=tmp_path/'learning'
    engine=PracticeEngine(directory)
    try:
        capstone=engine.assessments['P01-SUMMARY']['items'][0]['question_id']
        submit_choice(engine,capstone,engine.verification[capstone]['correct'])
        submit_choice(engine,'p01-boundary',['A','C'])
        old=deepcopy(engine.progress())
        files={p.name:p.read_bytes() for p in engine.attempts.glob('*.json')}
        for qid,correct in CHOICES.items():
            q=engine.question(qid)
            assert 'assessment' not in q
            assert engine.verification[qid]['correct']==correct
            assert set(engine.verification[qid]['explanations'])=={o['id'] for o in q['options']}
            wrong=[next(letter for letter in 'ABCD' if letter not in correct)]
            assert submit_choice(engine,qid,wrong)['verdict']=='WA'
            assert qid not in engine.progress()['passed']
            assert submit_choice(engine,qid,correct)['verdict']=='AC'
        after=engine.progress()
        assert after['assessments']==old['assessments']
        assert set(after['passed'])-CHOICES.keys()==set(old['passed'])
        assert all((engine.attempts/name).read_bytes()==data for name,data in files.items())
        snapshots={p.name:p.read_bytes() for p in engine.attempts.glob('*.json')}
    finally:
        engine.close()
    restarted=PracticeEngine(directory)
    try:
        assert restarted.progress()==after
        assert all((restarted.attempts/name).read_bytes()==data for name,data in snapshots.items())
    finally:
        restarted.close()


@pytest.fixture
def server(tmp_path):
    opened=[]
    instance=TeachingServer(('127.0.0.1',0),learning_directory=tmp_path/'learning',opener=opened.append)
    thread=threading.Thread(target=instance.serve_forever,kwargs={'poll_interval':.01},daemon=True)
    thread.start()
    yield instance,opened
    instance.shutdown();instance.server_close();thread.join(timeout=2)


def fetch(instance,path,*,data=None):
    headers={'X-Local-Token':instance.token,'Content-Type':'application/json'} if data is not None else {}
    request=Request(f'http://127.0.0.1:{instance.server_port}{quote(path,safe="/?=&%")}',
                    data=json.dumps(data).encode() if data is not None else None,headers=headers)
    try:
        response=urlopen(request,timeout=4)
    except HTTPError as error:
        response=error
    with response:
        return response.status,response.headers,response.read()


def test_all_introduction_routes_and_notebook_open_use_existing_interfaces(server):
    instance,opened=server
    for path in ['/introduction/','/introduction/explore/','/introduction/practice/?question=p00-rounds']:
        status,headers,body=fetch(instance,path)
        assert status==200 and headers.get_content_type()=='text/html'
        assert b'<!doctype html>' in body.lower()
    for lesson in COURSE['introduction']['lessons']:
        status,_,body=fetch(instance,'/api/notebooks/open',data={'id':lesson['id']})
        assert status==202 and json.loads(body)['id']==lesson['id']
    assert opened==[(ROOT/l['path']).resolve() for l in COURSE['introduction']['lessons']]
    assert not instance.practice.records


def test_legacy_catalog_routes_remain_available(server):
    instance,_=server
    instance.course=deepcopy(instance.course)
    instance.course.pop('introduction')
    assert fetch(instance,'/catalog/')[0]==200
    first=instance.course['parts'][0]['chapters'][0]
    assert fetch(instance,first['url'])[0]==200
    assert fetch(instance,first['url']+'practice/')[0]==200
    assert fetch(instance,'/introduction/')[0]==404
