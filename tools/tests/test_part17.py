"""Independent equations, gradient direction, contracts and real judge for Part 17."""
import json
import math
from pathlib import Path
import sys
import time
import uuid

import numpy as np
import pytest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from practice import PracticeEngine

BOOK=ROOT/'notebooks/17-研究复现与综合实践'
BANK=ROOT/'exercises/17-研究复现与综合实践'
CATALOG=json.loads((BOOK/'catalog.json').read_text(encoding='utf-8'))
QUESTIONS=json.loads((BANK/'questions.json').read_text(encoding='utf-8'))
VERIFY=json.loads((BANK/'verification.json').read_text(encoding='utf-8'))
SOLUTIONS=json.loads((BANK/'solutions.json').read_text(encoding='utf-8'))
PYTHON=[q for q in QUESTIONS if q['type']=='python']

def notebook_functions():
    scope={'np':np,'math':math,'itertools':__import__('itertools')}
    for lesson in CATALOG:
        data=json.loads((ROOT/lesson['path']).read_text(encoding='utf-8'))
        for cell in data['cells']:
            if 'model' in cell.get('metadata',{}).get('tags',[]):
                exec(''.join(cell['source']),scope)
    return scope

def test_structure_and_reproduction_boundary():
    assert len(CATALOG)==9 and len(QUESTIONS)==40 and len(PYTHON)==19
    counts={entry['id']:0 for entry in CATALOG}
    for question in QUESTIONS:
        counts[question['lesson_id']]+=1
        if question['type']=='python':
            assert question['starter_code'].startswith('def solve(\n')
            assert len(VERIFY[question['id']]['cases'])>=2
            assert 'payload' not in question['starter_code']
    assert sorted(counts.values())==[4]*8+[8]
    assessment=json.loads((BANK/'assessment.json').read_text(encoding='utf-8'))
    assert [sum(row['points'] for row in assessment['items'] if row['level']==level) for level in [1,2,3,4]]==[20,30,30,20]
    assert {row['objective'] for row in assessment['items']}=={'T1','T2','T3','T4'}
    course=json.loads((ROOT/'web/course/catalog.json').read_text(encoding='utf-8'))
    assert all(chapter['available'] for chapter in course['parts'][16]['chapters'])
    def prose_for(number):
        entry=next(entry for entry in CATALOG if entry['number']==number)
        cells=json.loads((ROOT/entry['path']).read_text(encoding='utf-8'))['cells']
        return '\n'.join(''.join(cell['source']) for cell in cells[:-1] if cell['cell_type']=='markdown')
    # Check the actual paper/course configurations, not a mandatory disclaimer.
    lorenz=prose_for('17.1.1')
    assert all(value in lorenz for value in ('0—100', '0.001', '五次多项式', '前 4', '0.01', '二次字典'))
    spiral=prose_for('17.1.2')
    assert all(value in spiral for value in ('RNN 编码器', '四维潜变量', '四参数', '可见状态'))
    assert '双室交换与清除' in prose_for('17.4.1')

def test_lorenz_sindy_against_known_equations_and_independent_initial_state():
    f=notebook_functions()
    np.testing.assert_allclose(f['lorenz_rhs']([-8,7,27]),[150,-15,-128])
    train=f['rk4_path'](f['lorenz_rhs'],[-8,7,27],.01,400)
    X,labels=f['polynomial_library'](train,2)
    Y=np.asarray([f['lorenz_rhs'](row) for row in train])
    coef=f['stlsq'](X,Y,.1,10)
    expected=np.zeros_like(coef)
    for term,col,value in [('x',0,-10),('y',0,10),('x',1,28),('y',1,-1),('x*z',1,-1),('x*y',2,1),('z',2,-8/3)]:expected[labels.index(term),col]=value
    np.testing.assert_allclose(coef,expected,atol=.15)
    independent=f['rk4_path'](f['lorenz_rhs'],[1,1,1],.01,80)
    recovered=f['rk4_path'](lambda state:f['polynomial_library'](state,2)[0][0]@coef,[1,1,1],.01,80)
    assert np.sqrt(np.mean((independent-recovered)**2))<.05

def test_continuous_adjoint_against_finite_difference_and_analytic_spiral():
    f=notebook_functions()
    initial=[1.,0.];h=.02;indices=np.arange(0,101,5)
    observed=f['spiral_exact'](initial,.08,2.,indices*h)
    theta=np.array([.11,1.85,.02,-.02])
    loss,gradient,path=f['adjoint_spiral'](initial,theta,h,indices,observed)
    assert loss>0 and path.shape==(101,2)
    fd=[]
    for j in range(4):
        shift=np.eye(4)[j]*1e-5
        fd.append((f['adjoint_spiral'](initial,theta+shift,h,indices,observed)[0]-f['adjoint_spiral'](initial,theta-shift,h,indices,observed)[0])/(2e-5))
    np.testing.assert_allclose(gradient,fd,rtol=.025,atol=.003)
    np.testing.assert_allclose(f['rk4_spiral'](initial,[.08,2.,0.,0.],h,100),f['spiral_exact'](initial,.08,2.,np.arange(101)*h),atol=1e-5)

def test_clearance_conservation_and_failure_metrics():
    f=notebook_functions()
    for amounts in [[2.,1.],[0.,3.]]:
        rates=f['clearance_rhs'](amounts,[.2,0.],[.1,.2],.3)
        assert sum(rates)==pytest.approx(.2-.1*amounts[0]-.2*amounts[1])
    score=f['clearance_score']([1.,2.],[1.,-1.],.5,.2,3.,3.3)
    assert score==pytest.approx([math.sqrt(4.5),0.,1.],abs=1e-12)
    report=f['paired_report']([.3,.4],[.2,.5],[False,True])
    assert report==pytest.approx([0.,.1,.5],abs=1e-12)

@pytest.mark.parametrize('question',PYTHON,ids=lambda q:q['slug'])
def test_real_judge_samples_full_and_wrong(tmp_path,question):
    engine=PracticeEngine(tmp_path/'records')
    def submit(mode,source):
        outcome=engine.submit({'exercise_id':question['id'],'exercise_version':question['version'],'request_id':str(uuid.uuid4()),'source':source,'mode':mode},'python')
        deadline=time.monotonic()+40
        while outcome['state']!='FINISHED' and time.monotonic()<deadline:
            time.sleep(.01);outcome=engine.get(outcome['id'])
        assert outcome['state']=='FINISHED'
        return outcome
    try:
        assert submit('samples',SOLUTIONS[question['id']])['verdict']=='AC'
        assert question['id'] not in engine.progress()['passed']
        assert submit('full',SOLUTIONS[question['id']])['verdict']=='AC'
        wrong=question['starter_code'].replace('raise NotImplementedError("请完成计算")','return None')
        assert submit('full',wrong)['verdict']=='WA'
    finally:engine.close()
