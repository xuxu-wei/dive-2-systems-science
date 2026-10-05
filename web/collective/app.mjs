import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {theme} from '../shared/theme.mjs';
import {caRun,payoff,replicator,diffuse,alternate} from './model.mjs';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const blue=theme.data['1'],pink=theme.data['2'],green=theme.data['3'],gray=theme.data.reference;
const fmt=v=>typeof v==='number'?Number(v.toPrecision(4)).toString():String(v);
const svg=(tag,attrs={},value)=>{const x=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))x.setAttribute(k,v);if(value!==undefined)x.textContent=value;return x;};
let chapter,mode,settings={},playback;
const definitions={
 '12.1':{
  title:"同一局部规则，更新时序怎样改变结果？",
  question:"每格的左右值不同就变成1，相同就变成0。若新值写入后立即生效，同一初态还会得到同步更新的图案吗？",
  explanation:"左图记录各位置每轮的0、1状态，右图统计同一行中1的比例。先固定边界切换时序，再固定时序切换边界，分别检查两种条件。",
  formula:"xᵢ⁺=左值 XOR 右值：不同取1，相同取0。同步读取整行旧值；从左到右异步读取操作当时的邻格。",
  heading:"逐格状态与激活比例",
  label:"当前激活比例",
  assumptions:"31格，位置从0到30，初始位置9、10、16、23为1，其余为0；共更新25轮，每轮每格一次。周期边界首尾相连，固定边界把列表之外的值设为0。颜色表示状态，1是激活标记。",
  note:"横向看位置，纵向看更新轮数；右图的每个点来自对应整行。两种时序更新次数相同，但异步后面的格子可以读取本轮已写入的新值。",
  controls:[["asynchronous","更新：0同步 / 1左到右异步",0,1,1,0],["boundary","边界：0周期 / 1固定",0,1,1,0]]},
 '12.2':{
  title:"相遇收益怎样改变类型比例？",
  question:"类型0目前占p，相遇对象也按p、1−p分布。先看两类平均收益率谁更高，再预测类型0频率的变化方向。",
  explanation:"收益表的行是自身类型，列是相遇对象类型，顺序均为0、1。左图给出两类的加权收益率，右图用复制动态计算频率轨迹；切换表后先找等收益交点。",
  formula:"f₀=pM₀₀+(1−p)M₀₁，f₁=pM₁₀+(1−p)M₁₁；dp/dt=p(1−p)(f₀−f₁)。",
  heading:"相遇收益率与类型0频率",
  label:"当前类型0频率 p",
  assumptions:"充分混合，类型频率连续变化。表0为[[3,0],[4,1]]，表1为[[1,2],[3,0]]，数值按适合度率解释，单位1/T。欧拉时间步0.05 T，更新160步至8 T；有限后代还需要另定抽样规则。",
  note:"收益率相等时当前导数为零。要判断这个内部点是否稳定，分别从它两侧选择起点，查看频率向交点靠近还是远离。",
  controls:[["game","收益表：0类型1优势 / 1内部平衡",0,1,1,0],["p0","初始类型0频率 p₀",0.1,0.9,0.05,0.25]]},
 '12.4':{
  title:"总量不变，扩散结果就可靠吗？",
  question:"初始物质在最左格。首尾相连时，最右格第一步能否收到物质？若两端不向外交换，又会怎样？随后增大时间步，分别查看总量和最低值。",
  explanation:"左图记录各格数值，右图分别画最低值和总量。边界决定哪些格子交换，时间步决定一次变化的大小。双组分反应与空间模态的完整推导见对应Notebook。",
  formula:"α=D h/Δx²；cᵢ⁺=(1−2α)cᵢ+α(cᵢ₋₁+cᵢ₊₁)。本页D、Δx数值均为1，纯扩散要求0≤α≤0.5。",
  heading:"端点交换、总量与最低值",
  label:"当前最小格值 / U/格",
  assumptions:"30个等体积格子，最左格初始为2 U/格，其余为0，总量为2 U；只做纯扩散，更新30步。周期边界首尾相连；无通量端点只与系统内的一格交换，越界值取端格自身的旧值。",
  note:"蓝色表示正的格值，粉色标出负值。各格采用共同的一格体积，总量数值为格值之和。总量曲线水平仍可能伴随负数；增大h也会改变30步对应的观察终时。",
  controls:[["boundary","边界：0周期 / 1无通量",0,1,1,0],["dt","显式时间步 h / T",0.1,0.55,0.05,0.2]]}
};

