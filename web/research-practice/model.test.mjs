import test from 'node:test';
import assert from 'node:assert/strict';
import {claimView,protocolView,ablationView,transferView,nextKind} from './model.mjs';

function finite(result){
 assert.ok(result.series.length>0);
 for(const row of result.series)for(const point of row.points)for(const value of point)assert.ok(Number.isFinite(value));
}
test('four chapter views remain finite in both switch states and reverse',()=>{
 const cases=[['17.1',claimView,[3,2],['samples','terms']],['17.2',protocolView,[.1,.1],['fit','support']],['17.3',ablationView,[.2,.1],['error','support']],['17.4',transferView,[.3,.2],['amounts','balance']]];
 for(const [chapter,fn,args,kinds] of cases){for(const kind of kinds)finite(fn(...args,kind));assert.equal(nextKind(chapter,nextKind(chapter,kinds[0])),kinds[0]);}
});
test('original task and course scope remain distinct',()=>{
 const result=claimView(4,2,'samples');
 assert.equal(result.stats[0][1],401);
 assert.equal(result.stats[1][1],100001);
 assert.equal(result.stats[2][1],10);
});
test('two-compartment exchange cancels in the total balance',()=>{
 for(const exchange of [0,.3,.8]){
  const result=transferView(exchange,.2,'balance');
  assert.ok(result.stats[2][1]<1e-7);
  const a=result.series[0].points.at(-1)[1],b=result.series[1].points.at(-1)[1];
  assert.ok(Math.abs(a-b)<1e-8);
 }
});
test('support inspection has explicit reversible labels',()=>{
 const result=protocolView(.2,.1,'support');
 assert.equal(result.series[0].label,'保留系数绝对值');
 assert.equal(nextKind('17.2','fit'),'support');
 assert.equal(nextKind('17.2','support'),'fit');
});
