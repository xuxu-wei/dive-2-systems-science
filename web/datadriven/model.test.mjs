import test from 'node:test';
import assert from 'node:assert/strict';
import {aliasing,lifted,sparseFit,sparseView,structureView,nextKind} from './model.mjs';

test('sampled angle has a different principal frequency after aliasing',()=>{
 const clear=aliasing(.4,4),aliased=aliasing(1,4);
 assert.equal(clear.stats[1][1],4);
 assert.notEqual(aliased.stats[1][1],4);
 for(const [time,value] of aliased.series[2].points)
  assert.ok(Math.abs(value-Math.exp(-.1*time)*Math.cos(4*time))<1e-12);
});
test('closed lift and omitted quadratic feature differ on held-out initial state',()=>{
 const short=lifted(1.5,6,'short'),full=lifted(1.5,6,'full');
 assert.ok(short.stats[2][1]>.1);
 assert.equal(full.stats[2][1],0);
 assert.equal(nextKind('14.3',nextKind('14.3','short')),'short');
});
test('noiseless sparse recovery and threshold deletion',()=>{
 const exact=sparseFit(.01,0);
 assert.deepEqual(exact.active,[1,2]);
 assert.ok(Math.abs(exact.coefficient[1]-1.2)<1e-8);
 assert.ok(Math.abs(exact.coefficient[2]+.4)<1e-8);
 assert.deepEqual(sparseFit(100,0).active,[]);
 assert.ok(sparseView(.01,.1).stats[2][1]>0);
});
test('closed exchange and bad column sum have distinct balance evidence',()=>{
 assert.equal(structureView('closed',.2,10).stats[0][1],0);
 assert.ok(structureView('leaky',.2,10).stats[0][1]>0);
 assert.ok(structureView('closed',2,2).stats[1][1]<0);
 assert.equal(nextKind('14.5',nextKind('14.5','closed')),'closed');
});
