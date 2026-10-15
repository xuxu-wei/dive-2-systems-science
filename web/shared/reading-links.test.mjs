import test from 'node:test';
import assert from 'node:assert/strict';
import {questionReadingReference,explorationReadingReferences} from './reading-links.mjs';
const chapter={lessons:[
  {id:'lesson-a',questions:[{id:'question-a',reading_url:'/read/2/#propagation',concept_title:'传播规则'}],concepts:[
    {id:'state',key:'lesson-a:state',title:'状态',url:'/read/1/#state',explore:false},
    {id:'spread',key:'lesson-a:spread',title:'传播',url:'/read/1/#spread',explore:true}]},
  {id:'lesson-b',questions:[{id:'legacy-question'}],concepts:[
    {id:'propagation',key:'lesson-b:propagation',title:'传播规则',url:'/read/2/#propagation',explore:true}]}
]};
test('题目可链接同章另一课的精确概念',()=>{
  assert.deepEqual(questionReadingReference(chapter,'question-a'),{url:'/read/2/#propagation',title:'传播规则'});
});
test('未迁移题目和未知题目不制造正文入口',()=>{
  assert.equal(questionReadingReference(chapter,'legacy-question'),null);
  assert.equal(questionReadingReference(chapter,'missing'),null);
  assert.equal(questionReadingReference(undefined,'missing'),null);
});
test('无概念参数时列出可视化实际支持的讲解',()=>{
  const refs=explorationReadingReferences(chapter);
  assert.equal(refs.selected,null);
  assert.deepEqual(refs.items.map(item=>item.key),['lesson-a:spread','lesson-b:propagation']);
});
test('从有效概念入口返回其原始课节和锚点',()=>{
  const {selected}=explorationReadingReferences(chapter,'?concept=lesson-b%3Apropagation');
  assert.deepEqual(selected,{key:'lesson-b:propagation',url:'/read/2/#propagation',title:'传播规则',lessonId:'lesson-b'});
});
test('参数不能选择未提供可视化的概念',()=>{
  assert.equal(explorationReadingReferences(chapter,'?concept=lesson-a%3Astate').selected,null);
});
test('其他章节和任意链接参数不能制造返回入口',()=>{
  for(const search of ['?concept=other%3Aspread','?concept=https%3A%2F%2Fexample.com','?concept=javascript%3Aalert(1)']){
    const refs=explorationReadingReferences(chapter,search);
    assert.equal(refs.selected,null);
    assert.equal(refs.items.length,2);
  }
});
test('尚无讲解的章节保持为空且不改写课程目录',()=>{
  const before=JSON.stringify(chapter);
  assert.deepEqual(explorationReadingReferences({lessons:[{id:'future'}]}),{items:[],selected:null});
  explorationReadingReferences(chapter,'?concept=lesson-a%3Aspread');
  questionReadingReference(chapter,'question-a');
  assert.equal(JSON.stringify(chapter),before);
});
