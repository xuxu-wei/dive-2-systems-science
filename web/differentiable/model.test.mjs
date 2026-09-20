import assert from 'node:assert/strict';
import {test} from 'node:test';
import {graphView,rolloutView,odeView,pinnView,hybridView,nextKind} from './model.mjs';

test('graph finite difference checks the analytical gradient at a moderate step',()=>{
 const result=graphView(-4,.7);
 assert.ok(Number(result.stats[2][1])<1e-7);
 assert.equal(result.series[1].points[0][0],-4);
 assert.match(graphView(-4,2).condition,/2 U.*无量纲数值 x=2/);
});
test('teacher forcing and free rollout are reversible and differ for a changed map',()=>{
 const free=rolloutView(.8,12,'roll'),one=rolloutView(.8,12,'one');
 assert.notEqual(free.stats[0][1],one.stats[0][1]);
 assert.equal(nextKind('15.2',nextKind('15.2','roll')),'roll');
});
test('Euler state and gradient converge toward exact values with refinement',()=>{
 for(const kind of ['state','gradient'])
  assert.ok(odeView(.05,.7,kind).stats[1][1]<odeView(.4,.7,kind).stats[1][1]);
 assert.equal(nextKind('15.3',nextKind('15.3','state')),'state');
});
test('zero PDE residual does not imply correct initial and boundary conditions',()=>{
 const result=pinnView(.2*Math.PI**2,.3);
 assert.ok(result.stats[0][1]<1e-9);
 assert.ok(Math.abs(result.stats[1][1]-.09)<1e-12);
 assert.ok(result.stats[2][1]>.1);
 assert.equal(result.stats[3][0],'参考网格 RMSE');
});
test('same effective clearance has same state but a different flux',()=>{
 const state=hybridView(.6,.3,'state');
 const flux=hybridView(.6,.3,'flux');
 assert.ok(state.stats[1][1]<1e-12);
 assert.ok(Math.abs(flux.stats[2][1]-.2)<1e-12);
 assert.equal(nextKind('15.5',nextKind('15.5','state')),'state');
});
