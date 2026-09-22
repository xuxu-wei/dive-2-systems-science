import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connections,propagate} from '../../web/introduction/model.mjs';
import {questionIds,summarize} from '../../web/shared/progress.mjs';

test('hand enumeration distinguishes synchronous transmission and initial position',()=>{
  const counts=rows=>rows.map(row=>row.filter(Boolean).length);
  assert.deepEqual(counts(propagate(connections.chain)),[1,2,3,4,5,6]);
  assert.deepEqual(counts(propagate(connections.star)),[1,6,6,6,6,6]);
  assert.deepEqual(counts(propagate(connections.star,5,3)),[1,2,6,6]);
  assert.deepEqual(counts(propagate([],2,3)),[1,1,1,1]);
  assert.deepEqual(counts(propagate(connections.chain,0,0)),[1]);
});

test('all starts follow independent shortest paths, including disconnected nodes',()=>{
  for(const edges of [...Object.values(connections),[],[[0,1],[1,2],[2,0],[3,4]]]){
    // Floyd–Warshall compares path lengths; it does not simulate spreading rounds.
    const distances=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===j?0:Infinity));
    for(const [a,b] of edges)distances[a][b]=distances[b][a]=1;
    for(let k=0;k<6;k++)for(let i=0;i<6;i++)for(let j=0;j<6;j++)distances[i][j]=Math.min(distances[i][j],distances[i][k]+distances[k][j]);
    for(let start=0;start<6;start++)for(let rounds=0;rounds<=5;rounds++){
      const expected=Array.from({length:rounds+1},(_,t)=>distances[start].map(distance=>distance<=t));
      assert.deepEqual(propagate(edges,start,rounds),expected);
      assert.deepEqual(propagate([...edges].reverse(),start,rounds),expected);
    }
  }
});

test('introduction attempts have their own progress and do not complete a numbered part',()=>{
  const course=JSON.parse(readFileSync(new URL('../../web/course/catalog.json',import.meta.url),'utf8'));
  const intro=questionIds(course.introduction);
  assert.equal(intro.length,9);
  assert.equal(summarize(intro,{passed:intro}).state,'complete');
  for(const part of course.parts){
    assert.ok(questionIds(part).every(id=>!intro.includes(id)));
    assert.equal(summarize(questionIds(part),{passed:intro,started:intro}).state,'new');
  }
  assert.equal(summarize(intro,{passed:[],started:[intro[0]]}).passed,0);
});