function controls(){settings={};$('sliders').replaceChildren();for(const[key,label,min,max,step,value]of definitions[mode].controls){
 settings[key]=value;const row=el('div',null,'slider'),caption=el('label',label),input=el('input'),output=el('output',fmt(value));
 input.type='range';input.id='parameter-'+key;input.min=min;input.max=max;input.step=step;input.value=value;
 caption.htmlFor=input.id;output.id='parameter-value-'+key;
 input.addEventListener('input',()=>guard(()=>{settings[key]=Number(input.value);output.textContent=fmt(settings[key]);recompute();}));
 row.append(caption,output,input);$('sliders').append(row);
}}
function set(values){Object.assign(settings,values);for(const[key,value]of Object.entries(values)){$('parameter-'+key).value=value;$('parameter-value-'+key).textContent=fmt(value);}recompute();}
function recompute(){const labels={
 '12.1':settings.asynchronous?'恢复同步更新':'切换为从左到右异步',
 '12.2':settings.game?'恢复类型1优势收益表':'切换为内部平衡收益表',
 '12.4':settings.boundary?'恢复周期边界':'切换为无通量边界'};
 $('alternate').textContent=labels[mode];playback?.pause();playback?playback.seek(100):draw(100);}
function axes(chart,{xmin,xmax,ymin,ymax,xlabel,ylabel}){const x=v=>66+444*(v-xmin)/(xmax-xmin),y=v=>310-264*(v-ymin)/(ymax-ymin);
 for(let j=0;j<=4;j++){const v=ymin+(ymax-ymin)*j/4;chart.append(svg('line',{x1:66,y1:y(v),x2:510,y2:y(v),stroke:gray,opacity:.15}),svg('text',{x:57,y:y(v)+5,'text-anchor':'end','font-size':13,fill:gray},fmt(v)));}
 for(let j=0;j<=4;j++){const v=xmin+(xmax-xmin)*j/4;chart.append(svg('text',{x:x(v),y:337,'text-anchor':'middle','font-size':13,fill:gray},fmt(v)));}
 chart.append(svg('text',{x:288,y:376,'text-anchor':'middle','font-size':15,fill:gray},xlabel),svg('text',{x:66,y:25,'font-size':15,fill:gray},ylabel));
 return{x,y,xmin,xmax,ymin,ymax};}
function curve(chart,points,a,color){let path='',open=false;for(const[x,y]of points){if(!Number.isFinite(x+y)||x<a.xmin||x>a.xmax||y<a.ymin||y>a.ymax){open=false;continue;}path+=(open?'L':'M')+a.x(x)+','+a.y(y)+' ';open=true;}chart.append(svg('path',{d:path,fill:'none',stroke:color,'stroke-width':2.8,'stroke-linejoin':'round'}));}
function dot(chart,point,a,color){if(!point||!Number.isFinite(point[0]+point[1]))return;chart.append(svg('circle',{cx:a.x(point[0]),cy:a.y(point[1]),r:5,fill:color,stroke:'white','stroke-width':1.5}));}
function table(rows){const tab=el('table'),body=el('tbody');for(const[key,value]of rows){const row=el('tr');row.append(el('th',key),el('td',Array.isArray(value)?value.map(fmt).join('，'):fmt(value)));body.append(row);}tab.append(body);$('value-table').replaceChildren(tab);}
function legend(items){$('legend').replaceChildren();for(const[label,color]of items){const item=el('span'),swatch=el('i');swatch.style.background=color;item.append(swatch,document.createTextNode(label));$('legend').append(item);}}
function heatmap(chart,rows,shown,maximum){const width=444/rows[0].length,height=264/rows.length;for(let t=0;t<=shown;t++)for(let i=0;i<rows[t].length;i++){
 const value=rows[t][i],color=value<0?pink:blue,opacity=value<0?Math.min(.2+Math.abs(value),.95):Math.min(.08+Math.max(0,value)/maximum*.85,.96);
 chart.append(svg('rect',{x:66+i*width,y:46+t*height,width:width+.2,height:height+.2,fill:color,opacity}));}
 chart.append(svg('text',{x:288,y:376,'text-anchor':'middle','font-size':15,fill:gray},'格位置'),svg('text',{x:66,y:25,'font-size':15,fill:gray},'更新轮次 / 步'));}
