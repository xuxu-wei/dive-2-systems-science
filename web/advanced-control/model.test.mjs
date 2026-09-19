import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackView,robustView,adaptiveView,stochasticView,consensusView,learningView,decisionView,nextKind} from './model.mjs';

const stat=(result,label)=>result.stats.find(row=>row[0]===label)?.[1];
const finite=result=>{
 assert.ok(result.series.length);
 for(const row of result.series)for(const point of row.points)for(const value of point)assert.ok(Number.isFinite(value));
};

test('seven exploration models remain finite across both displayed cases',()=>{
 const ranges=[
  [feedbackView,[.2,1.5],['energy','path']],
  [robustView,[.5,1.5],['inside','outside']],
  [adaptiveView,[.95,.4],['estimate','state']],
  [stochasticView,[.6,.4],['variance','mean']],
  [consensusView,[.4,1],['states','spread']],
  [learningView,[.4,.8],['q','visits']],
  [decisionView,[1,.5],['prediction','actual']]
 ];
 for(const [fn,args,kinds] of ranges)for(const kind of kinds)finite(fn(...args,kind));
});

test('each case switch returns to its original state',()=>{
 for(let i=1;i<=7;i++){const chapter='16.'+i,initial=['energy','inside','estimate','variance','states','q','prediction'][i-1];
  assert.equal(nextKind(chapter,nextKind(chapter,initial)),initial);}
});

test('feedback uses actual saturated input and reveals positive energy derivative',()=>{
 const result=feedbackView(.4,2,'energy');
 assert.equal(stat(result,'实际输入 / U/T'),-.4);
 assert.ok(stat(result,'当前 V 导数 / U²/T')>0);
});

test('common certificate covers interval, exterior is a separate example',()=>{
 const inside=robustView(.5,1,'inside'),outside=robustView(.5,1,'outside');
 assert.ok(stat(inside,'两顶点最大裕度')<0);
 assert.ok(stat(outside,'当前矩阵最大裕度')>0);
});

test('consensus conserves sum while a delayed run may increase spread',()=>{
 const delayed=consensusView(.4,1,'spread'),noDelay=consensusView(.4,0,'spread');
 assert.ok(Math.abs(stat(delayed,'终点总和 / U')-4)<1e-9);
 assert.ok(stat(delayed,'终点最大差 / U')>stat(noDelay,'终点最大差 / U'));
});

test('failed finite-action search is shown explicitly',()=>{
 const result=decisionView(1.4,0,'prediction');
 assert.equal(stat(result,'选中动作 / U'),'无可行解');
});
