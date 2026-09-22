import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {connections,propagate} from './model.mjs';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const svg=(tag,attrs,text)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;};
const names=['A','B','C','D','E','F'];
const positions=[[210,150],[85,65],[280,45],[345,160],[245,265],[75,240]];
let histories={},round=0,playback,lastDraw=-1;

function drawNetwork(){
  const kind=$('network').value,start=Number($('start-node').value),received=histories[kind][round];
  const label=kind==='chain'?'链形':'星形',recipientNames=names.filter((_,i)=>received[i]).join('、');
  const figure=$('network-figure');
  figure.replaceChildren(svg('title',{id:'network-title'},`${label}，第 ${round} 轮`),svg('desc',{id:'network-description'},`起点 ${names[start]}；已收到：${recipientNames}。线表示双向联系。`));
  for(const [left,right] of connections[kind])figure.append(svg('line',{x1:positions[left][0],y1:positions[left][1],x2:positions[right][0],y2:positions[right][1],stroke:'var(--ui-border)','stroke-width':2}));
  for(const [i,[x,y]] of positions.entries()){
    if(i===start)figure.append(svg('circle',{cx:x,cy:y,r:26,fill:'none',stroke:'var(--ui-text)','stroke-width':2}));
    figure.append(svg('circle',{cx:x,cy:y,r:20,fill:received[i]?'var(--data-1)':'var(--ui-background)',stroke:'var(--ui-primary)','stroke-width':2,...(received[i]?{}:{'stroke-dasharray':'4 3'})}),svg('text',{x,y:y+6,'text-anchor':'middle',fill:received[i]?'#ffffff':'var(--ui-text)','font-size':18},names[i]));
  }
  $('recipients').textContent=`${label} · 起点 ${names[start]} · 已收到：${recipientNames}`;
}

function drawCounts(){
  const figure=$('counts-figure'),x=t=>66+t*100,y=count=>294-count*39;
  const counts=Object.fromEntries(Object.entries(histories).map(([kind,rows])=>[kind,rows.map(row=>row.filter(Boolean).length)]));
  figure.replaceChildren(svg('title',{id:'counts-svg-title'},'同一起点的链形与星形传播人数'),svg('desc',{id:'counts-description'},`第 ${round} 轮，链形 ${counts.chain[round]} 人，星形 ${counts.star[round]} 人。完整人数见图下表格。`));
  for(let count=0;count<=6;count++)figure.append(svg('line',{x1:66,x2:566,y1:y(count),y2:y(count),stroke:'var(--ui-border)','stroke-opacity':.25}),svg('text',{x:51,y:y(count)+5,'text-anchor':'end',fill:'var(--ui-text)','font-size':14},count));
  figure.append(svg('line',{x1:66,x2:566,y1:y(0),y2:y(0),stroke:'var(--ui-border)'}),svg('line',{x1:66,x2:66,y1:y(0),y2:y(6),stroke:'var(--ui-border)'}));
  for(let step=0;step<=5;step++)figure.append(svg('text',{x:x(step),y:318,'text-anchor':'middle',fill:'var(--ui-text)','font-size':14},step));
  figure.append(svg('text',{x:66,y:25,fill:'var(--ui-text)','font-size':15},'累计人数 / 人（含起点）'),svg('text',{x:316,y:348,'text-anchor':'middle',fill:'var(--ui-text)','font-size':15},'轮次'));
  for(const [kind,color,shape] of [['chain','var(--data-1)','circle'],['star','var(--data-2)','rect']]){
    const values=counts[kind].slice(0,round+1);
    figure.append(svg('polyline',{points:values.map((count,step)=>`${x(step)},${y(count)}`).join(' '),fill:'none',stroke:color,'stroke-width':2.5,...(kind==='star'?{'stroke-dasharray':'8 5'}:{})}));
    values.forEach((count,step)=>figure.append(svg(shape,shape==='circle'?{cx:x(step),cy:y(count),r:5,fill:color}:{x:x(step)-4,y:y(count)-4,width:8,height:8,fill:'var(--ui-background)',stroke:color,'stroke-width':2})));
  }
  $('count-readout').textContent=`链形 ${counts.chain[round]} 人 · 星形 ${counts.star[round]} 人`;
  for(const row of $('counts-table').querySelectorAll('[data-round]'))row.setAttribute('aria-current',String(Number(row.dataset.round)===round));
}

function draw(time){
  round=Math.floor(time);
  if(round===lastDraw)return;
  lastDraw=round;drawNetwork();drawCounts();
  $('round-readout').textContent=`第 ${round} / 5 轮`;
  $('step').disabled=round===5;
}
function recompute(){
  const start=Number($('start-node').value);
  histories=Object.fromEntries(Object.entries(connections).map(([kind,edges])=>[kind,propagate(edges,start,5)]));
  const table=el('table'),head=el('thead'),header=el('tr');
  for(const title of ['轮次','链形 / 人','星形 / 人']){const th=el('th',title);th.scope='col';header.append(th);}head.append(header);table.append(head);
  const body=el('tbody');
  for(let step=0;step<=5;step++){const row=el('tr');row.dataset.round=step;for(const value of [step,histories.chain[step].filter(Boolean).length,histories.star[step].filter(Boolean).length])row.append(el('td',String(value)));body.append(row);}
  table.append(body);$('counts-table').replaceChildren(table);lastDraw=-1;
  if(playback)playback.seek(0);else draw(0);
}
function failed(error){playback?.pause();$('loading-note').hidden=false;$('loading-note').textContent=`实验未能运行：${error.message}。请刷新后重试。`;}

async function main(){
  const {current}=await mountShell('explore');
  if(!current?.introduction)throw Error('请从导论的可视化入口打开实验');
  recompute();
  playback=createPlayback({duration:5,speed:1,update:draw,failed,changed:reason=>{
    $('play').textContent=reason==='playing'?'暂停':reason==='ended'?'再次播放':'播放';
    $('play-status').textContent=reason==='playing'?'正在逐轮传递。':reason==='ended'?'已观察五轮。可以改变起点，或再次播放。':'已暂停；重置会恢复链形、A 起点和第 0 轮。';
  }});
  $('network').addEventListener('change',recompute);$('start-node').addEventListener('change',recompute);
  $('step').addEventListener('click',()=>playback.seek(Math.min(5,round+1)));
  $('play').addEventListener('click',()=>playback.running?playback.pause():playback.play());
  $('reset').addEventListener('click',()=>{$('network').value='chain';$('start-node').value='0';recompute();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.pause();});
  $('open-notebook').addEventListener('click',async()=>{
    $('open-notebook').disabled=true;
    try{const session=await (await fetch('/api/session')).json();const result=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:'P00-C01-S03'})});const value=await result.json();$('open-status').textContent=value.message||value.error;}
    catch{$('open-status').textContent='本机连接中断，请恢复连接后重试。';}finally{$('open-notebook').disabled=false;}
  });
  $('experiment').hidden=false;$('loading-note').hidden=true;
  for(const id of ['conditions','step','play','reset'])$(id).disabled=false;
  playback.seek(0);document.body.dataset.ready='true';
}
main().catch(failed);
