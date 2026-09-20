"""Independent mathematical checks and real judging for formal Part 14."""
import ast
import json
import math
from pathlib import Path
import subprocess
import sys
import time
import uuid

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from practice import PracticeEngine

BANK = ROOT / 'exercises/14-数据驱动动力学与模型降阶'
QUESTIONS = json.loads((BANK / 'questions.json').read_text(encoding='utf-8'))
VERIFY = json.loads((BANK / 'verification.json').read_text(encoding='utf-8'))
SOLUTIONS = json.loads((BANK / 'solutions.json').read_text(encoding='utf-8'))
PYTHON = [item for item in QUESTIONS if item['type'] == 'python']


def notebook_functions():
    scope = {'np': np, 'math': math}
    catalog = json.loads((ROOT / 'notebooks/14-数据驱动动力学与模型降阶/catalog.json').read_text(encoding='utf-8'))
    for entry in catalog:
        notebook = json.loads((ROOT / entry['path']).read_text(encoding='utf-8'))
        for cell in notebook['cells']:
            if 'model' in cell.get('metadata', {}).get('tags', []):
                source = ''.join(cell['source'])
                assert all(isinstance(node, ast.FunctionDef) for node in ast.parse(source).body)
                exec(compile(source, entry['path'], 'exec'), scope)
    return scope


def test_structure_and_public_contracts():
    catalog = json.loads((ROOT / 'notebooks/14-数据驱动动力学与模型降阶/catalog.json').read_text(encoding='utf-8'))
    assert len(catalog) == 11 and len(QUESTIONS) == 48 and len(PYTHON) == 14
    assert len({item['id'] for item in QUESTIONS}) == 48
    counts = {entry['id']: 0 for entry in catalog}
    for item in QUESTIONS:
        counts[item['lesson_id']] += 1
        if item['type'] == 'choice':
            assert set(VERIFY[item['id']]['explanations']) == {'A','B','C','D'}
        else:
            assert item['entrypoint'] == 'solve'
            assert all(field['name'] != 'payload' for field in item['parameters'])
            assert item['samples'] and len(VERIFY[item['id']]['cases']) >= 3
    assert sorted(counts.values()) == [4]*10 + [8]
    assessment = json.loads((BANK / 'assessment.json').read_text(encoding='utf-8'))
    assert [sum(item['points'] for item in assessment['items'] if item['level'] == level)
            for level in (1,2,3,4)] == [20,30,30,20]
    assert {item['objective'] for item in assessment['items']} == {'T1','T2','T3','T4'}
    course = json.loads((ROOT / 'web/course/catalog.json').read_text(encoding='utf-8'))
    part = course['parts'][13]
    assert part['id'] == '14'
    assert all(chapter['available'] for chapter in part['chapters'])
    assert {entry['visualization'] for entry in catalog[:-1]} == {
        'web/lowrank/index.html','web/datadriven/index.html'}


def test_finite_derivative_uses_only_the_declared_equal_grid():
    question = next(item for item in QUESTIONS if item['id'] == 'p14-finite-derivative')
    assert question['version'] == '2'
    assert '等距' in question['constraints'][0]
    cases = VERIFY[question['id']]['cases']
    for case in cases:
        steps = np.diff(case['arguments']['times'])
        np.testing.assert_allclose(steps, steps[0])
    quadratic = next(case for case in cases if case['arguments']['observations'] == [0., 1., 4., 9.])
    np.testing.assert_allclose(quadratic['expected'], [1., 2., 4., 5.])
    np.testing.assert_allclose(notebook_functions()['finite_derivative'](**quadratic['arguments']),
                               quadratic['expected'])


def test_svd_dmd_and_unseen_direction():
    f = notebook_functions()
    matrix = np.array([[4.,0.],[0.,1.]])
    rebuilt,projection,residual = f['svd_project'](matrix,1)
    np.testing.assert_allclose(rebuilt,[[4,0],[0,0]])
    np.testing.assert_allclose(projection,[[1,0],[0,0]])
    assert residual == pytest.approx(1)
    operator = np.array([[.9,.1],[0.,.8]])
    history = np.asarray(f['linear_roll'](operator,[0.,3.],5))
    np.testing.assert_allclose(history[1],operator@[0.,3.])
    fit = np.asarray(f['dmd_fit'](np.eye(2),operator,2))
    np.testing.assert_allclose(fit,operator,atol=1e-12)
    rank_one = np.asarray(f['dmd_fit']([[2.,0.],[0.,0.]],[[1.,0.],[0.,0.]],2))
    np.testing.assert_allclose(rank_one@np.array([0.,3.]),[0.,0.])
    rates = f['dmd_rates'](.92*math.cos(.5),.92*math.sin(.5),.4)
    np.testing.assert_allclose(rates,[math.log(.92)/.4,.5/.4])


