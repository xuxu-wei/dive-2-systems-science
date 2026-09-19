"""Independent model checks and real judging for Part 15."""
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

BOOK=ROOT/'notebooks/15-可微分建模与机制融合'
BANK=ROOT/'exercises/15-可微分建模与机制融合'
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

def test_structure_and_assessment():
    assert len(CATALOG)==11 and len(QUESTIONS)==48 and len(PYTHON)==24
    assert len({q['id'] for q in QUESTIONS})==48
    counts={lesson['id']:0 for lesson in CATALOG}
    for q in QUESTIONS:
        counts[q['lesson_id']]+=1
        if q['type']=='choice':
            assert set(VERIFY[q['id']]['explanations'])==set('ABCD')
            assert len(VERIFY[q['id']]['correct'])==1
        else:
            assert 'payload' not in q['starter_code']
            assert len(VERIFY[q['id']]['cases'])>=2
    assert sorted(counts.values())==[4]*10+[8]
    assessment=json.loads((BANK/'assessment.json').read_text(encoding='utf-8'))
    assert [sum(q['points'] for q in assessment['items'] if q['level']==level)
            for level in (1,2,3,4)]==[20,30,30,20]
    assert {q['objective'] for q in assessment['items']}=={'T1','T2','T3','T4'}
    course=json.loads((ROOT/'web/course/catalog.json').read_text(encoding='utf-8'))
    part=course['parts'][14]
    assert part['id']=='15' and all(ch['available'] for ch in part['chapters'])
    assert all(q['visualization']=='web/differentiable/index.html' for q in CATALOG[:-1])

def test_rendered_mathematics_has_no_escaped_control_characters():
    for lesson in CATALOG:
        notebook=json.loads((ROOT/lesson['path']).read_text(encoding='utf-8'))
        prose='\n'.join(''.join(cell['source']) for cell in notebook['cells']
                        if cell['cell_type']=='markdown')
        assert not any(character in prose for character in ('\t','\f','\r')),lesson['id']
        if lesson['id']=='P15-SUMMARY':
            assert r'\theta\tanh' in prose

def test_gradients_against_independent_analytic_derivatives():
    f=notebook_functions()
    x,y,w,b,v,c=.7,.4,1.1,.2,.9,-.1
    z=w*x+b;a=math.tanh(z);e=v*a+c-y
    expected=[e*v*(1-a*a)*x,e*v*(1-a*a),e*a,e]
    np.testing.assert_allclose(f['scalar_loss_grad'](x,y,w,b,v,c)[2],expected,atol=1e-14)
    np.testing.assert_allclose(f['reverse_tape_grad'](x,y,w,b,v,c)[2],expected,atol=1e-14)
    np.testing.assert_allclose(f['finite_difference_grad'](x,y,w,b,v,c,1e-5),expected,atol=1e-9)
    k,h,n=.7,.1,20
    states,sensitivity=f['euler_forward_sensitivity'](2.,k,h,n)
    np.testing.assert_allclose(states[-1],2*(1-k*h)**n)
    np.testing.assert_allclose(sensitivity[-1],-2*n*h*(1-k*h)**(n-1))
    observations=[(1.,.9),(2.,.45)]
    analytic=sum((2*math.exp(-k*t)-target)*(-t*2*math.exp(-k*t))
                 for t,target in observations)
    assert f['continuous_loss_gradient'](2.,k,observations)[1]==pytest.approx(analytic)
    assert f['adjoint_midpoint_gradient'](2.,k,observations,5)==pytest.approx(analytic)
    grid_targets={10:.9,20:.45}
    discrete=f['euler_reverse_gradient'](2.,k,h,grid_targets)
    eps=1e-6
    def discrete_loss(rate):
        path=f['euler_forward_sensitivity'](2.,rate,h,n)[0]
        return sum((path[i]-target)**2/2 for i,target in grid_targets.items())
    assert discrete==pytest.approx((discrete_loss(k+eps)-discrete_loss(k-eps))/(2*eps),abs=1e-9)

def test_physics_boundary_and_structural_nonidentifiability():
    f=notebook_functions()
    D=.2;rate=D*math.pi**2
    positions=np.linspace(0,1,17);times=np.linspace(0,1,17)
    np.testing.assert_allclose(f['diffusion_parts'](positions,times,D,rate,.3),
                               [0.,.09],atol=1e-14)
    assert f['diffusion_parts'](positions,times,D,rate+.3,0.)[0]>0
    for x,u in [(0.,.1),(.5,.6),(2.,0.)]:
        assert f['confounded_rhs'](x,u,.4,.1)==pytest.approx(
               f['confounded_rhs'](x,u,.6,.3))
    assert f['weighted_prediction']([1.,3.],[1.,3.])==pytest.approx([2.5,.75])

def test_web_models_agree_with_independent_references():
    script="""import {graphView,rolloutView,odeView,pinnView,hybridView} from './web/differentiable/model.mjs';
console.log(JSON.stringify({graph:graphView(-4,.7).stats,roll:rolloutView(.8,8,'roll').series,
ode:odeView(.2,.7,'state').series,pinn:pinnView(.2*Math.PI**2,.3).stats,
hybrid:hybridView(.6,.3,'state').series}));"""
    result=subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,
                          text=True,encoding='utf-8',capture_output=True,check=True)
    web=json.loads(result.stdout)
    assert float(web['graph'][2][1])<1e-7
    truth=web['roll'][0]['points']
    pred=web['roll'][1]['points']
    for step in range(1,len(truth)):
        expected=.88*truth[step-1][1]+.2*.3+.04*math.tanh(truth[step-1][1])
        assert truth[step][1]==pytest.approx(expected)
        expected_pred=.8*pred[step-1][1]+.2*.3+.04*math.tanh(pred[step-1][1])
        assert pred[step][1]==pytest.approx(expected_pred)
    assert web['ode'][0]['points'][-1][1]==pytest.approx(2*math.exp(-1.4))
    assert web['pinn'][0][1]==pytest.approx(0,abs=1e-9)
    assert web['pinn'][1][1]==pytest.approx(.09)
    np.testing.assert_allclose(web['hybrid'][0]['points'],web['hybrid'][1]['points'])

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
