import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {theme} from '../shared/theme.mjs';
import {normal,conjugate,readings,chains,meanField,emTrace,observations,prediction,alternate} from './model.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const blue=theme.data['1'],pink=theme.data['2'],green=theme.data['3'],gray=theme.data.reference;
const fmt=x=>x===null?'无可行解':Number(x.toPrecision(4)).toString();
const node=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
let chapter,mode,p={},data,playback;
const definitions={
 "9.1": {
  "title": "同一批读数，噪声越大，后验靠近哪里？",
  "question": "保持读数不变，提高单次噪声方差，先判断后验均值更靠近先验均值还是读数平均，再看曲线。",
  "explanation": "各次读数共享一个固定偏差，独立噪声提供的精度与先验精度相加。噪声方差增大时，这批读数的相对权重减小；新读数预测还需加一次新噪声方差。",
  "formula": "v = 1 / (1/4 + n/r)；m = v Σy/r；预测方差 = v+r",
  "heading": "先验、似然形状与后验宽度",
  "label": "当前后验方差 / U²",
  "assumptions": "先验均值0 U、方差4 U²，固定读数逐项列在数值表；噪声独立且与偏差独立。播放逐个加入读数，显示的是更新步骤。玫红似然为比较形状而归一化，原似然并非参数密度。",
  "note": "蓝线为参数后验、灰线为先验、玫红虚线为归一化似然。右图比较参数与新读数的方差；尚无读数时不画似然。",
  "controls": [
   [
    "count",
    "观测个数 n",
    1,
    12,
    1,
    6
   ],
   [
    "noise",
    "观测方差 r / U²",
    0.25,
    6,
    0.25,
    2
   ]
  ]
 },
 "9.2": {
  "title": "两条链都容易接受，能访问两个峰吗？",
  "question": "增大两峰的距离，先判断从两侧出发的短链能否访问另一侧，再比较落在正半轴的比例。",
  "explanation": "对称随机游走用目标密度比决定接受。容易接受、移动足够远与探索两个峰是不同判断；这里用相同600步预算比较两条路径。",
  "formula": "π(x)=½N(−d,1)+½N(d,1)；α=min(1,π(x′)/π(x))",
  "heading": "两条链与正半轴占比",
  "label": "两链最终正半轴占比",
  "assumptions": "两个等权高斯分量均值为−d和d，方差都为1。两链分别从−d、d出发，种子为9201、9202，各运行600步，保留全部点，包括起点与预热阶段。变量已按参考尺度缩放。",
  "note": "蓝线和玫红线分别为两条链。右图比例包括起点；目标落在正半轴的概率为0.5。两条比例接近也可能共同遗漏某些区域，仍需结合轨迹检查。",
  "controls": [
   [
    "separation",
    "模态位置 ±d",
    0,
    5,
    0.25,
    4
   ],
   [
    "step",
    "提议标准差",
    0.1,
    3,
    0.1,
    0.6
   ]
  ]
 },
 "9.3": {
  "title": "均值更新到位了，相关关系也恢复了吗？",
  "question": "提高目标相关系数，先判断独立因子的方差会怎样变化，再比较两种轮廓和剩余KL。",
  "explanation": "一轮先更新第一个均值，再用新值更新第二个。更新能逼近最优均值，独立因子却始终没有交叉协方差。目标已知，证据与下界的差正好等于KL；横线是该分布族的最低差距。",
  "formula": "Σ=[[1,ρ],[ρ,1]]；m₁←ρm₂；m₂←ρm₁；vᵢ=1−ρ²",
  "heading": "相关轮廓与独立因子轮廓",
  "label": "当前 KL / 1",
  "assumptions": "目标为均值0的二维高斯，两个边缘方差都为1。近似的两个初始均值依次为2和−2，运行20轮顺序更新。两种轮廓表示同一目标的精确分布与独立近似。",
  "note": "左图灰色椭圆是相关目标轮廓，蓝色虚线圆是独立近似轮廓，其中心随更新移动。右图画log₁₀(1+KL)；玫红横线表示不能靠更多更新消除的族内限制。",
  "controls": [
   [
    "rho",
    "目标相关系数 ρ",
    0,
    0.95,
    0.05,
    0.8
   ]
  ]
 },
 "9.4": {
  "title": "两个初始均值重合，EM会让它们分开吗？",
  "question": "保持读数不变，让两个分量从同一均值开始，先判断责任度是否仍会对半分，再观察更新。",
  "explanation": "E步按旧参数计算各读数的归组概率，M步把这些责任度固定为权重，更新均值与混合权重。精确步骤使观测似然不下降，但重合的分量可能保持对称。",
  "formula": "rᵢⱼ ∝ wⱼ N(yᵢ|μⱼ,v)；wⱼ′=Σrᵢⱼ/n；μⱼ′=Σrᵢⱼyᵢ/Σrᵢⱼ",
  "heading": "责任度和观测似然一起变化",
  "label": "当前观测 log 似然",
  "assumptions": "固定8个读数，两个高斯分量共享固定正方差，只更新权重与均值，共20次。某组总责任度为0时保留旧均值。滑块改变一次实验的固定方差，EM内部不更新它。",
  "note": "左图每个读数对应的高度为属于分量1的概率，分量2为1减该值。右图是每次完整更新后重新计算的观测对数似然。切换初始均值时使用同一数据。",
  "controls": [
   [
    "variance",
    "固定分量方差 / U²",
    0.1,
    2,
    0.05,
    0.25
   ],
   [
    "symmetric",
    "初始化：0分离 / 1相同",
    0,
    1,
    1,
    0
   ]
  ]
 },
 "9.5": {
  "title": "未来噪声变大，原预测区间还覆盖多少？",
  "question": "先按当前后验和假定噪声固定95%预测区间，再增大实际未来噪声，判断落在原区间内的概率如何变化。",
  "explanation": "参数后验方差与新噪声方差共同决定未来读数的方差。蓝色预测沿用原假设，玫红密度按实际噪声变化；计算原区间在这条密度下包含的概率。",
  "formula": "预测N(1.6,v+r)；核验N(1.6,v+c r)；r=1 U²",
  "heading": "参数分布、读数分布与模型覆盖",
  "label": "原预测区间包含的概率",
  "assumptions": "固定参数后验均值1.6 U、方差v，假定未来噪声方差r=1 U²且独立。实际噪声方差为c r。这里对同一参数后验平均后求解析区间概率，未生成经验覆盖样本。",
  "note": "左图灰线表示参数后验，蓝线表示原预测，玫红虚线按实际噪声变化；两条短线分别表示参数区间与读数预测区间。右图记录原95%预测区间包含的概率。播放通常从1倍噪声开始；指定1倍时从0.25倍展开。",
  "controls": [
   [
    "variance",
    "参数后验方差 v / U²",
    0.05,
    2,
    0.05,
    0.8
   ],
   [
    "multiplier",
    "实际噪声方差倍率 c",
    0.25,
    4,
    0.25,
    1
   ]
  ]
 }
};
function controls(){p={};$('sliders').replaceChildren();for(const[key,label,min,max,step,value]of definitions[mode].controls){p[key]=value;const row=el('div',null,'slider'),labelNode=el('label',label),input=el('input'),out=el('output',fmt(value));input.type='range';input.id='parameter-'+key;input.min=min;input.max=max;input.step=step;input.value=value;labelNode.htmlFor=input.id;out.id='parameter-value-'+key;input.addEventListener('input',()=>guard(()=>{p[key]=Number(input.value);out.textContent=fmt(p[key]);recompute();}));row.append(labelNode,out,input);$('sliders').append(row);}}
function set(values){Object.assign(p,values);for(const[key,value]of Object.entries(values)){$('parameter-'+key).value=value;$('parameter-value-'+key).textContent=fmt(value);}recompute();}
function recompute(){
 if(mode==='9.1')$('alternate').textContent=p.noise>=4?'恢复较小噪声':'切换为较大噪声';
 if(mode==='9.2'){data=chains(p.separation,p.step);$('alternate').textContent=p.separation>=3?'切换为单峰目标':'切换为分离双峰';}
 if(mode==='9.3'){data=meanField(p.rho);$('alternate').textContent=p.rho>=.5?'切换为独立目标':'切换为相关目标';}
 if(mode==='9.4'){data=emTrace(Boolean(p.symmetric),p.variance);$('alternate').textContent=p.symmetric?'切换为分离初始化':'切换为相同初始化';}
 if(mode==='9.5')$('alternate').textContent=p.multiplier>1?'恢复正确噪声假设':'切换为噪声失配';
 playback?.pause();playback?playback.seek(100):draw(100);
}
function axes(chart,{xmin,xmax,ymin,ymax,xlabel,ylabel}){
 const x=v=>66+444*(v-xmin)/(xmax-xmin),y=v=>310-264*(v-ymin)/(ymax-ymin);
 for(let j=0;j<=4;j++){const val=ymin+(ymax-ymin)*j/4;chart.append(node('line',{x1:66,y1:y(val),x2:510,y2:y(val),stroke:gray,opacity:.15}),node('text',{x:57,y:y(val)+5,'text-anchor':'end','font-size':13,fill:gray},fmt(val)));}
 for(let j=0;j<=4;j++){const val=xmin+(xmax-xmin)*j/4;chart.append(node('text',{x:x(val),y:337,'text-anchor':'middle','font-size':13,fill:gray},fmt(val)));}
 chart.append(node('text',{x:288,y:376,'text-anchor':'middle','font-size':15,fill:gray},xlabel),node('text',{x:66,y:25,'font-size':15,fill:gray},ylabel));return{x,y,xmin,xmax,ymin,ymax};
}
function curve(chart,points,a,color,dashed=false,width=2.5){
 let path='',open=false;for(const [x,y]of points){if(!Number.isFinite(x+y)||x<a.xmin||x>a.xmax||y<a.ymin||y>a.ymax){open=false;continue;}path+=`${open?'L':'M'}${a.x(x)},${a.y(y)} `;open=true;}
 chart.append(node('path',{d:path,fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dashed?'7 5':'none','stroke-linejoin':'round'}));
}
function dot(chart,point,a,color,r=5){chart.append(node('circle',{cx:a.x(point[0]),cy:a.y(point[1]),r,fill:color,class:'probe',stroke:'white','stroke-width':1.5}));}
function table(rows){const table=el('table'),body=el('tbody');for(const[key,value]of rows){const row=el('tr');row.append(el('th',key),el('td',Array.isArray(value)?value.map(fmt).join('，'):typeof value==='number'?fmt(value):value));body.append(row);}table.append(body);$('value-table').replaceChildren(table);}
function legend(items){$('legend').replaceChildren();for(const[text,color]of items){const item=el('span'),swatch=el('i');swatch.style.background=color;item.append(swatch,document.createTextNode(text));$('legend').append(item);}}
function draw(progress){
 const frac=progress/100,left=$('chart'),right=$('detail-chart'),def=definitions[mode];$('timeline').value=progress;$('play-counter').textContent=`进度 ${progress.toFixed(1)}%`;
 for(const[chart,prefix]of [[left,'svg'],[right,'detail']])chart.replaceChildren(node('title',{id:prefix+'-title'},def.heading),node('desc',{id:prefix+'-desc'},def.note));
 if(mode==='9.1'){
  const n=Math.floor(p.count*frac),r=conjugate(n,p.noise),peak=1.1/Math.sqrt(2*Math.PI*Math.min(r.variance,p.noise/Math.max(n,1))),a=axes(left,{xmin:-6,xmax:7,ymin:0,ymax:Math.max(.4,peak),xlabel:'共同偏差 θ / U',ylabel:'密度 / (1/U)'}),b=axes(right,{xmin:0,xmax:12,ymin:0,ymax:10,xlabel:'读数个数 n',ylabel:'方差 / U²'});
  const xs=Array.from({length:301},(_,i)=>-6+13*i/300);curve(left,xs.map(x=>[x,normal(x,0,4)]),a,gray);curve(left,xs.map(x=>[x,normal(x,r.mean,r.variance)]),a,blue);
  if(n)curve(left,xs.map(x=>[x,normal(x,readings.slice(0,n).reduce((s,y)=>s+y,0)/n,p.noise/n)]),a,pink,true);
  for(const[key,color]of [['variance',blue],['predictive',green]]){const pts=Array.from({length:n+1},(_,i)=>[i,conjugate(i,p.noise)[key]]);curve(right,pts,b,color);dot(right,pts.at(-1),b,color);}
  $('value').textContent=fmt(r.variance);$('time-readout').textContent=`已纳入 ${n}/${p.count} 个读数`;$('observation-value').textContent=`后验均值 ${fmt(r.mean)} U；未来读数方差 ${fmt(r.predictive)} U²。`;
  legend([['先验',gray],['后验／参数方差',blue],['归一化似然',pink],['预测方差',green]]);table([['已纳入读数 / U',readings.slice(0,n)],['后验均值 / U',r.mean],['后验方差 / U²',r.variance],['预测方差 / U²',r.predictive]]);
 }
 if(mode==='9.2'){
  const n=Math.floor(frac*600),limit=Math.max(4,p.separation+3,...data.flatMap(c=>c.path.map(Math.abs))),a=axes(left,{xmin:0,xmax:600,ymin:-limit,ymax:limit,xlabel:'步骤（含初始点）',ylabel:'状态 / 1'}),b=axes(right,{xmin:0,xmax:600,ymin:0,ymax:1,xlabel:'步骤（含初始点）',ylabel:'正半轴占比 / 1'});let rows=[];
  data.forEach((c,j)=>{const color=j?pink:blue,pts=c.path.slice(0,n+1).map((x,i)=>[i,x]);curve(left,pts,a,color);dot(left,pts.at(-1),a,color);let count=0;const ratios=pts.map(([i,x])=>{count+=x>0;return[i,count/(i+1)];});curve(right,ratios,b,color);dot(right,ratios.at(-1),b,color);rows.push([`链 ${j+1} 落在正半轴的比例`,ratios.at(-1)[1]],[`链 ${j+1} 接受率`,n?c.accepted.slice(0,n).filter(Boolean).length/n:'尚无提议']);});curve(right,[[0,.5],[600,.5]],b,gray,true);
  $('value').textContent=rows.filter((_,i)=>i%2===0).map(r=>fmt(r[1])).join(' / ');$('time-readout').textContent=`第 ${n}/600 步`;$('observation-value').textContent='目标落在正半轴的概率为0.5；还需结合多链、相关性与计算预算检查探索。';legend([['链1',blue],['链2',pink],['精确半轴概率',gray]]);table([['种子','9201 / 9202'],...rows]);
 }
 if(mode==='9.3'){
  const n=Math.floor(frac*20),r=data[n],a=axes(left,{xmin:-4.2,xmax:4.2,ymin:-4.2,ymax:4.2,xlabel:'θ₁ / 1',ylabel:'θ₂ / 1'}),logs=data.map(r=>Math.log10(1+r.gap)),b=axes(right,{xmin:0,xmax:20,ymin:0,ymax:Math.max(...logs)+.15,xlabel:'完整坐标轮数',ylabel:'log₁₀(1+KL) / 1'});
  for(const radius of [1,2]){const angles=Array.from({length:181},(_,i)=>2*Math.PI*i/180);curve(left,angles.map(t=>[radius*Math.cos(t),radius*(p.rho*Math.cos(t)+Math.sqrt(1-p.rho*p.rho)*Math.sin(t))]),a,gray);curve(left,angles.map(t=>[r.mean[0]+radius*Math.sqrt(r.variance)*Math.cos(t),r.mean[1]+radius*Math.sqrt(r.variance)*Math.sin(t)]),a,blue,true);}
  dot(left,r.mean,a,blue);curve(right,logs.slice(0,n+1).map((v,i)=>[i,v]),b,blue);dot(right,[n,logs[n]],b,blue);const floor=-.5*Math.log(1-p.rho*p.rho);curve(right,[[0,Math.log10(1+floor)],[20,Math.log10(1+floor)]],b,pink,true);
  $('value').textContent=fmt(r.gap);$('time-readout').textContent=`第 ${n}/20 轮`;$('observation-value').textContent=`精确边缘方差1；因子方差 ${fmt(r.variance)}；最小KL ${fmt(floor)}。`;legend([['精确相关轮廓',gray],['独立近似',blue],['近似族误差下限',pink]]);table([['当前均值',r.mean],['因子方差',r.variance],['精确协方差',p.rho],['当前KL',r.gap],['KL下限',floor]]);
 }
 if(mode==='9.4'){
  const n=Math.floor(frac*20),r=data[n],values=data.map(r=>r.likelihood),a=axes(left,{xmin:-2,xmax:2,ymin:0,ymax:1,xlabel:'观测 / U',ylabel:'第一分量责任度 / 1'}),b=axes(right,{xmin:0,xmax:20,ymin:Math.min(...values)-.5,ymax:Math.max(...values)+.5,xlabel:'完整EM更新次数',ylabel:'观测 log 似然 / 1'});
  observations.forEach((x,i)=>{curve(left,[[x,0],[x,r.responsibilities[i][0]]],a,blue,false,3);dot(left,[x,r.responsibilities[i][0]],a,blue,6);});curve(right,values.slice(0,n+1).map((v,i)=>[i,v]),b,pink);dot(right,[n,r.likelihood],b,pink);
  $('value').textContent=fmt(r.likelihood);$('time-readout').textContent=`第 ${n}/20 次更新`;$('observation-value').textContent=`分量1、2的均值 [${r.means.map(fmt)}] U；分量1、2的权重 [${r.weights.map(fmt)}]。${p.symmetric?'对称初始化没有自动分离。':'固定方差，不更新噪声。'}`;legend([['当前责任度',blue],['观测似然',pink]]);table([['全部观测 / U',observations],['均值 / U',r.means],['权重',r.weights],['第一分量责任度',r.responsibilities.map(x=>x[0])],['观测log似然',r.likelihood]]);
 }
 if(mode==='9.5'){
  const start=p.multiplier===1?.25:1,c=start+(p.multiplier-start)*frac,r=prediction(p.variance,1,c),a=axes(left,{xmin:-5,xmax:8,ymin:0,ymax:1.85,xlabel:'偏差或新读数 / U',ylabel:'密度 / (1/U)'}),b=axes(right,{xmin:.25,xmax:4,ymin:.55,ymax:1.02,xlabel:'实际噪声方差倍率 c',ylabel:'原预测区间包含的概率'}),xs=Array.from({length:301},(_,i)=>-5+13*i/300);
  for(const[v,color,dash]of [[p.variance,gray,false],[r.variance,blue,false],[r.actual,pink,true]])curve(left,xs.map(x=>[x,normal(x,1.6,v)]),a,color,dash);curve(left,[[1.6-r.half,.04],[1.6+r.half,.04]],a,blue,false,5);curve(left,[[1.6-r.parameterHalf,.1],[1.6+r.parameterHalf,.1]],a,gray,false,4);
  curve(right,Array.from({length:101},(_,i)=>{const q=.25+3.75*i/100;return[q,prediction(p.variance,1,q).coverage];}),b,pink);dot(right,[c,r.coverage],b,pink,6);curve(right,[[.25,.95],[4,.95]],b,gray,true);
  $('value').textContent=(100*r.coverage).toFixed(1)+'%';$('time-readout').textContent=`当前噪声倍率 ${fmt(c)}`;$('observation-value').textContent=`参数区间半宽 ${fmt(r.parameterHalf)} U；原预测区间半宽 ${fmt(r.half)} U。本次播放保持预测区间，按实际噪声改变核验密度。`;legend([['参数分布与区间',gray],['原预测与区间',blue],['实际噪声下的核验',pink]]);table([['模型预测方差 / U²',r.variance],['核验方差 / U²',r.actual],['原预测区间下界 / U',1.6-r.half],['原预测区间上界 / U',1.6+r.half],['解析覆盖',r.coverage]]);
 }
}
function failed(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent=`探索未能运行：${error.message}。请刷新重试。`;for(const id of ['controls','play','replay','timeline'])$(id).disabled=true;playback?.pause();}
function guard(fn){try{fn();}catch(error){failed(error);}}
async function start(){
 ({current:chapter}=await mountShell('explore'));mode=chapter?.id;const def=definitions[mode];if(!def)throw Error('本章没有此探索页');$('eyebrow').textContent=chapter.id+' 章 · 可视化与探索';for(const id of ['title','question','explanation','formula','assumptions'])$(id).textContent=def[id];$('chart-heading').textContent=def.heading;$('value-label').textContent=def.label;$('chart-note').textContent=def.note;$('preset-note').textContent='先判断改变条件后会发生什么，再播放观察。对照按钮可以切换并返回原条件。';controls();recompute();
 playback=createPlayback({duration:100,speed:10,update:draw,failed,changed:reason=>{$('play').textContent=reason==='playing'?'暂停':'播放';$('play-status').textContent=reason==='playing'?'正在播放，观察图形与读数同步变化。':reason==='ended'?'已展示指定条件；点击播放可从起点观察。':reason==='hidden'?'切离页面后已暂停。':'已暂停，可拖动观察位置。';}});
 $('play').addEventListener('click',()=>guard(()=>playback.running?playback.pause():playback.play()));$('replay').addEventListener('click',()=>guard(()=>{playback.seek(0);playback.play();}));$('timeline').addEventListener('input',()=>guard(()=>playback.seek(Number($('timeline').value))));
 $('alternate').addEventListener('click',()=>guard(()=>{set(alternate(mode,p));}));$('reset').addEventListener('click',()=>guard(()=>{controls();recompute();}));document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.pause('hidden');});
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const session=await(await fetch('/api/session')).json(),response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})}),result=await response.json();$('open-status').textContent=result.message||result.error;}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}});$('notebooks').append(button);}
 playback.seek(100);for(const id of ['controls','play','replay','timeline'])$(id).disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';document.title=chapter.title+' · 可视化与探索';
}
start().catch(failed);
