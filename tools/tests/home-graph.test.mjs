import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nodeProgress, chooseResumePart, chooseResumeNode, cardLabel, nodeFromHash, routeForNode, isLesson, mixColors, categoryColor, getView, directNeighborhood} from '../../web/home/graph-model.mjs';

const graph = JSON.parse(readFileSync(new URL('../../web/home/graph.json', import.meta.url), 'utf8'));
const base = {id:'1', number:'1', kind:'part', available:true, published:1, total:1, questionIds:['a','b'], assessmentIds:['a-summary']};

test('unexplored, partly learned, fully passed and assessment light are distinct', () => {
  assert.equal(nodeProgress(base).glow, 0);
  assert.equal(nodeProgress(base,{started:['a']}).state, 'active');
  const half = nodeProgress(base,{passed:['a']});
  const complete = nodeProgress(base,{passed:['a','b']});
  assert.equal(half.ratio, .5);
  assert.ok(half.glow > 0 && complete.glow > half.glow);
  assert.equal(complete.state, 'complete');
  const withScore = score => nodeProgress(base,{passed:['a','b'],assessments:{'a-summary':{attempted:2,points:100,practice_points:score}}});
  assert.ok(withScore(100).glow > withScore(40).glow);
  assert.equal(withScore(40).score, .4);
  assert.equal(nodeProgress({...base,kind:'chapter'}, {assessments:{'a-summary':{attempted:2,points:100,practice_points:100}}}).score, null);
});

test('zero questions and planned extensions never turn into completed learning', () => {
  assert.equal(nodeProgress({...base, available:false, questionIds:[]}).state, 'new');
  const partial = nodeProgress({...base,published:5,total:6},{passed:['a','b']});
  assert.equal(partial.ratio, 1);
  assert.equal(partial.state, 'active');
  assert.equal(partial.coverage, 5/6);
  assert.ok(partial.glow < nodeProgress(base,{passed:['a','b']}).glow);
  assert.equal(nodeProgress(base,{passed:['a','b'],incomplete:true}).state, 'active');
  assert.equal(nodeProgress(base,{passed:['a','b'],incomplete:true,assessments:{'a-summary':{attempted:1,points:1,practice_points:1}}}).score,null);
});

test('progress deduplicates IDs and does not count unrelated or old sample answers', () => {
  const value = nodeProgress({...base,questionIds:['a','a','b']},{passed:['a','sample-old','unknown'],started:['sample-old']});
  assert.equal(value.passed,1);assert.equal(value.total,2);assert.equal(value.ratio,.5);
  assert.equal(nodeProgress(base,{passed:['sample-old']}).glow,0);
  assert.equal(nodeProgress(base,{passed:null,started:{}}).state,'new');
});

test('resume selection uses available course order, active attempts and delivered completion', () => {
  const second={...base,id:'2',number:'2',questionIds:['c']};
  const last={...base,id:'3',number:'3',questionIds:['d'],published:5,total:6};
  const planned={...base,id:'4',number:'4',questionIds:[],available:false,published:0};
  const nodes=[last,planned,second,base];
  assert.equal(chooseResumePart(nodes).id,'1');
  assert.equal(chooseResumePart(nodes,{started:['c']}).id,'2');
  assert.equal(chooseResumePart(nodes,{passed:['a','b']}).id,'2');
  assert.equal(chooseResumePart(nodes,{passed:['a','b','c','d']}).id,'3');
  assert.equal(chooseResumePart([]),null);
});

test('five lens colors blend deterministically without dim encoded-color averaging', () => {
  const taxonomy=[{id:'a',color:'#ff0000'},{id:'b',color:'#0000ff'}];
  assert.equal(mixColors(['a'],taxonomy),'#ff0000');
  assert.equal(mixColors(['a','b'],taxonomy),'#bc00bc');
  assert.equal(mixColors(['b','a','a'],taxonomy),'#bc00bc');
  assert.equal(mixColors(['unknown'],taxonomy),'#9cbbdd');
});

test('both requested palettes follow the five lenses in their existing order', () => {
  assert.deepEqual(graph.taxonomy.map(t=>t.id),['method','evolution','cognition','regulation','practice']);
  for (const [theme, expected] of [
    ['dark',['#d1e4e6','#f4e1c1','#2b4a8c','#4f7c8c','#fbc9b4']],
    ['light',['#2c2f4b','#ffb300','#2b4a8c','#4f7c8c','#fbc9b4']],
  ]) {
    assert.deepEqual(graph.taxonomy.map(t=>categoryColor(t,theme).toLowerCase()),expected);
    for (const t of graph.taxonomy) assert.equal(mixColors([t.id],graph.taxonomy,theme),categoryColor(t,theme));
  }
});

