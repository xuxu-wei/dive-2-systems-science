"""The strict convergence condition and the isolated revision's grade history."""
import json
from pathlib import Path
import sys,uuid
import pytest
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from practice import PracticeEngine,RequestError
QID='p08-conditioning'

def submit(engine,qid,selected,version=None):
 return engine.submit(dict(exercise_id=qid,exercise_version=version or engine.questions[qid]['version'],request_id=str(uuid.uuid4()),selected=selected),'choice')

def test_conditioning_text_matches_strict_contraction_and_boundary():
 bank=json.loads((ROOT/'exercises/08-优化方法与计算/questions.json').read_text(encoding='utf-8'))
 q=next(q for q in bank if q['id']==QID)
 assert q['version']=='2'
 option=next(o['text'] for o in q['options'] if o['id']=='B')
 assert '任意非零误差逐步趋于零' in option and '0<η<0.02' in option
 assert '不发散' not in option
 for eta in [.001,.01,.019]:assert abs(1-100*eta)<1
 boundary=[(1-100*.02)**n for n in range(8)]
 assert boundary==[1,-1,1,-1,1,-1,1,-1]
 assert max(map(abs,boundary))==1
 assert abs(1-100*.021)>1

def test_conditioning_revision_preserves_history_and_unrelated_progress(tmp_path):
 directory=tmp_path/'learning';old=PracticeEngine(directory)
 try:
  old.questions[QID]['version']='1'
  record=submit(old,QID,['A','B','D'])
  other=submit(old,'p08-loss-units',['A','C','D'])
  assert record['verdict']==other['verdict']=='AC'
 finally:old.close()
 path=directory/'attempts'/f'{record["id"]}.json';original=path.read_bytes()
 current=PracticeEngine(directory)
 try:
  assert current.get(record['id'])['exercise_version']=='1'
  assert path.read_bytes()==original
  assert QID not in current.progress()['passed']
  assert 'p08-loss-units' in current.progress()['passed']
  with pytest.raises(RequestError) as error:submit(current,QID,['A','B','D'],'1')
  assert error.value.status==409
  new=submit(current,QID,['A','B','D'])
  assert new['verdict']=='AC' and new['exercise_version']=='2'
  assert QID in current.progress()['passed']
  assert path.read_bytes()==original
 finally:current.close()