function draw(progress){const fraction=progress/100,left=$('chart'),right=$('detail-chart'),def=definitions[mode];$('timeline').value=progress;$('play-counter').textContent='进度 '+progress.toFixed(1)+'%';
 for(const[chart,prefix]of [[left,'svg'],[right,'detail']])chart.replaceChildren(svg('title',{id:prefix+'-title'},def.heading),svg('desc',{id:prefix+'-desc'},def.note));
 if(mode==='12.1'){
  const state=Array(31).fill(0);for(const i of [9,10,16,23])state[i]=1;
  const result=caRun(state,settings.boundary?'fixed':'periodic',settings.asynchronous?'async':'sync',25),n=Math.floor(fraction*25);
  heatmap(left,result.rows,n,1);const a=axes(right,{xmin:0,xmax:25,ymin:0,ymax:1,xlabel:'更新轮数',ylabel:'激活比例'});
  curve(right,result.density.slice(0,n+1).map((v,i)=>[i,v]),a,pink);dot(right,[n,result.density[n]],a,pink);
  $('value').textContent=fmt(result.density[n]);$('time-readout').textContent='第 '+n+' 轮';
  $('observation-value').textContent='当前激活 '+result.rows[n].reduce((a,b)=>a+b,0)+' / 31 格；每轮各格更新一次。';
  legend([['激活格',blue],['激活比例',pink]]);table([['更新方式',settings.asynchronous?'从左到右异步':'同步更新'],['边界',settings.boundary?'固定':'周期'],['激活格数',result.rows[n].reduce((a,b)=>a+b,0)],['激活比例',result.density[n]]]);
 }
 if(mode==='12.2'){
  const matrix=settings.game?[[1,2],[3,0]]:[[3,0],[4,1]],path=replicator(matrix,settings.p0),n=Math.floor(fraction*160);
  const a=axes(left,{xmin:0,xmax:1,ymin:0,ymax:4.2,xlabel:'类型0频率 p',ylabel:'平均收益率 / (1/T)'}),grid=Array.from({length:101},(_,i)=>i/100);
  curve(left,grid.map(p=>[p,payoff(matrix,p).f0]),a,blue);curve(left,grid.map(p=>[p,payoff(matrix,p).f1]),a,pink);
  dot(left,[path[n],payoff(matrix,path[n]).f0],a,blue);dot(left,[path[n],payoff(matrix,path[n]).f1],a,pink);
  const b=axes(right,{xmin:0,xmax:8,ymin:0,ymax:1,xlabel:'时间 / T',ylabel:'类型0频率 p'});
  curve(right,path.slice(0,n+1).map((p,i)=>[i*.05,p]),b,green);dot(right,[n*.05,path[n]],b,green);
  $('value').textContent=fmt(path[n]);$('time-readout').textContent='时刻 '+fmt(n*.05)+' T';
  $('observation-value').textContent='当前收益率 f₀='+fmt(payoff(matrix,path[n]).f0)+'、f₁='+fmt(payoff(matrix,path[n]).f1)+' (1/T)；dp/dt='+fmt(payoff(matrix,path[n]).rate)+' (1/T)。';
  legend([['类型0收益率',blue],['类型1收益率',pink],['类型0频率',green]]);
  table([['收益表',settings.game?'内部平衡例':'类型1优势例'],['当前 p',path[n]],['f₀ / (1/T)',payoff(matrix,path[n]).f0],['f₁ / (1/T)',payoff(matrix,path[n]).f1],['dp/dt / (1/T)',payoff(matrix,path[n]).rate]]);
 }
 if(mode==='12.4'){
  const result=diffuse([2,...Array(29).fill(0)],settings.dt,settings.boundary?'noflux':'periodic',30),n=Math.floor(fraction*30);
  heatmap(left,result.rows,n,2);const a=axes(right,{xmin:0,xmax:30,ymin:-1,ymax:2.3,xlabel:'步',ylabel:'最低值 U/格；总量 U'});
  curve(right,result.minimum.slice(0,n+1).map((v,i)=>[i,v]),a,pink);curve(right,result.mass.slice(0,n+1).map((v,i)=>[i,v]),a,blue);
  if(result.minimum[n]>=-1&&result.minimum[n]<=2.3)dot(right,[n,result.minimum[n]],a,pink);dot(right,[n,result.mass[n]],a,blue);
  $('value').textContent=fmt(result.minimum[n]);$('time-readout').textContent='第 '+n+' 步';
  $('observation-value').textContent='各格总量 '+fmt(result.mass[n])+' U；'+(result.minimum[n]<0?'已出现负格值，请检查更新权重。':'当前所有格值均非负。');
  legend([['总量',blue],['最小格值',pink]]);
  table([['边界',settings.boundary?'无通量':'周期'],['时间步 h / T',settings.dt],['当前最小格值 / U/格',result.minimum[n]],['各格总量 / U',result.mass[n]],['α≤0.5',settings.dt<=.5?'是':'否']]);
 }
}
function failed(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent='探索未能运行：'+error.message+'。请刷新重试。';for(const id of ['controls','play','replay','timeline'])$(id).disabled=true;playback?.pause();}
function guard(fn){try{fn();}catch(error){failed(error);}}
async function start(){({current:chapter}=await mountShell('explore'));mode=chapter?.id;const def=definitions[mode];if(!def)throw Error('本章没有此探索页');
 $('eyebrow').textContent=chapter.id+' 章 · 可视化与探索';for(const id of ['title','question','explanation','formula','assumptions'])$(id).textContent=def[id];
 $('chart-heading').textContent=def.heading;$('value-label').textContent=def.label;$('chart-note').textContent=def.note;
 $('preset-note').textContent='先预测，再播放并查看当前数值。一次改变一个条件，比较它如何影响结果。';controls();recompute();
 playback=createPlayback({duration:100,speed:10,update:draw,failed,changed:reason=>{$('play').textContent=reason==='playing'?'暂停':'播放';$('play-status').textContent=reason==='playing'?'正在播放，观察图形与数值变化。':reason==='ended'?'已显示本次更新的末态；点击播放可从初态观察。':reason==='hidden'?'切离页面后已暂停。':'已暂停，可拖动观察位置。';}});
 $('play').addEventListener('click',()=>guard(()=>playback.running?playback.pause():playback.play()));
 $('replay').addEventListener('click',()=>guard(()=>{playback.seek(0);playback.play();}));
 $('timeline').addEventListener('input',()=>guard(()=>playback.seek(Number($('timeline').value))));
 $('alternate').addEventListener('click',()=>guard(()=>set(alternate(mode,settings))));
 $('reset').addEventListener('click',()=>guard(()=>{controls();recompute();}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.pause('hidden');});
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const session=await(await fetch('/api/session')).json(),response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})}),result=await response.json();$('open-status').textContent=result.message||result.error;}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}});$('notebooks').append(button);}
 playback.seek(100);for(const id of ['controls','play','replay','timeline'])$(id).disabled=false;
 document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';document.title=chapter.title+' · 可视化与探索';}
start().catch(failed);
