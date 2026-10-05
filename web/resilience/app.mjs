import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {theme} from '../shared/theme.mjs';
import {finitePath,meanfieldPath,cascade,largestSurvivor,recovery,ar1,pastVariance,standardShocks,alternate} from './model.mjs';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const blue=theme.data['1'],pink=theme.data['2'],green=theme.data['3'],gray=theme.data.reference;
const fmt=value=>typeof value==='number'?Number(value.toPrecision(4)).toString():String(value);
const svg=(tag,attributes={},label)=>{const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,value);if(label!==undefined)node.textContent=label;return node;};
let chapter,mode,settings={},cache,playback;
const definitions={
 '13.1':{
  title:"群体变大，随机波动会怎样变化？",
  question:"每个个体取+1或−1，群体平均为m。若旧m相同，下一轮的平均一定等于它的条件期望吗？改变N后，先预测一次抽样的波动。",
  explanation:"左图画条件期望F(m)=tanh(βm)和对角线，交点对应确定性平衡。右图从全体+1出发，比较N、4N两条随机轨迹和直接迭代F的确定性参照。",
  formula:"取+1的概率r=(1+tanh(βm))/2；E[m_next|m]=tanh(βm)，Var[m_next|m]=4r(1−r)/N。",
  heading:"条件期望与有限群体轨迹",
  label:"当前N个体的一致程度 |m|",
  assumptions:"β是无量纲参数。每轮同时读取旧m，各个体条件独立地重新选择；起点全部为+1。右图各推进80次、保留起点共81个值，N与4N各使用固定随机种子的一次轨迹。",
  note:"单条轨迹会围绕平均规律波动；确定性参照不是随机轨迹逐时刻的重复平均。β=1来自零点导数的局部判断，Notebook另用多规模、暂态截取与独立重复检查有限证据。",
  controls:[["beta","相互作用强度 β",0.6,1.4,0.1,0.8],["size","个体数 N",40,320,40,80]]},
 '13.2':{
  title:"一处损伤，失效会停在哪里？",
  question:"六个节点、五条边，节点0先失效。保持阈值表相同，先沿链和星形走一轮，再预测最终失效数与剩余最大连通规模。",
  explanation:"左图按轮次标记失效节点；右图分别画累计失效数和最大可用连通分量的节点数。可以固定阈值切换结构，再固定结构切换阈值。",
  formula:"仍可用节点i的已失效邻居数达到kᵢ，就在下一轮失效；同一轮始终读取上一轮末的累计失效集合。",
  heading:"逐轮失效与可用连接规模",
  label:"当前累计失效节点数",
  assumptions:"节点0为第0轮直接损伤；原阈值表按节点0—5排列为[1,1,2,1,1,1]，另一选项全为2。失效不恢复。G为最大可用连通分量大小除以原六节点，孤立可用节点大小为1。",
  note:"提高阈值可以保留更多节点，但最大连通分量未必严格变大。G只是功能代理：它描述可用连接规模，没有计算真实处理容量或输送能力。",
  controls:[["structure","结构：0链 / 1星",0,1,1,0],["high","阈值：0原值 / 1全为2",0,1,1,0]]},
 '13.3':{
  title:"恢复得快与能返回，怎样分别判断？",
  question:"固定局部恢复率a=1.5/T，将B从1改为2。同样的1.4扰动会向哪边走？右侧另比较：只增噪声能否也使窗口方差上升？",
  explanation:"左图在同一B下画0.2和1.4两个扰动的数值轨迹。右图是独立的一阶自回归对照，方差只用当前及以前40项；两幅图分别回答返回与指标来源问题。",
  formula:"dx/dt=−a x(1−x/B)；局部恢复时间1/a，非负状态的返回范围[0,B)。AR(1)固定稳定段的方差为σ²/(1−ρ²)。",
  heading:"扰动轨迹与过去窗口方差",
  label:"当前1.4扰动的状态 x",
  assumptions:"左图B与x同单位，Euler步长0.02 T、25次更新至0.5 T。右图240次更新保留241个样本，使用固定的同一组创新值；前120次ρ=0.7、σ=0.2，后段只改ρ为0.95或σ为0.5。新条件生成的首样本是121。",
  note:"零点属于返回范围，B不属于；超过B后本模型没有另一有限稳定状态。右图两段都满足|ρ|<1，没有真实转变事件。方差升高还需结合相关、采样间隔与独立事件记录评价。",
  controls:[["boundary","吸引域边界 B",1,2,1,1],["cause","方差上升原因：0慢化 / 1噪声",0,1,1,0]]}
};

