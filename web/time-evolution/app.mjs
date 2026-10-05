import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {theme,seriesColors} from '../shared/theme.mjs';
import {exact,euler,properties,alternateNumerical,alternateInterval,alternateSpeed} from './model.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg',end=12;
const fmt=n=>Number(n.toFixed(6)).toString();
const svg=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
let current,mode,params={},series=[],playback;
const defaults={discrete:{initial:0,u:1,k:.5,h:1},continuous:{initial:0,u:1,k:.5},numerical:{initial:10,u:0,k:.75,h:1}};
function slider(key,label,min,max,step,value){
  params[key]=value;const group=el('div',undefined,'slider'),lab=el('label',label),out=el('output',String(value)),input=el('input');
  Object.assign(input,{id:key,type:'range',min,max,step,value});lab.htmlFor=key;out.htmlFor=key;out.id=key+'-value';
  input.addEventListener('input',()=>{params[key]=Number(input.value);out.value=input.value;recompute();});group.append(lab,out,input);$('sliders').append(group);
}
function setParams(values){for(const [key,value] of Object.entries(values)){params[key]=value;$(key).value=value;$(key+'-value').value=value;}recompute();}
function analytical(u,k,label,color=seriesColors.exact){
  const times=Array.from({length:241},(_,i)=>end*i/240);
  return {times,values:times.map(t=>exact(t,u,k,params.initial)),value:t=>exact(t,u,k,params.initial),label,color};
}
function recompute(){
  const {initial,u,k,h}=params;
  if(mode==='discrete'){
    series=[{...euler(initial,u,k,h),label:`段首规则 h=${h} T`,color:theme.data['1'],dots:true},
      {...euler(initial,u,k,h/2),label:`相同速率 h=${h/2} T`,color:theme.data['2'],dash:true,dots:true}];
    $('alternate').textContent=`切换到${h>.5?'较细':'较粗'}间隔 ${alternateInterval(h)} T`;
    $('preset-note').textContent='切换只改变更新间隔；观察区间、流入与清除系数不变。每段使用实际时长。';
  }else if(mode==='continuous'){
    series=[analytical(u,k,'当前输入与清除'),{...analytical(2*u,2*k,'输入与清除同时加倍',theme.data['2']),dash:true}];
    $('alternate').textContent=k>.5?'切回 u=1、k=0.5 示例':'切换到 u=2、k=1 示例';
    $('preset-note').textContent=k>0?`当前平衡量 ${fmt(u/k)} U，特征时间 ${fmt(1/k)} T；虚线的特征时间减半。`:'k=0：当前为线性累积，不使用 u/k 或 1/k。';
  }else{
    series=[analytical(u,k,'连续解析解'),{...euler(initial,u,k,h),label:`欧拉法 h=${h} T`,color:seriesColors.euler,dash:true,dots:true}];
    const negative=initial+h*(u-k*initial)<0;
    $('alternate').textContent=negative?'切换到正值示例':'切换到负值示例';
    $('preset-note').textContent='成对示例均用 A0=10 U、u=0、k=0.75/T；负值例 h=2 T，正值例 h=1 T。连续模型相同。';
  }
  if(series.some(s=>s.values.some(v=>!Number.isFinite(v))))throw Error('数值超出范围，请恢复起始条件。');
  $('mechanism').replaceChildren(el('span',`流入速率 ${u} U/T`),el('span','→','direction'),el('span','池中总量 A / U','system'),el('span','→','direction'),el('span',`清除速率 ${k} × A U/T`));
  $('legend').replaceChildren(...series.map(s=>{const n=el('span',s.label,s.dash?'dashed':'');n.style.setProperty('--line-color',s.color);return n;}));
  const source=mode==='numerical'?series[1]:series[0],t=el('table'),row=el('tr');
  row.append(el('th','时间 / T'),el('th',source.label+' / U'),el('th',mode==='numerical'?'同一时刻的解析总量 / U':'该点的计算方式'));t.append(row);
  source.times.forEach((time,i)=>{if(mode==='continuous'&&i%20)return;const r=el('tr');r.append(el('td',fmt(time)),el('td',fmt(source.values[i])),el('td',mode==='numerical'?fmt(exact(time,u,k,initial)):mode==='continuous'?'由解析函数求值':'完成一次所选规则更新'));t.append(r);});
  $('value-table').replaceChildren(t);if(playback)playback.seek(0);else draw(0);
}
function draw(time){
  const target=mode==='numerical'?series[1]:series[0];
  let i=target.times.findLastIndex(t=>t<=time+1e-10);i=Math.max(0,i);
  const value=target.value?target.value(time):target.values[i],shownTime=target.value?time:target.times[i];
  $('timeline').value=time;$('time-readout').textContent=`t = ${time.toFixed(2)} T / ${end} T`;
  $('value').textContent=fmt(value)+' U';$('play-counter').textContent=`${time.toFixed(2)} T · ${fmt(value)} U`;
  $('value-label').textContent=target.value?'当前解析总量':`最近完成时刻 ${fmt(shownTime)} T`;
  if(mode==='numerical'){
    const p=properties(params.k,params.h),reference=exact(shownTime,params.u,params.k,params.initial);
    $('observation').textContent=`每步偏差乘 q=${fmt(p.q)}；偏差随更新趋于零：${p.stable?'是':'否'}；对任意非负起点和流入保证总量非负：${p.nonnegative?'是':'否'}。当前计算点的绝对误差为 ${fmt(Math.abs(value-reference))} U。`;
  }else $('observation').textContent=mode==='continuous'?'同一初始量，比较同一时刻；改变速度时同时检查终点趋势。':'标记在更新完成时出现；较小间隔会改变每步的输入量与清除比例。';
  $('model-warning').hidden=!(value<0);$('model-warning').textContent='当前步长产生了负总量。减小步长，再比较数值曲线与连续解。';
  const low=Math.min(0,...series.flatMap(s=>s.values)),high=Math.max(1,...series.flatMap(s=>s.values)),pad=(high-low)*.12;
  const x=t=>75+t/end*675,y=v=>315-(v-low+pad)/(high-low+2*pad)*270;
  const chart=$('chart');chart.replaceChildren(svg('title',{id:'svg-title'},'同一条件下的总量轨迹'),svg('desc',{id:'svg-desc'},`当前 ${fmt(value)} U；精确数值见图下表格。`));
  for(let j=0;j<=4;j++){const v=low+(high-low)*j/4;chart.append(svg('line',{x1:75,x2:750,y1:y(v),y2:y(v),stroke:theme.ui.tint,'stroke-opacity':.5}),svg('text',{x:64,y:y(v)+5,'text-anchor':'end',fill:theme.ui.text,'font-size':14},Number(v.toPrecision(4))));}
  chart.append(svg('line',{x1:75,x2:750,y1:y(0),y2:y(0),stroke:theme.data.reference,'stroke-dasharray':'3 5'}));
  for(let t=0;t<=end;t+=2)chart.append(svg('text',{x:x(t),y:342,'text-anchor':'middle',fill:theme.ui.text,'font-size':14},t));
  chart.append(svg('text',{x:415,y:374,'text-anchor':'middle',fill:theme.ui.text,'font-size':15},'时间 / T'),svg('text',{x:75,y:22,fill:theme.ui.text,'font-size':15},'总量 / U'));
  for(const s of series){
    const points=s.times.map((t,i)=>[t,s.values[i]]).filter(([t])=>t<=time+1e-10);
    if(s.value&&points.at(-1)?.[0]<time)points.push([time,s.value(time)]);
    chart.append(svg('polyline',{points:points.map(([t,v])=>`${x(t)},${y(v)}`).join(' '),fill:'none',stroke:s.color,'stroke-width':3,...(s.dash?{'stroke-dasharray':'8 5'}:{})}));
    if(s.dots)for(const [t,v] of points)chart.append(svg('circle',{cx:x(t),cy:y(v),r:3.4,fill:s.color}));
    else if(points.length){const [t,v]=points.at(-1);chart.append(svg('circle',{cx:x(t),cy:y(v),r:4,fill:s.color}));}
  }
  chart.append(svg('line',{x1:x(time),x2:x(time),y1:35,y2:320,stroke:theme.ui.primary,'stroke-opacity':.3,'stroke-dasharray':'2 4'}));
}
function failed(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent=`可视化未能运行：${error.message}。请刷新页面重试。`;document.querySelectorAll('#controls,#play,#replay,#timeline').forEach(n=>n.disabled=true);}
async function start(){
  ({current}=await mountShell('explore'));mode={'2.1':'discrete','2.3':'continuous','2.4':'numerical'}[current?.id];if(!mode)throw Error('该章没有此探索页');
  $('eyebrow').textContent=`${current.id} 章 · 可视化与探索`;
  $('title').textContent={discrete:'逐次更新会得到怎样的总量变化',continuous:'相同的平衡，可以有不同的速度',numerical:'同一个清除过程为何算出了负总量'}[mode];
  $('question').textContent={discrete:'保持起点、流入速率 u、清除系数 k 和观察终点不变，把每次更新的间隔减半，终点总量会怎样改变？先预测，再播放比较。',continuous:'把恒定流入速率 u 和清除系数 k 同时加倍，从同一起点出发，总量会靠近什么值，又需要多长时间？',numerical:'没有流入时，连续模型的物质总量逐渐减少并保持非负。为什么欧拉更新可能算出负值？先切换两种步长，再比较同一时刻的结果。'}[mode];
  $('explanation').textContent={discrete:'每段先用段首总量 A 计算清除速率 kA，再将流入速率与清除速率各乘实际时长，得到本段进入和移除的量。两条曲线分别用 h 和 h/2 更新；较短间隔会更早根据新的总量重新计算清除速率。',continuous:'实线采用当前的 u、k，虚线将二者同时加倍。当 k>0 时，两者的平衡总量 u/k 相同，虚线的偏离衰减得更快，特征时间 1/k 减半。若起点已等于平衡值，两条曲线都保持不变；k=0 时则比较线性积累。',numerical:'欧拉更新每步把偏差乘 1−kh。偏差能否趋于零、物质总量能否保持非负，要分别判断。先观察 h=2 T 时从 10 U 更新到 −5 U 的一步，再减小 h，与连续解逐点比较误差。'}[mode];
  $('formula').textContent=mode==='continuous'?'A(t) = A0 exp(−kt) + (u/k)(1−exp(−kt))；k=0 时 A=A0+ut':'下一段总量 = 当前量 + 实际时长 × (u − k × 当前量)';
  $('assumptions').textContent='这里把所追踪物质看作均匀分布在一个池中，流入速率恒定，清除速率为 kA，没有内部生成或瞬时注入。A0 的单位为 U，u 为 U/T，k 为 1/T。';
  $('reading-prompt').textContent=mode==='numerical'?'在 Notebook 中推导步长条件，计算整段过程的最大误差，再让网格停在流入速率改变的时刻。':'在 Notebook 中展开收支与解析解的推导，并用手算核对曲线上的数值。';
  const values=defaults[mode];slider('initial','初始总量 A0 / U',0,20,.5,values.initial);slider('u','流入速率 u / (U/T)',0,4,.25,values.u);slider('k','清除系数 k / (1/T)',0,1,.05,values.k);
  if(mode!=='continuous')slider('h','名义步长 h / T',.25,3,.25,values.h);
  recompute();playback=createPlayback({duration:end,speed:2,update:draw,failed,changed:reason=>{$('play').textContent=reason==='playing'?'暂停':reason==='ended'?'再次播放':'播放';$('play-status').textContent=reason==='playing'?'正在播放：观察时间、数值与曲线。':reason==='ended'?'已到终点，可往返切换示例或重播。':'已暂停；拖动时间查看结果，改变条件会回到起点。';}});
  $('play').addEventListener('click',()=>playback.running?playback.pause():playback.play());$('replay').addEventListener('click',()=>{playback.seek(0);playback.play();});$('timeline').addEventListener('input',()=>playback.seek(Number($('timeline').value)));
  $('alternate').addEventListener('click',()=>setParams(mode==='numerical'?alternateNumerical(params):mode==='discrete'?{h:alternateInterval(params.h)}:alternateSpeed(params.k)));
  $('reset').addEventListener('click',()=>setParams(defaults[mode]));document.addEventListener('visibilitychange',()=>{if(document.hidden&&playback.running)playback.pause();});
  for(const lesson of current.lessons){const button=el('button',`在默认 IDE 打开：${lesson.title}`);button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const r=await fetch('/api/session'),session=await r.json();const result=await(await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})})).json();$('open-status').textContent=result.message||result.error;}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}});$('notebooks').append(button);}
  playback.seek(0);document.querySelectorAll('#controls,#play,#replay,#timeline').forEach(n=>n.disabled=false);document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';document.title=current.title+' · 可视化与探索';
}
start().catch(failed);