test('theme-dependent blending retains identity, deduplicates categories and accepts legacy palettes', () => {
  const palette=[{id:'a',color:'#ff0000',lightColor:'#00ff00'},{id:'b',color:'#0000ff',lightColor:'#ff0000'}];
  const before=JSON.stringify(palette);
  assert.equal(mixColors(['a','b'],palette,'dark'),'#bc00bc');
  assert.equal(mixColors(['a','b'],palette,'light'),'#bcbc00');
  assert.equal(mixColors(['b','a','a'],palette,'light'),'#bcbc00');
  assert.equal(mixColors(['a'],[{id:'a',color:'#ff0000'}],'light'),'#ff0000');
  assert.equal(JSON.stringify(palette),before);
});

test('each view selects only the requested hierarchy level and its direct edges', () => {
  const root=getView(graph);
  assert.equal(root.nodes[0].kind,'introduction');
  assert.ok(root.nodes.slice(1).every(n=>n.kind==='part'));
  const part=getView(graph,root.nodes[1].id);
  assert.ok(part.nodes.every(n=>n.kind==='chapter'));
  const chapter=getView(graph,part.nodes[0].id);
  assert.ok(chapter.nodes.length>0 && chapter.nodes.every(n=>n.kind==='concept'));
  for (const view of [root,part,chapter]) {
    const ids=new Set(view.nodes.map(n=>n.id));
    assert.ok(view.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));
  }
  assert.deepEqual(getView(graph,'no-such-parent'),{nodes:[],edges:[]});
  assert.deepEqual([...directNeighborhood('a',[{source:'a',target:'b'},{source:'b',target:'c'}])],['a','b']);
});

test('independent introduction cycles before part one without changing body numbering',()=>{
  const root=getView(graph).nodes, introduction=root[0];
  assert.equal(cardLabel(introduction,root),'00 · 导论');
  assert.equal(cardLabel(root[1],root),'第 1 / 17 篇');
  assert.equal(cardLabel(root.at(-1),root),'第 17 / 17 篇');
  assert.equal(introduction.questionIds.length,9);
  const lessons=getView(graph,introduction.id).nodes;
  assert.equal(lessons.length,3);
  assert.ok(lessons.every(n=>isLesson(n)&&n.questionIds.length===3));
  assert.ok(!lessons[0].visualizationUrl&&!lessons[1].visualizationUrl);
  assert.equal(lessons[2].visualizationUrl,'/introduction/explore/');
  const progress={passed:introduction.questionIds,assessments:{}};
  assert.equal(nodeProgress(introduction,progress).state,'complete');
  assert.equal(nodeProgress(root[1],progress).state,'new');
  assert.equal(nodeProgress(introduction,progress).score,null);
});

test('fresh learners start at introduction, returning readers keep active-part priority',()=>{
  const introduction=graph.nodes.find(n=>n.kind==='introduction'), part=graph.nodes.find(n=>n.kind==='part');
  assert.equal(chooseResumeNode(graph.nodes).id,introduction.id);
  assert.equal(chooseResumeNode(graph.nodes,{started:[part.questionIds[0]]}).id,part.id);
  assert.equal(chooseResumeNode(graph.nodes,{passed:introduction.questionIds}).id,part.id);
  const legacy={...graph,nodes:graph.nodes.filter(n=>!['introduction','lesson'].includes(n.kind))};
  assert.equal(chooseResumeNode(legacy.nodes).id,part.id);
  assert.ok(getView(legacy).nodes.every(n=>n.kind==='part'));
  assert.equal(nodeFromHash(legacy,'#introduction'),null);
});

test('introduction routes round-trip alongside existing part and chapter deep links',()=>{
  for(const node of graph.nodes.filter(n=>['part','chapter','introduction'].includes(n.kind))){
    assert.equal(nodeFromHash(graph,routeForNode(node).slice(1)),node.id);
  }
  assert.equal(routeForNode(null),'/');
  for(const hash of ['#part=introduction','#chapter=1','#part=%XX','#lesson=P00-C01-S01'])assert.equal(nodeFromHash(graph,hash),null);
});

test('concept radiance is explicitly the linked lesson exercise progress', () => {
  const concept=graph.nodes.find(n=>n.kind==='concept'&&n.available);
  assert.ok(concept.lessonId && concept.lessonNumber && concept.lessonTitle);
  assert.match(nodeProgress(concept).scope,/小节练习.*不等同/);
  assert.equal(nodeProgress(concept).score,null);
});