function controls(){settings={};$('sliders').replaceChildren();for(const[key,label,min,max,step,value]of definitions[mode].controls){
 settings[key]=value;const row=el('div',null,'slider'),caption=el('label',label),input=el('input'),output=el('output',fmt(value));
 input.type='range';input.id='parameter-'+key;input.min=min;input.max=max;input.step=step;input.value=value;caption.htmlFor=input.id;output.id='parameter-value-'+key;
 input.addEventListener('input',()=>guard(()=>{settings[key]=Number(input.value);output.textContent=fmt(settings[key]);recompute();}));
 row.append(caption,output,input);$('sliders').append(row);
}}
function set(values){Object.assign(settings,values);for(const[key,value]of Object.entries(values)){$('parameter-'+key).value=value;$('parameter-value-'+key).textContent=fmt(value);}recompute();}
function compute(){
 if(mode==='13.1')return{small:finitePath(settings.beta,settings.size,80,1301),large:finitePath(settings.beta,settings.size*4,80,1302),mean:meanfieldPath(settings.beta,80)};
 if(mode==='13.2'){
  const edges=settings.structure?Array.from({length:5},(_,i)=>[0,i+1]):Array.from({length:5},(_,i)=>[i,i+1]);
  const thresholds=settings.high?Array(6).fill(2):[1,1,2,1,1,1];
  const rounds=cascade(6,edges,thresholds,[0]),failed=[],cumulative=[],functionality=[];
  for(const round of rounds){failed.push(...round);cumulative.push(failed.length);functionality.push(largestSurvivor(6,edges,failed));}
  return{edges,rounds,cumulative,functionality};
 }
 const small=recovery(1.5,settings.boundary,.2,.02,25),large=recovery(1.5,settings.boundary,1.4,.02,25);
 const shocks=standardShocks(240,1303),rho=Array(240).fill(.7),sigma=Array(240).fill(.2);
 for(let i=120;i<240;i++)if(settings.cause)sigma[i]=.5;else rho[i]=.95;
 const series=ar1(rho,sigma,shocks),variance=series.map((_,t)=>pastVariance(series,t,40));
 return{small,large,variance};
}
function recompute(){const labels={
 '13.1':settings.beta>1?'恢复 β=0.8':'切换至 β=1.2',
 '13.2':settings.structure?'恢复链结构':'切换为星结构',
 '13.3':settings.boundary>1?'恢复边界 B=1':'扩展边界至 B=2'};
 $('alternate').textContent=labels[mode];cache=compute();playback?.pause();playback?playback.seek(100):draw(100);
}
function axes(chart,{xmin,xmax,ymin,ymax,xlabel,ylabel}){
 const x=value=>66+444*(value-xmin)/(xmax-xmin),y=value=>310-264*(value-ymin)/(ymax-ymin);
 for(let j=0;j<=4;j++){const value=ymin+(ymax-ymin)*j/4;chart.append(svg('line',{x1:66,y1:y(value),x2:510,y2:y(value),stroke:gray,opacity:.15}),svg('text',{x:57,y:y(value)+5,'text-anchor':'end','font-size':13,fill:gray},fmt(value)));}
 for(let j=0;j<=4;j++){const value=xmin+(xmax-xmin)*j/4;chart.append(svg('text',{x:x(value),y:337,'text-anchor':'middle','font-size':13,fill:gray},fmt(value)));}
 chart.append(svg('text',{x:288,y:376,'text-anchor':'middle','font-size':15,fill:gray},xlabel),svg('text',{x:66,y:25,'font-size':15,fill:gray},ylabel));
 return{x,y,xmin,xmax,ymin,ymax};
}
function curve(chart,points,a,color,dash){let path='',open=false;for(const[x,y]of points){if(!Number.isFinite(x+y)||x<a.xmin||x>a.xmax||y<a.ymin||y>a.ymax){open=false;continue;}path+=(open?'L':'M')+a.x(x)+','+a.y(y)+' ';open=true;}chart.append(svg('path',{d:path,fill:'none',stroke:color,'stroke-width':2.7,'stroke-linejoin':'round',...(dash?{'stroke-dasharray':'7 5'}:{})}));}
function dot(chart,point,a,color){if(point&&Number.isFinite(point[0]+point[1]))chart.append(svg('circle',{cx:a.x(point[0]),cy:a.y(point[1]),r:5,fill:color,stroke:'white','stroke-width':1.5}));}
function table(rows){const element=el('table'),body=el('tbody');for(const[key,value]of rows){const row=el('tr');row.append(el('th',key),el('td',fmt(value)));body.append(row);}element.append(body);$('value-table').replaceChildren(element);}
function legend(items){$('legend').replaceChildren();for(const[label,color]of items){const item=el('span'),swatch=el('i');swatch.style.background=color;item.append(swatch,document.createTextNode(label));$('legend').append(item);}}
function network(chart,edges,failed){
 const positions=settings.structure?[[275,85],[90,205],[175,275],[275,300],[375,275],[460,205]]:
  [[65,180],[150,180],[235,180],[320,180],[405,180],[490,180]];
 for(const[a,b]of edges)chart.append(svg('line',{x1:positions[a][0],y1:positions[a][1],x2:positions[b][0],y2:positions[b][1],stroke:gray,'stroke-width':3,opacity:.5}));
 for(let i=0;i<6;i++){
  const[px,py]=positions[i];chart.append(svg('circle',{cx:px,cy:py,r:22,fill:failed.has(i)?pink:blue,opacity:failed.has(i)?.9:.7,stroke:'white','stroke-width':2}));
  chart.append(svg('text',{x:px,y:py+5,'text-anchor':'middle','font-size':17,fill:'white'},String(i)));
 }
 chart.append(svg('text',{x:275,y:365,'text-anchor':'middle','font-size':14,fill:gray},'粉色：已失效；蓝色：仍可用'));
}
function draw(progress){
 const fraction=progress/100,left=$('chart'),right=$('detail-chart'),def=definitions[mode];$('timeline').value=progress;$('play-counter').textContent='进度 '+progress.toFixed(1)+'%';
 for(const[chart,prefix]of [[left,'svg'],[right,'detail']])chart.replaceChildren(svg('title',{id:prefix+'-title'},def.heading),svg('desc',{id:prefix+'-desc'},def.note));
 if(mode==='13.1'){
  const n=Math.floor(fraction*80),a=axes(left,{xmin:-1,xmax:1,ymin:-1,ymax:1,xlabel:'当前有符号平均 m',ylabel:'下一步条件期望'});
  const grid=Array.from({length:101},(_,i)=>-1+i/50);
  curve(left,grid.map(value=>[value,value]),a,gray,true);curve(left,grid.map(value=>[value,Math.tanh(settings.beta*value)]),a,blue);
  dot(left,[cache.small[n],Math.tanh(settings.beta*cache.small[n])],a,pink);
  const b=axes(right,{xmin:0,xmax:80,ymin:-1,ymax:1,xlabel:'更新步',ylabel:'有限群体平均 m'});
  curve(right,cache.small.slice(0,n+1).map((value,i)=>[i,value]),b,pink);
  curve(right,cache.large.slice(0,n+1).map((value,i)=>[i,value]),b,green);
  curve(right,cache.mean.slice(0,n+1).map((value,i)=>[i,value]),b,gray,true);
  dot(right,[n,cache.small[n]],b,pink);
  $('value').textContent=fmt(Math.abs(cache.small[n]));$('time-readout').textContent='第 '+n+' 步';
  $('observation-value').textContent='N 的 m='+fmt(cache.small[n])+'；4N 的 m='+fmt(cache.large[n])+'；确定性参照='+fmt(cache.mean[n])+'。';
  legend([['条件期望曲线',blue],['N 个体',pink],['4N 个体',green],['确定性参照',gray]]);
  table([['β',settings.beta],['N',settings.size],['m (N)',cache.small[n]],['m (4N)',cache.large[n]],['条件方差 (N)',(1-Math.tanh(settings.beta*cache.small[n])**2)/settings.size]]);
 }
 if(mode==='13.2'){
  const n=Math.floor(fraction*(cache.rounds.length-1)),failed=new Set(cache.rounds.slice(0,n+1).flat());
  network(left,cache.edges,failed);
  const a=axes(right,{xmin:0,xmax:Math.max(1,cache.rounds.length-1),ymin:0,ymax:6,xlabel:'轮次（0为直接损伤）',ylabel:'节点数'});
  curve(right,cache.cumulative.slice(0,n+1).map((value,i)=>[i,value]),a,pink);
  curve(right,cache.functionality.slice(0,n+1).map((value,i)=>[i,value*6]),a,blue);
  dot(right,[n,cache.cumulative[n]],a,pink);
  $('value').textContent=String(cache.cumulative[n]);$('time-readout').textContent='第 '+n+' 轮';
  $('observation-value').textContent='本轮新增 '+cache.rounds[n].length+' 个；最大可用连通分量占原网络 '+fmt(cache.functionality[n])+'。';
  legend([['累计失效',pink],['最大可用连通分量节点数',blue]]);
  table([['结构',settings.structure?'星形':'链'],['阈值',settings.high?'全为2':'节点2为2，其余1'],['第0轮直接损伤',1],['继发失效至今',cache.cumulative[n]-1],['可用连通比例 G',cache.functionality[n]]]);
 }
 if(mode==='13.3'){
  const n=Math.floor(fraction*25),t=Math.floor(fraction*240);
  const a=axes(left,{xmin:0,xmax:.5,ymin:0,ymax:3,xlabel:'时间 / T',ylabel:'状态 x'});
  curve(left,cache.small.slice(0,n+1).map((value,i)=>[i*.02,value]),a,green);
  curve(left,cache.large.slice(0,n+1).map((value,i)=>[i*.02,value]),a,pink);
  dot(left,[n*.02,cache.large[n]],a,pink);
  const b=axes(right,{xmin:0,xmax:240,ymin:0,ymax:1.2,xlabel:'当前末样本下标',ylabel:'含当前的40项窗口方差'});
  curve(right,cache.variance.slice(0,t+1).map((value,i)=>[i,value]),b,blue);
  curve(right,[[120,0],[120,1.2]],b,gray,true);
  if(cache.variance[t]!==null)dot(right,[t,cache.variance[t]],b,blue);
  $('value').textContent=fmt(cache.large[n]);$('time-readout').textContent='扰动后 '+fmt(n*.02)+' T';
  $('observation-value').textContent='另一个 AR(1) 对照在样本 '+t+' 的过去窗口方差：'+(cache.variance[t]===null?'窗口未满':fmt(cache.variance[t]))+'。';
  legend([['小扰动',green],['大扰动',pink],['过去窗口方差',blue],['AR(1) 条件改变',gray]]);
  table([['恢复模型边界 B',settings.boundary],['局部恢复率 a / (1/T)',1.5],['大扰动初值',1.4],['当前大扰动状态',cache.large[n]],['AR(1) 改变',settings.cause?'只增噪声幅度 σ':'只增记忆系数 ρ'],['过去窗口方差',cache.variance[t]===null?'未满40点':cache.variance[t]]]);
 }
}
function failed(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent='探索未能运行：'+error.message+'。请刷新重试。';for(const id of ['controls','play','replay','timeline'])$(id).disabled=true;playback?.pause();}
function guard(fn){try{fn();}catch(error){failed(error);}}
async function start(){
 ({current:chapter}=await mountShell('explore'));mode=chapter?.id;const def=definitions[mode];if(!def)throw Error('本章没有此探索页');
 $('eyebrow').textContent=chapter.id+' 章 · 可视化与探索';for(const id of ['title','question','explanation','formula','assumptions'])$(id).textContent=def[id];
 $('chart-heading').textContent=def.heading;$('value-label').textContent=def.label;$('chart-note').textContent=def.note;
 $('preset-note').textContent='先预测，再播放并查看当前数值。一次改变一个条件，比较结果来自哪一项改动。';controls();recompute();
 playback=createPlayback({duration:100,speed:10,update:draw,failed,changed:reason=>{$('play').textContent=reason==='playing'?'暂停':'播放';$('play-status').textContent=reason==='playing'?'正在播放，观察图形与数值变化。':reason==='ended'?'已显示本次轨迹末段；点击播放可从起点观察。':reason==='hidden'?'切离页面后已暂停。':'已暂停，可拖动观察位置。';}});
 $('play').addEventListener('click',()=>guard(()=>playback.running?playback.pause():playback.play()));
 $('replay').addEventListener('click',()=>guard(()=>{playback.seek(0);playback.play();}));
 $('timeline').addEventListener('input',()=>guard(()=>playback.seek(Number($('timeline').value))));
 $('alternate').addEventListener('click',()=>guard(()=>set(alternate(mode,settings))));
 $('reset').addEventListener('click',()=>guard(()=>{controls();recompute();}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.pause('hidden');});
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const session=await(await fetch('/api/session')).json(),response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})}),result=await response.json();$('open-status').textContent=result.message||result.error;}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}});$('notebooks').append(button);}
 playback.seek(100);for(const id of ['controls','play','replay','timeline'])$(id).disabled=false;
 document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';document.title=chapter.title+' · 可视化与探索';
}
start().catch(failed);
