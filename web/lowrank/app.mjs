import {mountShell,el} from '../shared/course-shell.mjs';
import {trueState,reducedState,nextKind,distance} from './model.mjs';

const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const colors={exact:'#008bfb',reduced:'#ff0051',ink:'#4b6176',line:'#bfcbd9'};
const settings={kind:'train',rank:1,time:0};
const fmt=value=>Number(value.toFixed(3)).toString();
function svg(tag,attrs={},label){const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);if(label!==undefined)node.textContent=label;return node;}
function draw(){
 const chart=$('bars'),exact=trueState(settings.kind,settings.time),reduced=reducedState(settings.kind,settings.time,settings.rank);
 chart.replaceChildren(svg('title',{id:'bars-title'},'三室完整模型与降阶结果'),svg('desc',{id:'bars-desc'},'蓝色完整模型，粉色降阶模型；纵轴总量 U，可能出现负值。'));
 const left=68,top=34,height=272,baseline=top+height*(3.2/4.2),scale=height/4.2;
 for(const value of [-1,0,1,2,3]){
  const y=baseline-value*scale;
  chart.append(svg('line',{x1:left,y1:y,x2:660,y2:y,stroke:colors.line,'stroke-width':value===0?2:1,opacity:value===0?.9:.55}),
               svg('text',{x:left-12,y:y+5,'text-anchor':'end','font-size':14,fill:colors.ink},String(value)));
 }
 chart.append(svg('text',{x:68,y:18,'font-size':15,fill:colors.ink},'总量 / U'));
 for(let room=0;room<3;room++){
  const center=160+room*190;
  for(const[value,offset,color]of [[exact[room],-25,colors.exact],[reduced[room],25,colors.reduced]]){
   const y=baseline-value*scale;
   chart.append(svg('rect',{x:center+offset-18,y:Math.min(y,baseline),width:36,height:Math.max(1,Math.abs(baseline-y)),rx:4,fill:color,opacity:.83}));
  }
  chart.append(svg('text',{x:center,y:338,'text-anchor':'middle','font-size':16,fill:colors.ink},'第'+(room+1)+'室'));
 }
 $('numbers').replaceChildren(...[['当前误差 / U',distance(exact,reduced)],['完整模型总量 / U',exact.reduce((a,b)=>a+b,0)],['降阶模型总量 / U',reduced.reduce((a,b)=>a+b,0)]].map(([label,value])=>{const card=el('div');card.append(el('span',label),el('strong',fmt(value)));return card;}));
 $('rank-value').textContent=String(settings.rank);$('time-value').textContent=fmt(settings.time)+' T';
 $('current-condition').textContent='当前：'+(settings.kind==='train'?'训练初值 [2,1,0]':'留出初值 [3,0,0]')+' U；保留 '+settings.rank+' 个方向。';
 $('toggle-initial').textContent=settings.kind==='train'?'切换到留出初值':'切换回训练初值';
 $('finding').textContent=settings.kind==='holdout'&&settings.rank===1?'留出初值包含训练未激发的快方向；当前降阶误差为 '+fmt(distance(exact,reduced))+' U。t=0 时该误差已经存在，与时间步长无关。':settings.rank===0?'秩0只保留训练均值；它无法跟随当前轨迹的变化。':'训练轨迹在这个特殊模型中恰由一个衰减方向描述；检查留出初值能发现表示限制。';
}
function fail(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent='探索未能运行：'+error.message+'。请刷新重试。';$('controls').disabled=true;}
function guard(fn){try{fn();}catch(error){fail(error);}}
async function openLesson(lesson,button){button.disabled=true;try{const session=await(await fetch('/api/session')).json();const response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})});const result=await response.json();$('open-status').textContent=result.message||result.error||'打开请求已发送。';}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}}
async function start(){
 const {current:chapter}=await mountShell('explore');if(chapter?.id!=='14.1')throw Error('本章没有此探索页');
 $('rank').addEventListener('input',()=>guard(()=>{settings.rank=Number($('rank').value);draw();}));
 $('time').addEventListener('input',()=>guard(()=>{settings.time=Number($('time').value);draw();}));
 $('toggle-initial').addEventListener('click',()=>guard(()=>{settings.kind=nextKind(settings.kind);draw();}));
 $('reset').addEventListener('click',()=>guard(()=>{Object.assign(settings,{kind:'train',rank:1,time:0});$('rank').value='1';$('time').value='0';draw();}));
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',()=>openLesson(lesson,button));$('notebooks').append(button);}
 draw();$('controls').disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';
}
start().catch(fail);
