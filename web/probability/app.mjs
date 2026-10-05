import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {theme} from '../shared/theme.mjs';
import {frequencyPath,variancePath,noisePath,bayesPath,chainExperiment,alternateSize,alternateNoise,alternatePrior,alternateChain} from './model.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const blue=theme.data['1'],pink=theme.data['2'],gray=theme.data.reference;
const fmt=x=>Number(x.toFixed(5)).toString();
const svg=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
let chapter,mode,p={},playback,rows=[],theory=[],extra=[],end=40;
const markers=[1,1,0,1,0,1,1,0];
const definitions={
 '5.1':{title:'一批细胞的活跃频率有多稳定',question:'每个标签 1 表示活跃、0 表示静息。保持活跃概率 p 不变，逐个观察标签，看累计频率怎样接近模型概率。',explanation:'每个细胞按概率 p 独立取活跃标签。左图是累计活跃频率，右图分别数出活跃与静息细胞；改变样本量沿用相同随机流的前缀，改变种子才得到另一次演示。'},
 '5.2':{title:'扰动进入状态，还是只进入读数',question:'状态偏差 x 随周期演化，读数 y 还包含测量误差。关闭过程扰动后，分别观察状态路径、读数和两种方差。',explanation:'x 是相对基准的偏差，单位为 U，可以为负。过程扰动 w 加入下一状态，测量误差 v 加入当前读数；本例没有依据读数的反馈。右图的 P[n] 表示状态方差，读数方差另加 R。'},
 '5.3':{title:'相同标记为何得到不同后验',question:'保持八次标记的顺序与误差概率不变，只改变观测前的活跃概率，看每次新标记怎样更新判断。',explanation:'细胞标签在观测期间固定。1 表示出现标记，0 表示未出现；给定标签后各次新标记独立产生。左图为活跃后验概率，右图的两个柱按活跃、静息排列，概率之和为 1。'},
 '5.4':{title:'一个细胞的路径与一群细胞的频率',question:'每周期按当前标签选择下一标签。比较一条路径、200 个细胞的同刻活跃频率与理论概率，再用必定交替的规则检查收敛。',explanation:'状态 0 表示静息，1 表示活跃；矩阵行表示当前状态，列表示下一状态，都按 0、1 排列。行向量按 p_next=pP 推进。左图蓝线是群体频率、玫红虚线是理论活跃概率，右图是其中一个细胞的标签。'}
};
function slider(key,label,min,max,step,value){p[key]=value;const group=el('div',undefined,'slider'),lab=el('label',label),out=el('output',value),input=el('input');Object.assign(input,{id:key,type:'range',min,max,step,value});lab.htmlFor=key;out.id=key+'-value';out.htmlFor=key;input.addEventListener('input',()=>{p[key]=Number(input.value);out.value=input.value;guard(recompute);});group.append(lab,out,input);$('sliders').append(group);}
function controls(){p={};$('sliders').replaceChildren();
 if(mode==='5.1'){slider('probability','活跃概率 p',0,1,.05,.3);slider('size','细胞数 n',20,200,20,20);}
 if(mode==='5.2'){slider('a','每步偏差倍数 a',-.9,.9,.1,.8);slider('q','过程方差 Q / U²',0,.1,.01,.04);slider('r','测量方差 R / U²',0,.2,.01,.09);}
 if(mode==='5.3'){slider('prior','活跃态先验概率',.05,.95,.05,.2);slider('error','标记翻转概率 ε',.05,.45,.05,.1);}
 if(mode==='5.4'){slider('alpha','静息 → 活跃的概率 α',0,1,.05,.2);slider('beta','活跃 → 静息的概率 β',0,1,.05,.1);slider('active','初始活跃概率',0,1,.05,0);}
 slider('seed','演示随机种子（整数）',1,99,1,7);
 if(mode==='5.3'){$('seed').disabled=true;$('seed').closest('.slider').hidden=true;}
}
function set(values){for(const [k,v] of Object.entries(values)){p[k]=v;$(k).value=v;$(k+'-value').value=v;}guard(recompute);}
function recompute(){
 if(mode==='5.1'){end=p.size;rows=frequencyPath(p.probability,p.size,p.seed);$('formula').textContent='频率 = 活跃数 / 已观察数；标签由 u < p 决定';$('alternate').textContent=p.size>40?'切换到 20 个细胞':'切换到 200 个细胞';$('preset-note').textContent=`当前 n=${p.size}，p=${fmt(p.probability)}；按钮只改变 n，同种子保留共同的前缀样本。`;$('chart-heading').textContent='累计频率与当前计数';$('chart-note').textContent='从 1 个观察开始，零观察的频率未定义。改变种子得到另一次演示；重复实验的波动范围在 Notebook 中比较。';}
 if(mode==='5.2'){end=40;rows=noisePath(p.a,p.q,p.r,end,p.seed);theory=variancePath(p.a,p.q,0,end);$('formula').textContent='x[n+1]=a x[n]+w[n]；y[n]=x[n]+v[n]；P[n+1]=a²P[n]+Q';$('alternate').textContent=p.q>0?'关闭过程扰动':'恢复过程扰动 Q=0.04';$('preset-note').textContent=`当前 Q=${fmt(p.q)} U²、R=${fmt(p.r)} U²；按钮保留 a、R 与随机种子。`;$('chart-heading').textContent='一条路径与理论方差';$('chart-note').textContent='演示采用零均值均匀扰动，范围分别为 ±√(3Q)、±√(3R)，因此方差为 Q、R。Notebook 使用高斯扰动；分布形状不同，独立性下的方差递推相同。';}
 if(mode==='5.3'){end=markers.length;rows=bayesPath(p.prior,p.error,markers);$('formula').textContent='后验 ∝ 先验 × 似然；标记序列：1, 1, 0, 1, 0, 1, 1, 0';$('alternate').textContent=p.prior>.5?'切换到低先验 0.2':'切换到高先验 0.8';$('preset-note').textContent=`当前活跃先验=${fmt(p.prior)}，ε=${fmt(p.error)}；1 表示标记出现，P(1|活跃)=1−ε、P(1|静息)=ε。`;$('chart-heading').textContent='逐次更新与当前后验';$('chart-note').textContent='隐藏标签在这 8 次观测期间固定。每次新标记在给定标签后独立产生，复制已有标记会重复使用同一条证据。';}
 if(mode==='5.4'){end=40;const result=chainExperiment(p.alpha,p.beta,p.active,end,p.seed);theory=result.theory;extra=result.first;rows=result.frequency.map((x,n)=>[n,x]);$('formula').textContent=`P = [[${fmt(1-p.alpha)}, ${fmt(p.alpha)}], [${fmt(p.beta)}, ${fmt(1-p.beta)}]]`;$('alternate').textContent=p.alpha===1&&p.beta===1?'切换回普通切换示例':'切换到交替示例';$('preset-note').textContent=`当前 α=${fmt(p.alpha)}、β=${fmt(p.beta)}；按钮在 (0.2,0.1) 与 (1,1) 间往返，保留起始分布与种子。`;$('chart-heading').textContent='群体分布与单条路径';$('chart-note').textContent='概率列表按静息、活跃排列。α=β=1 时，[0.5,0.5] 一步后仍不变，其他初始分布却逐步交替；α=β=0 时各起点分别保持原分布。群体频率与理论概率的差异来自有限细胞抽样。';}
 $('assumptions').textContent=mode==='5.3'?'标签在观测期间固定，每条新读数更新我们对它的判断。':'固定随机种子可重播同一组结果；改变条件后，比较频率、分布或路径怎样变化。';
 $('timeline').max=100;$('timeline').step=.1;
 $('value-label').textContent=mode==='5.2'?'状态偏差 / U':mode==='5.3'?'活跃态后验概率':mode==='5.1'?'累计活跃频率':'活跃频率 / 理论概率';
 $('legend').textContent=mode==='5.2'?'蓝色：状态；玫红：观测；右图虚线：理论方差。':mode==='5.3'?'蓝色：活跃后验；玫红柱：静息后验；灰色虚线：活跃先验。':mode==='5.1'?'左图蓝线：累计活跃频率；玫红虚线：活跃概率。右图蓝柱：活跃数；灰柱：静息数。':'左图蓝线：群体活跃频率；玫红虚线：理论概率。右图蓝线：单个标签路径。';
 $('table-note').textContent='表格列出选定的观察位置；频率从第一次观察开始，其余模式保留观测前或演化前的第 0 行。';const table=el('table');const header=el('tr');(mode==='5.1'?['观察数','频率','活跃数']:mode==='5.2'?['周期','状态 / U','观测 / U']:mode==='5.3'?['观测数','活跃概率','静息概率']:['周期','经验活跃频率']).forEach(x=>header.append(el('th',x)));table.append(header);rows.filter((r,i)=>i===0||i===rows.length-1||i%Math.max(1,Math.floor(rows.length/8))===0).forEach(r=>{const tr=el('tr');r.forEach(x=>tr.append(el('td',fmt(x))));table.append(tr);});$('value-table').replaceChildren(table);
 playback?.pause();playback?playback.seek(0):draw(0);
}
function axes(offset,xmax,ymin,ymax,xlabel,ylabel,yTicks=null){
 const width=425,top=45,height=270,x=v=>offset+width*v/xmax,y=v=>top+height*(ymax-v)/(ymax-ymin);
 const chart=$('chart'),categories=xlabel.startsWith('1 =')?xlabel.split('；').map(s=>s.split('=')[1].trim()):null;
 for(const value of yTicks??Array.from({length:5},(_,j)=>ymin+(ymax-ymin)*j/4)){
  chart.append(svg('line',{x1:offset,y1:y(value),x2:offset+width,y2:y(value),stroke:'#e1e7ef'}),svg('text',{x:offset-9,y:y(value)+4,'text-anchor':'end','font-size':12,fill:gray},fmt(value)));
 }
 if(categories)categories.forEach((label,i)=>chart.append(svg('text',{x:x(i+1),y:341,'text-anchor':'middle','font-size':14,fill:gray},label)));
 else for(let j=0;j<=4;j++)chart.append(svg('text',{x:x(xmax*j/4),y:337,'text-anchor':'middle','font-size':12,fill:gray},fmt(xmax*j/4)));
 chart.append(svg('text',{x:offset+width/2,y:365,'text-anchor':'middle','font-size':15,fill:gray},categories?'':xlabel),svg('text',{x:offset,y:23,'font-size':14,fill:gray},ylabel));
 return {x,y};
}
function curve(points,a,color,dashed=false){return svg('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${a.x(x).toFixed(2)},${a.y(y).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':2.7,'stroke-dasharray':dashed?'7 5':'none','stroke-linejoin':'round'});}
function bar(index,value,a,color){return svg('rect',{x:a.x(index)-30,y:a.y(value),width:60,height:a.y(0)-a.y(value),fill:color,rx:5});}
function draw(progress){const i=mode==='5.1'?Math.min(rows.length-1,Math.floor(progress/100*(rows.length-1))):Math.min(end,Math.floor(progress/100*end));const row=rows[i];$('timeline').value=progress;$('time-readout').textContent=(mode==='5.1'?'已观察细胞数：':mode==='5.3'?'已用标记数：':'当前周期：')+row[0];$('play-counter').textContent=`进度 ${progress.toFixed(1)}%`;$('chart').replaceChildren(svg('title',{id:'svg-title'},definitions[mode].title),svg('desc',{id:'svg-desc'},$('chart-note').textContent));
 if(mode==='5.1'){const left=axes(65,end,0,1,'已观察细胞数','活跃频率'),right=axes(625,3,0,end,'1 = 活跃；2 = 静息','计数 / 个');$('chart').append(curve(rows.slice(0,i+1).map(r=>[r[0],r[1]]),left,blue),curve([[0,p.probability],[end,p.probability]],left,pink,true),svg('circle',{cx:left.x(row[0]),cy:left.y(row[1]),r:5,fill:blue}),bar(1,row[2],right,blue),bar(2,row[0]-row[2],right,gray));$('value').textContent=fmt(row[1]);$('observation-value').textContent=`活跃 ${row[2]} / ${row[0]}；模型 p=${fmt(p.probability)}`;}
 if(mode==='5.2'){const extent=Math.max(.2,...rows.flatMap(r=>[Math.abs(r[1]),Math.abs(r[2])]))*1.1;const left=axes(65,end,-extent,extent,'周期 n','偏差 / U'),vmax=Math.max(.02,...theory.map(x=>x+p.r))*1.15,right=axes(625,end,0,vmax,'周期 n','理论方差 / U²');$('chart').append(curve(rows.slice(0,i+1).map(r=>[r[0],r[1]]),left,blue),curve(rows.slice(0,i+1).map(r=>[r[0],r[2]]),left,pink,true),curve(theory.slice(0,i+1).map((x,n)=>[n,x]),right,blue,true),curve(theory.slice(0,i+1).map((x,n)=>[n,x+p.r]),right,pink,true));$('value').textContent=fmt(row[1]);$('observation-value').textContent=`读数 ${fmt(row[2])} U；状态方差 ${fmt(theory[i])} U²；读数方差 ${fmt(theory[i]+p.r)} U²`;}
 if(mode==='5.3'){const left=axes(65,end,0,1,'已用标记数','活跃态后验概率'),right=axes(625,3,0,1,'1 = 活跃；2 = 静息','概率质量');$('chart').append(curve(rows.slice(0,i+1).map(r=>[r[0],r[1]]),left,blue),curve([[0,p.prior],[end,p.prior]],left,gray,true),bar(1,row[1],right,blue),bar(2,row[2],right,pink));$('value').textContent=fmt(row[1]);$('observation-value').textContent=i?`本次标记 ${markers[i-1]}；后验概率和=${fmt(row[1]+row[2])}`:'还未使用观测，显示先验。';}
 if(mode==='5.4'){const left=axes(65,end,0,1,'周期 n','活跃概率 / 频率'),right=axes(625,end,-.1,1.1,'周期 n','一个细胞的状态标签',[0,1]);const steps=[];for(let n=0;n<=i;n++){if(n)steps.push([n,extra[n-1]]);steps.push([n,extra[n]]);}$('chart').append(curve(rows.slice(0,i+1),left,blue),curve(theory.slice(0,i+1).map((x,n)=>[n,x[1]]),left,pink,true),curve(steps,right,blue));$('value').textContent='频率 '+fmt(row[1])+'；概率 '+fmt(theory[i][1]);$('observation-value').textContent=`单个标签=${extra[i]}；200 个细胞在该周期的活跃频率会围绕理论概率波动。`;}
}
function failed(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent=`可视化未能运行：${error.message}。请刷新重试。`;for(const id of ['controls','play','replay','timeline'])$(id).disabled=true;playback?.pause();}
function guard(fn){try{fn();}catch(error){failed(error);}}
async function start(){({current:chapter}=await mountShell('explore'));mode=chapter?.id;if(!definitions[mode])throw Error('本章没有此探索页');$('eyebrow').textContent=chapter.id+' 章 · 可视化与探索';for(const id of ['title','question','explanation'])$(id).textContent=definitions[mode][id];controls();recompute();
 playback=createPlayback({duration:100,speed:8,update:draw,failed,changed:reason=>{$('play').textContent=reason==='playing'?'暂停':reason==='ended'?'再次播放':'播放';$('play-status').textContent=reason==='playing'?'正在播放，观察计数、曲线与读数的同步变化。':reason==='ended'?'已到终点，可重播或改变条件。':'已暂停；改变条件会回到起点。';}});
 $('play').addEventListener('click',()=>playback.running?playback.pause():playback.play());$('replay').addEventListener('click',()=>{playback.seek(0);playback.play();});$('timeline').addEventListener('input',()=>playback.seek(Number($('timeline').value)));
 $('alternate').addEventListener('click',()=>{if(mode==='5.1')set({size:alternateSize(p.size)});if(mode==='5.2')set({q:alternateNoise(p.q)});if(mode==='5.3')set({prior:alternatePrior(p.prior)});if(mode==='5.4')set(alternateChain(p.alpha,p.beta));});$('reset').addEventListener('click',()=>guard(()=>{controls();recompute();}));document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.pause();});
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const session=await(await fetch('/api/session')).json(),response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})}),result=await response.json();$('open-status').textContent=result.message||result.error;}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}});$('notebooks').append(button);}
 playback.seek(0);for(const id of ['controls','play','replay','timeline'])$(id).disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';document.title=chapter.title+' · 可视化与探索';
}
start().catch(failed);
