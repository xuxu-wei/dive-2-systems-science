"""Independent references and actual judge execution for Part 16."""
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

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from practice import PracticeEngine

BOOK=ROOT/'notebooks/16-自适应、鲁棒与学习控制'
BANK=ROOT/'exercises/16-自适应、鲁棒与学习控制'
CATALOG=json.loads((BOOK/'catalog.json').read_text(encoding='utf-8'))
QUESTIONS=json.loads((BANK/'questions.json').read_text(encoding='utf-8'))
VERIFY=json.loads((BANK/'verification.json').read_text(encoding='utf-8'))
SOLUTIONS=json.loads((BANK/'solutions.json').read_text(encoding='utf-8'))
PYTHON=[q for q in QUESTIONS if q['type']=='python']

def notebook_functions():
    scope={'np':np,'math':math}
    for lesson in CATALOG:
        notebook=json.loads((ROOT/lesson['path']).read_text(encoding='utf-8'))
        for cell in notebook['cells']:
            if 'model' in cell.get('metadata',{}).get('tags',[]):
                source=''.join(cell['source'])
                assert all(isinstance(node,ast.FunctionDef) for node in ast.parse(source).body)
                exec(compile(source,lesson['path'],'exec'),scope)
    return scope

def test_structure_contracts_and_assessment():
    assert len(CATALOG)==15 and len(QUESTIONS)==64 and len(PYTHON)==32
    assert len({q['id'] for q in QUESTIONS})==64
    counts={lesson['id']:0 for lesson in CATALOG}
    for q in QUESTIONS:
        counts[q['lesson_id']]+=1
        if q['type']=='choice':
            assert set(VERIFY[q['id']]['explanations'])==set('ABCD')
            assert len(VERIFY[q['id']]['correct'])==1
        else:
            assert 'payload' not in q['starter_code']
            assert len(VERIFY[q['id']]['cases'])>=2
            assert q['starter_code'].startswith('def solve(\n')
    assert sorted(counts.values())==[4]*14+[8]
    assessment=json.loads((BANK/'assessment.json').read_text(encoding='utf-8'))
    assert [sum(item['points'] for item in assessment['items'] if item['level']==level)
            for level in (1,2,3,4)]==[20,30,30,20]
    assert {item['objective'] for item in assessment['items']}=={'T1','T2','T3','T4'}
    course=json.loads((ROOT/'web/course/catalog.json').read_text(encoding='utf-8'))
    part=course['parts'][15]
    assert part['id']=='16' and all(ch['available'] for ch in part['chapters'])
    assert all(q['visualization']=='web/advanced-control/index.html' for q in CATALOG[:-1])

def test_prose_and_formula_cells():
    for lesson in CATALOG:
        notebook=json.loads((ROOT/lesson['path']).read_text(encoding='utf-8'))
        prose='\n'.join(''.join(cell['source']) for cell in notebook['cells'] if cell['cell_type']=='markdown')
        assert not any(ch in prose for ch in ('\t','\f','\r')),lesson['id']
        assert '## 学习目标与先修知识' in prose and '## 模型假设' in prose
        assert '## 练习' in prose

def test_control_and_rls_against_independent_algebra():
    f=notebook_functions()
    x=2.;requested=-.8*x-1.2*x**3
    result=f['nonlinear_feedback'](x,.4,.8,.8,1.2,.5)
    np.testing.assert_allclose(result,[requested,-.5,-.4*x+.8*x**3-.5,x*(-.4*x+.8*x**3-.5)])
    vertices=[[[-1.,0.],[0.,-2.]],[[-.5,0.],[0.,-1.]]]
    small,margins,valid=f['common_quadratic'](vertices,[[1.,0.],[0.,1.]])
    assert small==1 and valid
    np.testing.assert_allclose(margins,[-2.,-1.])
    phi=np.array([1.,2.,-.5]);target=np.array([.8,1.7,-.3]);theta0=.3;p0=2.
    estimates,_=f['rls_scalar'](phi,target,theta0,p0,1.,-10.,10.)
    batch=(theta0/p0+np.dot(phi,target))/(1/p0+np.dot(phi,phi))
    assert estimates[-1]==pytest.approx(batch)
    states,inputs,hats=f['adaptive_path'](1.,[.5],[1.],0.,1.,1.,2.,0.,2.)
    assert inputs==[1.] and states==[1.,1.5] and hats[0]==0.

def test_stochastic_network_and_finite_mdp_references():
    f=notebook_functions()
    np.testing.assert_allclose(f['em_path'](1.,1.,.5,.1,[.2,-.1]),[1.,1.,.85])
    assert f['merge_brownian']([.1,-.2,.3,.4],2)==pytest.approx([-.1,.7])
    mean,var=f['ou_moments'](1.,.5,2.,1.)
    assert mean==pytest.approx(math.exp(-.5))
    assert var==pytest.approx(4*(-math.expm1(-1.)))
    weights=[[0.,1.],[1.,0.]]
    np.testing.assert_allclose(f['consensus_step']([0.,2.],weights,.25),[.5,1.5])
    np.testing.assert_allclose(f['delayed_consensus']([[0.,2.]],weights,.25,0,3),
                               f['consensus_path']([0.,2.],weights,.25,3))
    P=[[[.8,.2]],[[0.,1.]]];R=[[1.],[0.]]
    np.testing.assert_allclose(f['policy_values'](P,R,[0,0],.9),[1/(1-.9*.8),0.])
    q=f['q_learning_updates']([[0.,0.],[0.,0.]],[[0,1,2.,1,True]],.5,.9)
    assert q[0][1]==1.
    assert f['constrained_action'](3.,0.,1.,[0.,1.],1.,0.,2.,.1) is None
    np.testing.assert_allclose(f['decision_metrics']([1.,2.],[1.,1.],[0.,2.],1.,[False,True]),
                               [math.sqrt(.5),2.,.5,.5])

def test_web_math_matches_independent_references():
    script="""import {feedbackView,robustView,stochasticView,consensusView,decisionView} from './web/advanced-control/model.mjs';
console.log(JSON.stringify({feedback:feedbackView(.5,1,'energy').stats,robust:robustView(.5,1,'inside').stats,
 stochastic:stochasticView(.6,.4,'variance').series[0].points.at(-1),
 consensus:consensusView(.4,0,'states').stats,decision:decisionView(1,.5,'prediction').stats}));"""
    result=subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,
                          text=True,encoding='utf-8',capture_output=True,check=True)
    web=json.loads(result.stdout)
    assert web['feedback'][1][1]==pytest.approx(-.5)
    assert web['robust'][1][1]<0
    t,var=web['stochastic']
    assert var==pytest.approx(.4**2*(-math.expm1(-2*.6*t))/(2*.6),abs=1e-4)
    assert web['consensus'][1][1]==4
    assert web['decision'][0][1]>=0

@pytest.mark.parametrize('question',PYTHON,ids=lambda q:q['slug'])
def test_real_judge_samples_full_and_wrong(tmp_path,question):
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
