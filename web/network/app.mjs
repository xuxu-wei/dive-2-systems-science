import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {theme} from '../shared/theme.mjs';
import {ringRewire,graphStats,diffusion,propagate,synchrony,alternate} from './model.mjs';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const blue=theme.data['1'],pink=theme.data['2'],green=theme.data['3'],gray=theme.data.reference;
const fmt=value=>value===null?'未定义':typeof value==='number'?Number(value.toPrecision(4)).toString():String(value);
const node=(tag,attrs={},value)=>{const item=document.createElementNS(ns,tag);for(const[key,v]of Object.entries(attrs))item.setAttribute(key,v);if(value!==undefined)item.textContent=value;return item;};
let chapter,mode,settings={},playback;
const definitions={
 "11.1": {
  "title": "换一条连接，哪些路线会变短？",
  "question": "节点数和边数相同，把规则环的一些边接到其他节点后，先判断哪些距离可能缩短、哪些邻居三角形可能消失。",
  "explanation": "左图逐条显示当前网络的边，右图按编号画各节点度。度、聚类与平均路径始终从完整边表计算，所以播放是在揭示同一张图；改变重连概率才重新生成连接。",
  "formula": "度 dᵢ=ΣⱼAᵢⱼ；Σᵢdᵢ=2|E|；全图平均路径仅在连通时定义。",
  "heading": "网络结构与节点度",
  "label": "全图平均路径 / 边",
  "assumptions": "12节点，每个节点起初连左右各2个邻居，共24边。按环上的同一方向记录每条原边，保留记录的出发端，另一端选非自身且尚未相连的节点；排序端点用于保存无向边。网页固定生成种子17，正文用多张网络比较波动。",
  "note": "蓝线属于原规则环，粉线是新位置的边；右图与读数使用当前完整网络。断连时全图平均路径显示“未定义”。环上位置按显示需要安排，模型输入是边表。",
  "controls": [
   [
    "rewire",
    "重连概率 p",
    0,
    1,
    0.05,
    0
   ]
  ]
 },
 "11.2": {
  "title": "两组之间断开后，物质怎样分配？",
  "question": "关闭1—2的交换通道后，分别预测全图、0—1组和2—3组的总量，再连接通道观察变化。",
  "explanation": "左图按室0到3画总量，右图把0—1与2—3两组分别相加。桥关闭时每组独立守恒；桥打开后物质能跨组交换，全图总量仍保持6 U。",
  "formula": "m⁺=m−hL(m/V)；Vᵢ=1；无外源时 Σᵢmᵢ 恒定。",
  "heading": "扩散轨迹与分量收支",
  "label": "当前全图总量 / U",
  "assumptions": "初态按0、1、2、3排列为[4,0,2,0] U，容积均为1 V。物理系数：0—1为1 V/T，2—3为0.5 V/T，桥1—2为0.5 V/T；关闭桥令其系数为0。固定更新80次，步长h改变时总观察时长也变为80h。",
  "note": "右图蓝线是0—1组总量，粉线是2—3组总量，桥打开后仍按这两组显示。调步长时结合时刻读数比较，并检查逐室非负；桥连接时Euler非负保证要求h≤2/3 T，断开时为h≤1 T。",
  "controls": [
   [
    "bridge",
    "跨组桥：0断开 / 1连接",
    0,
    1,
    1,
    0
   ],
   [
    "dt",
    "数值步长 h / T",
    0.05,
    0.8,
    0.05,
    0.1
   ]
  ]
 },
 "11.3": {
  "title": "同一份传播表，在两张图上会怎样？",
  "question": "保持12人、24边、起点0号及同一传播抽样，换连接后先预测第一步哪些人可能感染，再逐步对照S、I、R人数。",
  "explanation": "本步感染与恢复均读取旧状态，判定完成后一起写回。新感染者下一步才传播，本步恢复的旧感染者仍可传播。左图画三个状态人数，右图将I与R相加，表示截至当前步的曾感染人数。",
  "formula": "旧S任一旧I邻居的比较值<β时变I；旧I恢复值<0.22时变R；同时写回。",
  "heading": "固定抽样表的传播路径",
  "label": "当前曾感染人数 / 人",
  "assumptions": "12人、24条无向边；规则环或概率0.45的重连图使用网络种子41。每边每步感染概率β、逐人恢复概率0.22，固定抽样流119，观察14步。网页从0号开始，正文结构比较另轮换起点并按网络与传播分层重复。",
  "note": "蓝线S、粉线I、绿线R，三人数相加为12；右图为累计曾感染人数。只有初始感染者的结果也保留；末步仍有I时，观察期后还可能继续传播。",
  "controls": [
   [
    "rewired",
    "结构：0规则 / 1重连",
    0,
    1,
    1,
    0
   ],
   [
    "beta",
    "每边感染概率 β",
    0.1,
    0.8,
    0.05,
    0.25
   ]
  ]
 },
 "11.4": {
  "title": "相位集中与平均速度怎样一起读？",
  "question": "增强耦合前，先区分两个指标：当前R看相位箭头是否集中，过去60步的频率极差看转动速度是否接近。",
  "explanation": "左图每一时刻把单位相位向量求平均再取长度，得到R；右图用同一节点的未取模相位位移除以尾窗时长，再取各节点频率的最大差。整体同相与相同平均频率分别由两种计算回答。",
  "formula": "R=|n⁻¹Σⱼexp(iθⱼ)|；ω̂ᵢ=[θᵢ(t)−θᵢ(t−60h)]/(60h)。",
  "heading": "相位一致与频率锁定",
  "label": "当前相位序参量 R",
  "assumptions": "12振子、24边，规则环或概率0.45的重连图使用种子17。0.7到1.3 rad/T的同一频率集合打乱后固定分配，两结构共用这份分配和初相；耦合按节点度归一化。步长0.035 T，共360步，60步尾窗长2.1 T。",
  "note": "R处于0到1，反相分组可使全局R小而组内仍同相。右图到第60步才有完整窗口，之前显示未定义；Notebook再比较4种频率分配各配4组初相。",
  "controls": [
   [
    "rewired",
    "结构：0规则 / 1重连",
    0,
    1,
    1,
    0
   ],
   [
    "coupling",
    "耦合尺度 K / rad/T",
    0,
    2.5,
    0.1,
    1.2
   ]
  ]
 }
};
function controls(){settings={};$('sliders').replaceChildren();for(const[key,label,min,max,step,value]of definitions[mode].controls){settings[key]=value;const row=el('div',null,'slider'),caption=el('label',label),input=el('input'),output=el('output',fmt(value));input.type='range';input.id='parameter-'+key;input.min=min;input.max=max;input.step=step;input.value=value;caption.htmlFor=input.id;output.id='parameter-value-'+key;input.addEventListener('input',()=>guard(()=>{settings[key]=Number(input.value);output.textContent=fmt(settings[key]);recompute();}));row.append(caption,output,input);$('sliders').append(row);}}
function set(values){Object.assign(settings,values);for(const[key,value]of Object.entries(values)){$('parameter-'+key).value=value;$('parameter-value-'+key).textContent=fmt(value);}recompute();}
function recompute(){const labels={'11.1':settings.rewire>.1?'恢复规则环':'切换为重连图','11.2':settings.bridge?'断开跨组桥':'连接跨组桥','11.3':settings.rewired?'恢复规则接触图':'切换为重连接触图','11.4':settings.rewired?'恢复规则耦合图':'切换为重连耦合图'};$('alternate').textContent=labels[mode];playback?.pause();playback?playback.seek(100):draw(100);}
function axes(chart,{xmin,xmax,ymin,ymax,xlabel,ylabel}){const x=v=>66+444*(v-xmin)/(xmax-xmin),y=v=>310-264*(v-ymin)/(ymax-ymin);for(let j=0;j<=4;j++){const value=ymin+(ymax-ymin)*j/4;chart.append(node('line',{x1:66,y1:y(value),x2:510,y2:y(value),stroke:gray,opacity:.15}),node('text',{x:57,y:y(value)+5,'text-anchor':'end','font-size':13,fill:gray},fmt(value)));}for(let j=0;j<=4;j++){const value=xmin+(xmax-xmin)*j/4;chart.append(node('text',{x:x(value),y:337,'text-anchor':'middle','font-size':13,fill:gray},fmt(value)));}chart.append(node('text',{x:288,y:376,'text-anchor':'middle','font-size':15,fill:gray},xlabel),node('text',{x:66,y:25,'font-size':15,fill:gray},ylabel));return{x,y,xmin,xmax,ymin,ymax};}
function curve(chart,points,a,color,width=2.6){let path='',open=false;for(const[x,y]of points){if(!Number.isFinite(x+y)||x<a.xmin||x>a.xmax||y<a.ymin||y>a.ymax){open=false;continue;}path+=`${open?'L':'M'}${a.x(x)},${a.y(y)} `;open=true;}chart.append(node('path',{d:path,fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round'}));}
function dot(chart,point,a,color){if(!point||!Number.isFinite(point[0]+point[1]))return;chart.append(node('circle',{cx:a.x(point[0]),cy:a.y(point[1]),r:5,fill:color,stroke:'white','stroke-width':1.5}));}
function table(rows){const tab=el('table'),body=el('tbody');for(const[key,value]of rows){const row=el('tr');row.append(el('th',key),el('td',Array.isArray(value)?value.map(fmt).join('，'):fmt(value)));body.append(row);}tab.append(body);$('value-table').replaceChildren(tab);}
function legend(items){$('legend').replaceChildren();for(const[label,color]of items){const item=el('span'),swatch=el('i');swatch.style.background=color;item.append(swatch,document.createTextNode(label));$('legend').append(item);}}
function draw(progress){const fraction=progress/100,left=$('chart'),right=$('detail-chart'),def=definitions[mode];$('timeline').value=progress;$('play-counter').textContent=`进度 ${progress.toFixed(1)}%`;for(const[chart,prefix]of [[left,'svg'],[right,'detail']])chart.replaceChildren(node('title',{id:prefix+'-title'},def.heading),node('desc',{id:prefix+'-desc'},def.note));
 if(mode==='11.1'){
  const edges=ringRewire(12,4,settings.rewire,17),baseline=ringRewire(12,4,0,17),original=new Set(baseline.map(e=>e.join(':'))),stats=graphStats(12,edges),shown=Math.floor(fraction*edges.length),center=[288,177],position=i=>[center[0]+116*Math.cos(2*Math.PI*i/12-Math.PI/2),center[1]+116*Math.sin(2*Math.PI*i/12-Math.PI/2)];
  for(const[i,j]of edges.slice(0,shown)){const a=position(i),b=position(j);left.append(node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:original.has(key(i,j))?blue:pink,'stroke-width':3,opacity:.78}));}
  for(let i=0;i<12;i++){const [x,y]=position(i);left.append(node('circle',{cx:x,cy:y,r:15,fill:'#fff',stroke:blue,'stroke-width':2}),node('text',{x,y:y+5,'text-anchor':'middle',fill:'#26384a','font-size':13},i));}
  const a=axes(right,{xmin:0,xmax:12,ymin:0,ymax:8,xlabel:'节点编号',ylabel:'度 / 条'});for(let i=0;i<12;i++)right.append(node('rect',{x:a.x(i)+3,y:a.y(stats.degree[i]),width:18,height:a.y(0)-a.y(stats.degree[i]),fill:blue,opacity:.78}));
  $('value').textContent=fmt(stats.path);$('time-readout').textContent=`已揭示 ${shown}/${edges.length} 条边`;$('observation-value').textContent=`平均局部聚类 ${fmt(stats.clustering)}；连通分量 ${stats.components}；边数始终 ${edges.length}。`;legend([['原环中的边',blue],['重连边',pink]]);table([['节点数',12],['边数',edges.length],['度和',stats.degree.reduce((a,b)=>a+b,0)],['全图平均路径',stats.path],['平均局部聚类',stats.clustering],['连通分量',stats.components]]);
 }
 if(mode==='11.2'){
  const data=diffusion(Boolean(settings.bridge),settings.dt),n=Math.floor(fraction*80),a=axes(left,{xmin:0,xmax:80*settings.dt,ymin:-1,ymax:5,xlabel:'时间 / T',ylabel:'各室总量 / U'}),b=axes(right,{xmin:0,xmax:80*settings.dt,ymin:0,ymax:6.2,xlabel:'时间 / T',ylabel:'原分组总量 / U'});
  for(let j=0;j<4;j++){const color=[blue,pink,green,gray][j];curve(left,data.states.slice(0,n+1).map((row,i)=>[i*settings.dt,row[j]]),a,color);dot(left,[n*settings.dt,data.states[n][j]],a,color);}
  for(let j=0;j<2;j++){const color=j?pink:blue;curve(right,data.componentMass.slice(0,n+1).map((row,i)=>[i*settings.dt,row[j]]),b,color);dot(right,[n*settings.dt,data.componentMass[n][j]],b,color);}
  $('value').textContent=fmt(data.mass[n]);$('time-readout').textContent=`时刻 ${fmt(n*settings.dt)} T`;$('observation-value').textContent=`当前两组 ${data.componentMass[n].map(fmt).join(' / ')} U；最小室总量 ${fmt(Math.min(...data.states[n]))} U。`;legend([['室0；右图0—1组',blue],['室1；右图2—3组',pink],['室2',green],['室3',gray]]);table([['跨组桥',settings.bridge?'连接':'断开'],['全图总量',data.mass[n]],['0—1组、2—3组总量 / U',data.componentMass[n]],['各室总量 [m₀,m₁,m₂,m₃] / U',data.states[n]],['数值步长',settings.dt]]);
 }
 if(mode==='11.3'){
  const data=propagate(Boolean(settings.rewired),settings.beta),n=Math.floor(fraction*14),a=axes(left,{xmin:0,xmax:14,ymin:0,ymax:12,xlabel:'步',ylabel:'人数'}),b=axes(right,{xmin:0,xmax:14,ymin:0,ymax:12,xlabel:'步',ylabel:'曾感染人数'});
  for(let j=0;j<3;j++){const color=[blue,pink,green][j];curve(left,data.counts.slice(0,n+1).map((row,i)=>[i,row[j]]),a,color);dot(left,[n,data.counts[n][j]],a,color);}
  const ever=data.counts.slice(0,n+1).map((row,i)=>[i,12-row[0]]);curve(right,ever,b,pink);dot(right,ever.at(-1),b,pink);
  $('value').textContent=fmt(ever.at(-1)[1]);$('time-readout').textContent=`第 ${n} 步`;$('observation-value').textContent=`当前 S/I/R = ${data.counts[n].join(' / ')} 人；这是给定抽样表的一次运行。`;legend([['易感 S',blue],['感染 I / 曾感染',pink],['恢复 R',green]]);table([['结构',settings.rewired?'等边数重连图':'规则环'],['边数',data.edges.length],['当前 S/I/R',data.counts[n]],['曾感染',ever.at(-1)[1]],['每边传播概率',settings.beta]]);
 }
 if(mode==='11.4'){
  const data=synchrony(Boolean(settings.rewired),settings.coupling),n=Math.floor(fraction*360),a=axes(left,{xmin:0,xmax:360*data.dt,ymin:0,ymax:1.05,xlabel:'时间 / T',ylabel:'R'}),b=axes(right,{xmin:0,xmax:360*data.dt,ymin:0,ymax:.7,xlabel:'时间 / T',ylabel:'频率极差 / rad/T'});
  curve(left,data.r.slice(0,n+1).map((v,i)=>[i*data.dt,v]),a,blue);dot(left,[n*data.dt,data.r[n]],a,blue);
  curve(right,data.spread.slice(0,n+1).map((v,i)=>[i*data.dt,v]),b,pink);if(data.spread[n]!==null)dot(right,[n*data.dt,data.spread[n]],b,pink);
  $('value').textContent=fmt(data.r[n]);$('time-readout').textContent=`时刻 ${fmt(n*data.dt)} T`;$('observation-value').textContent=`尾窗频率极差 ${fmt(data.spread[n])} rad/T；${n<60?'尚未形成60步尾窗。':'指标基于过去60步。'}`;legend([['相位序参量 R',blue],['尾窗频率极差',pink]]);table([['结构',settings.rewired?'等边数重连图':'规则环'],['边数',data.edges.length],['当前 R',data.r[n]],['尾窗频率极差',data.spread[n]],['耦合尺度',settings.coupling]]);
 }
}
function key(a,b){return[Math.min(a,b),Math.max(a,b)].join(':');}
function failed(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent=`探索未能运行：${error.message}。请刷新重试。`;for(const id of ['controls','play','replay','timeline'])$(id).disabled=true;playback?.pause();}
function guard(fn){try{fn();}catch(error){failed(error);}}
async function start(){({current:chapter}=await mountShell('explore'));mode=chapter?.id;const def=definitions[mode];if(!def)throw Error('本章没有此探索页');$('eyebrow').textContent=chapter.id+' 章 · 可视化与探索';for(const id of ['title','question','explanation','formula','assumptions'])$(id).textContent=def[id];$('chart-heading').textContent=def.heading;$('value-label').textContent=def.label;$('chart-note').textContent=def.note;$('preset-note').textContent='先跟算一步，再播放对照；按钮可切换连接，滑块可重新设定参数。';controls();recompute();
 playback=createPlayback({duration:100,speed:10,update:draw,failed,changed:reason=>{$('play').textContent=reason==='playing'?'暂停':'播放';$('play-status').textContent=reason==='playing'?'正在播放，观察图形与数值变化。':reason==='ended'?'已展示完整条件；点击播放可从起点观察。':reason==='hidden'?'切离页面后已暂停。':'已暂停，可拖动观察位置。';}});
 $('play').addEventListener('click',()=>guard(()=>playback.running?playback.pause():playback.play()));$('replay').addEventListener('click',()=>guard(()=>{playback.seek(0);playback.play();}));$('timeline').addEventListener('input',()=>guard(()=>playback.seek(Number($('timeline').value))));$('alternate').addEventListener('click',()=>guard(()=>set(alternate(mode,settings))));$('reset').addEventListener('click',()=>guard(()=>{controls();recompute();}));document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.pause('hidden');});
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const session=await(await fetch('/api/session')).json(),response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})}),result=await response.json();$('open-status').textContent=result.message||result.error;}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}});$('notebooks').append(button);}
 playback.seek(100);for(const id of ['controls','play','replay','timeline'])$(id).disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';document.title=chapter.title+' · 可视化与探索';}
start().catch(failed);
