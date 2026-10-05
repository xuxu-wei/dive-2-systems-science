import {mountShell,el} from '../shared/course-shell.mjs';
import {createPlayback} from '../shared/playback.mjs';
import {theme} from '../shared/theme.mjs';
import {sampling,filterExperiment,compartment,alternateSampling,alternateWindow,alternateStep} from './model.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const blue=theme.data['1'],pink=theme.data['2'],gray=theme.data.reference;
const fmt=x=>Number(x.toFixed(5)).toString();
const tickFmt=x=>Number(x.toPrecision(3)).toString();
const svg=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
let chapter,mode,p={},playback,data,end;
const definitions={
 '6.1':{title:'相同读数，可能来自不同节律',question:'每秒起伏 0.8 次的节律，每秒测一次，会留下什么读数？先作预测，再把采样率提高，比较曲线与测量点。',explanation:'用余弦 x(t) 表示振幅为 1 U 的节律偏差。频率 f 表示每秒重复几次，采样率 fₛ 表示每秒测几次，二者的单位都是 Hz。f=0.8 Hz、fₛ=1 Hz 时，这些点也符合 0.2 Hz 的余弦；从同样的读数辨不出两种节律，这就是混叠。'},
 '6.2':{title:'一个平均窗口，怎样改变不同频率',question:'把当前读数和前四个读数相加，再除以五，会把节律压低多少、推迟多少？改变频率和窗口，比较输入、输出与幅值比。',explanation:'用 n 从 0 开始编号，窗口长度 W 表示每次平均几个点。这里把 n<0 的输入设为零，始终除以 W；例如 W=5 时第一个输出为 x[0]/5。这是固定有限脉冲响应滤波器的启动方式，与 6.1 按已有点数求平均不同。'},
 '6.3':{title:'采样间隔怎样影响数值近似',question:'如果相隔更久才测一次，原本非负的清除总量会变成负值吗？先作预测，再增大间隔，比较解析曲线、精确采样点与 Euler 近似。',explanation:'单室收支为 dA/dt=u−kA：A 是物质总量，u 是每单位时间进入的量，kA 是每单位时间清除的量。本页保持 u、k 恒定且非负，初值也非负。精确采样通过区间积分得到，Euler 则用区间起点的变化率作近似；下面比较两种递推的倍率。'}
};
function slider(key,label,min,max,step,value){p[key]=value;const group=el('div',undefined,'slider'),lab=el('label',label),out=el('output',value),input=el('input');Object.assign(input,{id:key,type:'range',min,max,step,value});lab.htmlFor=key;out.id=key+'-value';out.htmlFor=key;input.addEventListener('input',()=>{p[key]=Number(input.value);out.value=input.value;guard(recompute);});group.append(lab,out,input);$('sliders').append(group);}
function controls(){p={};$('sliders').replaceChildren();
 if(mode==='6.1'){slider('frequency','节律频率 f / Hz',.1,1.8,.1,.8);slider('sample-rate','采样率 fₛ / Hz',.5,4,.25,1);}
 if(mode==='6.2'){slider('frequency','输入频率 f /（周期/样本）',0,.5,.01,.1);slider('window','窗口长度 W / 样本',1,9,1,5);}
 if(mode==='6.3'){slider('k','清除系数 k / T⁻¹',0,.3,.02,.2);slider('u','恒定输入 u /（U/T）',0,1,.1,0);slider('initial','初始总量 A₀ / U',0,10,1,10);slider('step','采样间隔 h / T',1,12,1,1);}
}
function set(values){for(const [key,value] of Object.entries(values)){p[key]=value;$(key).value=value;$(key+'-value').value=value;}guard(recompute);}
function legend(entries){$('legend').replaceChildren();for(const [label,color,dashed] of entries){const item=el('span',label,dashed?'dashed':'');item.style.setProperty('--line-color',color);$('legend').append(item);}}
function table(headers,rows){$('table-note').textContent='表中列出起点、终点以及若干中间计算点；图中显示完整序列。';const t=el('table'),header=el('tr');headers.forEach(text=>header.append(el('th',text)));t.append(header);rows.filter((_,i)=>i===0||i===rows.length-1||i%Math.max(1,Math.floor(rows.length/10))===0).forEach(row=>{const tr=el('tr');row.forEach(value=>tr.append(el('td',fmt(value))));t.append(tr);});$('value-table').replaceChildren(t);}
function recompute(){
 if(mode==='6.1'){
  end=10;data=sampling(p.frequency,p['sample-rate'],end);const next=alternateSampling(p['sample-rate']);
  $('formula').textContent='x(t)=cos(2πft)；tₙ=n/fₛ；采样间隔 Δt=1/fₛ';
  $('alternate').textContent=`切换到 ${next} Hz 采样`;
  $('preset-note').textContent=`当前 f=${fmt(p.frequency)} Hz，fₛ=${fmt(p['sample-rate'])} Hz；按钮只改变采样率，保留节律频率。`;
  $('assumptions').textContent='本例不加测量噪声，余弦从相位零开始，均匀采样至 10 s。为画出连续参照，每隔 0.01 s 计算一个点；仪器的测量间隔则为 1/fₛ s。这里直接计算余弦，无需数值求解微分方程。';
  $('chart-heading').textContent='连续节律与相同的采样读数';$('chart-note').textContent='左图画设定的原节律，右图画符合相同测量点的最低非负余弦频率。采样率提高后，两条曲线可能重合。实际只有读数时，还需知道可能的频率范围，才能判断真实节律。';
  $('value-label').textContent='低频候选 / Hz';$('value').textContent=fmt(data.aliasFrequency);
  legend([['原节律',blue,false],['采样读数（圆点）',pink,false],['同样本低频候选',gray,true]]);
  table(['采样时刻 / s','读数 / U','低频候选值 / U'],data.samples.map(([t,x])=>[t,x,Math.cos(2*Math.PI*data.aliasFrequency*t)]));
 }
 if(mode==='6.2'){
  end=60;data=filterExperiment(p.frequency,p.window,end);const next=alternateWindow(p.window);
  $('formula').textContent='y[n]=(x[n]+…+x[n−W+1])/W；H(f)=Σⱼ exp(−i2πfj)/W，j=0,…,W−1';
  $('alternate').textContent=next===1?'切换到 W=1（不平滑）':'切换到 W=5（五点平均）';
  $('preset-note').textContent=`当前 W=${p.window}，f=${fmt(p.frequency)} 周期/样本；按钮只改变 W。稳态幅值比=${fmt(data.selected.magnitude)}。`;
  $('assumptions').textContent='从 n=0 起输入 x[n]=cos(2πfn)，振幅为 1 U。这里 f 的单位为周期/样本：f=0.1 表示每十个采样间隔转一圈。前 W−1 个输出受补零影响，窗口装满后才符合稳态频率响应 H(f)；式中的 i 为虚数单位。';
  $('chart-heading').textContent='时域读数与稳态幅值比';$('chart-note').textContent='右图画出 |H(f)|，圆点标出当前频率；例如 W=5、f=0.2 时，五个等间隔相位抵消，稳态输出为零。零增益处没有相位。在非零响应的频段，相位斜率对应 (W−1)/2 个采样间隔的群延迟；一般波形还会因各频率衰减不同而改变形状。';
  $('value-label').textContent='当前频率的幅值比';$('value').textContent=fmt(data.selected.magnitude);
  legend([['时域输入',blue,false],['时域输出 / 频响幅值',pink,true]]);
  table(['样本序号 n','输入 / U','输出 / U'],data.input.map(([n,x])=>[n,x,data.output[n][1]]));
 }
 if(mode==='6.3'){
  end=60;data=compartment(p.k,p.u,p.initial,p.step,end);const next=alternateStep(p.step),kh=p.k*p.step;
  $('formula').textContent='A[n+1]=aA[n]+bu[n]；a=exp(−kh)，b=(1−exp(−kh))/k；k=0 时 b=h';
  $('alternate').textContent=`切换到${next===1?'小':'大'}间隔 h=${next}`;
  $('preset-note').textContent=`当前 kh=${fmt(kh)}，Euler 因子=${fmt(data.eulerPole)}。${kh>1?'此因子为负；无输入且 A₀>0 时将出现符号交替。':'此因子非负；非负初值和输入不会产生负值。'}按钮只改变 h。`;
  $('assumptions').textContent='总量单位为 U，时间单位为 T，故 u 的单位是 U/T，k 的单位是 T⁻¹。采样间隔为 h T，输入在每个区间内保持不变，本页整段也取同一值。连续线由解析解绘制，Euler 则每隔 h T 更新一次。';
  $('chart-heading').textContent='连续轨迹、离散点与实极点';$('chart-note').textContent='右图把无输入时的每步倍率记为实极点 p。−1<p<1 时，任意初值都会趋于零；负倍率还会使符号交替。k=0 时精确倍率为 1，总量保持原值；若有恒定输入则逐步累积。图中保留 Euler 产生的负值或发散，便于找出近似失效的间隔。';
  $('value-label').textContent='精确 / Euler 极点';$('value').textContent=fmt(data.coefficients.a)+' / '+fmt(data.eulerPole);
  legend([['解析轨迹 / 精确采样',blue,false],['Euler 近似',pink,true],['实极点的衰减区间',gray,true]]);
  table(['采样时刻 / T','精确量 / U','Euler 量 / U'],data.exact.map(([t,x],i)=>[t,x,data.euler[i][1]]));
 }
 playback?.pause();playback?playback.seek(0):draw(0);
}
function axes(chart,{xmin=0,xmax,ymin,ymax,xlabel,ylabel}){
 const left=68,top=45,width=442,height=264,x=v=>left+width*(v-xmin)/(xmax-xmin),y=v=>top+height*(ymax-v)/(ymax-ymin);
 for(let j=0;j<=4;j++){const value=ymin+(ymax-ymin)*j/4;chart.append(svg('line',{x1:left,y1:y(value),x2:left+width,y2:y(value),stroke:'#e1e7ef'}),svg('text',{x:left-9,y:y(value)+5,'text-anchor':'end','font-size':14,fill:gray},tickFmt(value)));}
 for(let j=0;j<=4;j++){const value=xmin+(xmax-xmin)*j/4;chart.append(svg('text',{x:x(value),y:337,'text-anchor':'middle','font-size':14,fill:gray},tickFmt(value)));}
 chart.append(svg('text',{x:left+width/2,y:368,'text-anchor':'middle','font-size':16,fill:gray},xlabel),svg('text',{x:left,y:23,'font-size':16,fill:gray},ylabel));return {x,y};
}
function curve(chart,points,a,color,dashed=false){chart.append(svg('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${a.x(x).toFixed(2)},${a.y(y).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':2.7,'stroke-dasharray':dashed?'7 5':'none','stroke-linejoin':'round'}));}
function marker(chart,[x,y],a,color,r=4){chart.append(svg('circle',{cx:a.x(x),cy:a.y(y),r,fill:'white',stroke:color,'stroke-width':2.4}));}
function poles(chart){
 const xmin=Math.min(-1.25,data.eulerPole-.3),xmax=1.25,left=68,width=442,x=v=>left+width*(v-xmin)/(xmax-xmin);
 chart.append(svg('rect',{x:x(-1),y:82,width:x(1)-x(-1),height:196,fill:'#555555',opacity:.06}),svg('text',{x:68,y:25,'font-size':16,fill:gray},'实极点：无输入偏差的每步倍数'));
 for(const value of [xmin,-1,0,1]){chart.append(svg('line',{x1:x(value),y1:78,x2:x(value),y2:293,stroke:gray,'stroke-dasharray':'4 5','stroke-width':1}),svg('text',{x:x(value),y:326,'text-anchor':'middle','font-size':14,fill:gray},fmt(value)));}
 for(const [label,value,color,y] of [['精确',data.coefficients.a,blue,130],['Euler',data.eulerPole,pink,227]]){chart.append(svg('line',{x1:left,y1:y,x2:left+width,y2:y,stroke:'#a4b3c0'}),svg('text',{x:left,y:y-24,'font-size':16,fill:gray},`${label}：p=${fmt(value)}`),svg('circle',{cx:x(value),cy:y,r:7,fill:'white',stroke:color,'stroke-width':3}));}
 chart.append(svg('text',{x:289,y:368,'text-anchor':'middle','font-size':15,fill:gray},'阴影内部 −1 < p < 1；边界不计入'));
}
function draw(progress){
 const t=end*progress/100,left=$('chart'),right=$('detail-chart');$('timeline').value=progress;$('play-counter').textContent=`进度 ${progress.toFixed(1)}%`;
 left.replaceChildren(svg('title',{id:'svg-title'},definitions[mode].title),svg('desc',{id:'svg-desc'},$('chart-note').textContent));right.replaceChildren(svg('title',{id:'detail-title'},mode==='6.1'?'相同样本的低频候选':mode==='6.2'?'因果平均的频率响应':'精确与 Euler 实极点'),svg('desc',{id:'detail-desc'},$('chart-note').textContent));
 if(mode==='6.1'){
  const a=axes(left,{xmax:end,ymin:-1.2,ymax:1.2,xlabel:'时间 t / s',ylabel:'设定的原节律 / U'}),b=axes(right,{xmax:end,ymin:-1.2,ymax:1.2,xlabel:'时间 t / s',ylabel:'同样本低频候选 / U'});
  curve(left,data.continuous.filter(r=>r[0]<=t+1e-10),a,blue);curve(right,data.alias.filter(r=>r[0]<=t+1e-10),b,gray,true);
  const visible=data.samples.filter(r=>r[0]<=t+1e-10);visible.forEach(row=>{marker(left,row,a,pink);marker(right,row,b,pink);});
  $('time-readout').textContent=`已观察至 ${t.toFixed(2)} s`;$('observation-value').textContent=`采样间隔 ${fmt(1/p['sample-rate'])} s；已取得 ${visible.length} 个读数（含 t=0）。`;
 }
 if(mode==='6.2'){
  const n=Math.floor(t),a=axes(left,{xmax:end,ymin:-1.2,ymax:1.2,xlabel:'样本序号 n',ylabel:'输入与输出 / U'}),b=axes(right,{xmax:.5,ymin:0,ymax:1.1,xlabel:'频率 /（周期/样本）',ylabel:'稳态幅值比 |H(f)|'});
  curve(left,data.input.slice(0,n+1),a,blue);curve(left,data.output.slice(0,n+1),a,pink,true);marker(left,data.output[n],a,pink);curve(right,data.response,b,pink,true);marker(right,[p.frequency,data.selected.magnitude],b,pink,6);
  $('time-readout').textContent=`当前样本 n=${n}`;$('observation-value').textContent=`输入 ${fmt(data.input[n][1])} U → 输出 ${fmt(data.output[n][1])} U；相位 ${data.selected.phase===null?'未定义（零增益）':fmt(data.selected.phase)+' rad'}；${n<p.window-1?'当前仍在启动段。':'当前已越过启动边界。'}`;
 }
 if(mode==='6.3'){
  const values=[...data.continuous,...data.euler].map(row=>row[1]),low=Math.min(0,...values),high=Math.max(1,...values),padding=(high-low)*.1,a=axes(left,{xmax:end,ymin:low-padding,ymax:high+padding,xlabel:'时间 t / T',ylabel:'总量 A / U'});
  curve(left,[[0,0],[end,0]],a,gray,true);curve(left,data.continuous.filter(r=>r[0]<=t+1e-10),a,blue);const exact=data.exact.filter(r=>r[0]<=t+1e-10),euler=data.euler.filter(r=>r[0]<=t+1e-10);curve(left,euler,a,pink,true);exact.forEach(row=>marker(left,row,a,blue,3));euler.forEach(row=>marker(left,row,a,pink,3));poles(right);
  const current=exact.at(-1),approx=euler.at(-1);$('time-readout').textContent=`观察时间 ${t.toFixed(2)} T`;$('observation-value').textContent=`最近采样 t=${fmt(current[0])} T：精确 ${fmt(current[1])} U，Euler ${fmt(approx[1])} U。${Math.abs(data.eulerPole)>=1?'Euler 无输入偏差不渐近衰减。':''}`;
 }
}
function failed(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent=`可视化未能运行：${error.message}。请刷新重试。`;for(const id of ['controls','play','replay','timeline'])$(id).disabled=true;playback?.pause();}
function guard(fn){try{fn();}catch(error){failed(error);}}
async function start(){
 ({current:chapter}=await mountShell('explore'));mode=chapter?.id;if(!definitions[mode])throw Error('本章没有此探索页');$('eyebrow').textContent=chapter.id+' 章 · 可视化与探索';for(const id of ['title','question','explanation'])$(id).textContent=definitions[mode][id];controls();recompute();
 playback=createPlayback({duration:100,speed:8,update:draw,failed,changed:reason=>{$('play').textContent=reason==='playing'?'暂停':reason==='ended'?'再次播放':'播放';$('play-status').textContent=reason==='playing'?'正在播放，观察时间、曲线与读数同步变化。':reason==='ended'?'已到终点，可重播或改变条件。':reason==='hidden'?'切离页面后已暂停；返回后可继续播放。':'已暂停；改变条件会回到起点。';}});
 $('play').addEventListener('click',()=>guard(()=>playback.running?playback.pause():playback.play()));$('replay').addEventListener('click',()=>guard(()=>{playback.seek(0);playback.play();}));$('timeline').addEventListener('input',()=>guard(()=>playback.seek(Number($('timeline').value))));
 $('alternate').addEventListener('click',()=>{if(mode==='6.1')set({'sample-rate':alternateSampling(p['sample-rate'])});if(mode==='6.2')set({window:alternateWindow(p.window)});if(mode==='6.3')set({step:alternateStep(p.step)});});$('reset').addEventListener('click',()=>guard(()=>{controls();recompute();}));document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.pause('hidden');});
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const session=await(await fetch('/api/session')).json(),response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})}),result=await response.json();$('open-status').textContent=result.message||result.error;}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}});$('notebooks').append(button);}
 playback.seek(0);for(const id of ['controls','play','replay','timeline'])$(id).disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';document.title=chapter.title+' · 可视化与探索';
}
start().catch(failed);