def test_closed_lift_sparse_identification_and_exchange_structure():
    f = notebook_functions()
    a,b,c=.8,.7,.4
    states=[[x,y] for x in [-1.,-.5,.5,1.] for y in [-.2,.2]]
    past=np.asarray([f['triangular_lift'](state) for state in states]).T
    future=np.asarray([f['triangular_lift'](f['triangular_step'](state,a,b,c)) for state in states]).T
    expected=np.array([[a,0,0],[0,b,c],[0,0,a*a]])
    fit=np.asarray(f['edmd_fit'](past,future,0))
    np.testing.assert_allclose(fit,expected,atol=1e-12)
    np.testing.assert_allclose(f['lifted_roll'](fit,[[1,0,0],[0,1,0]],
                                               f['triangular_lift']([1.5,.1]),2)[1],
                               f['triangular_step']([1.5,.1],a,b,c))
    x=np.linspace(.1,2.5,50)
    theta=np.column_stack([np.ones_like(x),x,x*x])
    coefficients,active=f['sparse_stlsq'](theta,1.2*x-.4*x*x,.01,8)
    np.testing.assert_allclose(coefficients,[0,1.2,-.4],atol=1e-10)
    assert active == [1,2]
    assert f['structure_metrics']([[-1,.2],[1,-.2]],.2)[3:] == [True,True]
    assert f['structure_metrics']([[-1,.2],[1,-.2]],2.)[3:] == [True,False]
    # A small negative off-diagonal can be within the tolerance on A but
    # become a large negative entry of the Euler step matrix for a large dt.
    almost_metzler = np.array([[1e-11,-1e-11],[-1e-11,1e-11]])
    step = np.eye(2) + 1e12 * almost_metzler
    np.testing.assert_allclose(step, [[11.,-10.],[-10.,11.]])
    assert f['structure_metrics'](almost_metzler.tolist(),1e12)[3:] == [True,False]
    structure_question = next(q for q in QUESTIONS if q['id'] == 'p14-structure-metrics')
    assert structure_question['version'] == '2'
    assert VERIFY[structure_question['id']]['cases'][-1]['expected'][-1] is False
    assert f['path_metrics']([[1,1]],[[1.2,.8]],[1,1])[1] == pytest.approx(0)


def test_web_models_match_declared_notebook_mechanisms():
    f=notebook_functions()
    source="""import {aliasing,lifted,sparseFit,structureView} from './web/datadriven/model.mjs';
console.log(JSON.stringify({alias:aliasing(.4,4).stats, lift:lifted(1.5,3,'full').series[1].points,
sparse:sparseFit(.01,0), closed:structureView('closed',.2,3).series[0].points}));"""
    result=subprocess.run(['node','--input-type=module','-e',source],text=True,encoding='utf-8',
                          capture_output=True,cwd=ROOT,check=True)
    web=json.loads(result.stdout)
    assert web['alias'][1][1] == pytest.approx(f['dmd_rates'](math.cos(1.6),math.sin(1.6),.4)[1])
    state=[1.5,.1]
    for step,value in web['lift']:
        assert value == pytest.approx(state[1])
        state=f['triangular_step'](state,.8,.7,.4)
    x=np.linspace(.1,1.,50)
    theta=np.column_stack([np.ones_like(x),x,x*x])
    coefficient,active=f['sparse_stlsq'](theta,1.2*x-.4*x*x,.01,8)
    np.testing.assert_allclose(web['sparse']['coefficient'],coefficient,atol=1e-10)
    assert web['sparse']['active'] == active
    for _,amount in web['closed']:
        assert amount == pytest.approx(2)


def test_euler_counterexample_rejects_old_continuous_tolerance_shortcut(tmp_path):
    question = next(q for q in QUESTIONS if q['id'] == 'p14-structure-metrics')
    correct = SOLUTIONS[question['id']]
    old_check = 'bool(least_transfer >= -1e-10 and least_euler_diagonal >= -1e-10)'
    step_check = 'bool(np.all(np.eye(matrix.shape[0]) + dt * matrix >= -1e-10))'
    assert correct.count(step_check) == 1
    old_source = correct.replace(step_check, old_check)
    engine = PracticeEngine(tmp_path / 'records')
    try:
        result = engine.submit({
            'exercise_id': question['id'], 'exercise_version': question['version'],
            'request_id': str(uuid.uuid4()), 'source': old_source, 'mode': 'full'
        }, 'python')
        deadline = time.monotonic() + 40
        while result['state'] != 'FINISHED' and time.monotonic() < deadline:
            time.sleep(.01)
            result = engine.get(result['id'])
        assert result['state'] == 'FINISHED'
        assert result['verdict'] == 'WA'
    finally:
        engine.close()


@pytest.mark.parametrize('question', PYTHON, ids=lambda item: item['slug'])
def test_real_judge_samples_full_and_wrong_submission(tmp_path, question):
    engine=PracticeEngine(tmp_path/'records')

    def submit(mode,source):
        outcome=engine.submit({'exercise_id':question['id'],
                               'exercise_version':question['version'],
                               'request_id':str(uuid.uuid4()),
                               'source':source,'mode':mode},'python')
        deadline=time.monotonic()+40
        while outcome['state']!='FINISHED' and time.monotonic()<deadline:
            time.sleep(.01)
            outcome=engine.get(outcome['id'])
        assert outcome['state']=='FINISHED'
        return outcome

    try:
        assert submit('samples',SOLUTIONS[question['id']])['verdict']=='AC'
        assert question['id'] not in engine.progress()['passed']
        assert submit('full',SOLUTIONS[question['id']])['verdict']=='AC'
        wrong=question['starter_code'].replace('raise NotImplementedError("请完成计算")','return None')
        assert submit('full',wrong)['verdict']=='WA'
    finally:
        engine.close()
