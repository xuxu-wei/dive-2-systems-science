import assert from 'node:assert/strict';
import test from 'node:test';
import {trueState,reducedState,nextKind,distance} from './model.mjs';

test('training trajectory is exactly captured by rank one',()=>{
  for(const t of [0,.2,1,5])assert.ok(distance(trueState('train',t),reducedState('train',t,1))<1e-12);
});
test('unseen fast direction gives initial error and can violate positivity',()=>{
  const held=reducedState('holdout',0,1);
  assert.deepEqual(trueState('holdout',0),[3,0,0]);
  assert.ok(Math.abs(distance(held,trueState('holdout',0))-Math.sqrt(1.5))<1e-12);
  assert.ok(held[2]<0);
  assert.ok(Math.abs(held.reduce((a,b)=>a+b,0)-3)<1e-12);
});
test('rank zero keeps the training center and paired condition reverses',()=>{
  assert.deepEqual(reducedState('train',1,0),reducedState('holdout',3,0));
  assert.equal(nextKind(nextKind('train')),'train');
});
