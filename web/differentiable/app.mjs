import {mountShell,el} from '../shared/course-shell.mjs';
import {graphView,rolloutView,odeView,pinnView,hybridView,nextKind} from './model.mjs';

const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const configs={
 '15.1':{title:'差分越小，梯度一定越准吗？',question:'先预测：把差分步长不断缩小，会一直更接近链式法则梯度吗？',context:'固定一神经元 tanh 网络、目标与其他权重；只扰动输入权重 w。实际测得的量先除以参考量：例如 2 U ÷ 1 U，网络收到无量纲数字2。曲线为中心差分相对手推梯度的绝对误差。',formula:'z=xₚₕᵧₛ/(1 U)；L=(v tanh(wz+b)+c−y)²/2',assumptions:'参数表与 Notebook 中的 x 指网络已接收的无量纲数值 z；物理坐标仍可用 U 标出。光滑点比较程序导数；极小 h 的浮点抵消与模型机制正确性是两回事。',chart:'差分步长与梯度误差',reading:'Notebook 展示计算图、手推梯度、反向累积和独立差分扫描。',first:['差分步长的十进指数',-10,-1,.5,-4],second:['实际输入 / U',.2,1.5,.1,.7],kind:null,run:(a,b)=>graphView(a,b)},
 '15.2':{title:'一步误差小，长期预测也好吗？',question:'先预测：每一步使用真实旧状态，和只用自己的上一预测，曲线会怎样不同？',context:'状态和输入用 U 记录；送进 tanh 前，先把物理状态除以参考量 1 U，得到无量纲数值。网页代码中的 x 是以 U 计的数值，所以可简写 tanh(x)；候选只改变状态系数 a。',formula:'x⁺=0.88x+0.2u+(0.04 U)tanh(x/(1 U))',assumptions:'这里只展示已知映射的前向误差，不模拟训练；真轨迹只用于评估和一步预测。所有计算使用同一固定采样间隔。',chart:'留出初值下的一步与自由轨迹',reading:'Notebook 将完整轨迹留出，区分 teacher forcing、自由滚动及新采样间隔。',first:['候选状态系数 a',.78,.95,.01,.85],second:['预测步数',3,25,1,16],kind:'roll',run:(a,b,k)=>rolloutView(a,b,k)},
 '15.3':{title:'连续方程与程序梯度为什么不同？',question:'先预测：缩小 Euler 步长，终点状态和消除系数梯度怎样靠近连续解析值？',context:'标量清除 x′=−kx，其中 k 是一阶消除速率常数；固定初态 2 U 与终点 2 T，切换显示状态或对 k 的导数。',formula:'x(t)=2exp(−kt)；s(t)=∂x/∂k=−t x(t)',assumptions:'这是可解析的线性教学基准。Euler 自动微分给离散程序梯度；完整连续伴随的观测跳跃与反向重建在 Notebook 中推导。',chart:'连续解析值与 Euler 更新',reading:'Notebook 对照连续解、前向灵敏度、离散反传和带跳跃的伴随积分。',first:['请求 Euler 步长 / T',.025,.4,.025,.2],second:['消除系数 k /T',.2,1.5,.1,.7],kind:'state',run:(a,b,k)=>odeView(a,b,k)},
 '15.4':{title:'内点满足方程，边界就正确吗？',question:'先预测：保持扩散方程残差接近零，增加 s·x 后，初值与边界会怎样？',context:'候选 φ=exp(−rt)cos(πx)+s x 表示相对均匀背景的浓度偏差，以 1 U/V 为数值单位；负值表示低于背景，不是负的绝对浓度。目标是归一化区间的无通量扩散，D=0.2/T。加入 s·x 同时改变初始分布与端点条件，不是只改变边界的单因素实验。',formula:'方程残差=(Dπ²−r)exp(−rt)cos(πx)；初值差=sx；端点导数=s',assumptions:'并列检查方程、初值、边界与参考网格误差。残差和参考误差使用相同的41个位置，网页没有训练或独立测试集；有限检查点不证明全域 PDE。',chart:'给定时刻的空间剖面',reading:'Notebook 从 ODE 残差扩展到一维扩散，分别核验方程、初值与无通量边界。',first:['候选衰减率 r /T',1.4,2.6,.01,1.97],second:['边界斜率 s',0,.4,.01,.2],kind:null,run:(a,b)=>pinnView(a,b)},
 '15.5':{title:'相同轨迹意味着参数相同吗？',question:'先预测：两组 k−θ 相同的参数在改变输入后仍能否由总量轨迹区分？',context:'右端为 x′=u−(k−θ)x，k 为一阶消除系数。基线 k=0.4/T、θ=0.1/T；候选参数可调。输入在 2 T 时改变。',formula:'总量只含 k−θ；独立消除通量为 kx',assumptions:'同形修正的结构混淆无法靠改变 u 单独解除；切换显示额外通量读数是不同观测任务。普通 tanh 混合修正见 Notebook。',chart:'总量轨迹与独立消除通量',reading:'Notebook 展示混合右端、零修正极限、独立输入与参数不可辨识反例。',first:['候选消除系数 k /T',.3,.8,.05,.6],second:['候选线性修正 θ /T',0,.4,.05,.3],kind:'state',run:(a,b,k)=>hybridView(a,b,k)}
};
const state={first:0,second:0,kind:null};
function svg(tag,attrs={},label){const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);if(label!==undefined)node.textContent=label;return node;}
function chart(series){
 const plot=$('chart');plot.replaceChildren(svg('title',{},'教学轨迹对照'),svg('desc',{},'蓝色为已知或完整结果；粉色为当前模型；绿色圆点为离散采样。'));
 const points=series.flatMap(row=>row.points),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),padding=Math.max(.1,(maxY-minY)*.12);
 const lo=minY-padding,hi=maxY+padding,left=64,right=692,top=20,bottom=330;
 const x=value=>left+(right-left)*(value-minX)/Math.max(maxX-minX,1e-9);
 const y=value=>bottom-(bottom-top)*(value-lo)/Math.max(hi-lo,1e-9);
 for(let tick=0;tick<=4;tick++){
  const value=lo+(hi-lo)*tick/4,yy=y(value);
  plot.append(svg('line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'#d4deeb','stroke-width':1}),
              svg('text',{x:left-8,y:yy+4,'text-anchor':'end','font-size':13,fill:'#536b81'},Number(value.toFixed(2)).toString()));
 }
 for(let tick=0;tick<=4;tick++){const value=minX+(maxX-minX)*tick/4;plot.append(svg('text',{x:x(value),y:354,'text-anchor':'middle','font-size':13,fill:'#536b81'},Number(value.toFixed(2)).toString()));}
 for(const row of series){
  if(!row.dots){const path=row.points.map(([xx,yy],i)=>(i?'L':'M')+x(xx).toFixed(2)+' '+y(yy).toFixed(2)).join(' ');plot.append(svg('path',{d:path,fill:'none',stroke:row.color,'stroke-width':3,'stroke-linejoin':'round'}));}
  else for(const [xx,yy] of row.points)plot.append(svg('circle',{cx:x(xx),cy:y(yy),r:4.5,fill:row.color,stroke:'#fff','stroke-width':1}));
 }
 $('legend').replaceChildren(...series.map(row=>{const item=el('span');const mark=el('i');mark.style.background=row.color;item.append(mark,el('span',row.label));return item;}));
}
function draw(config,chapter){
 const result=config.run(state.first,state.second,state.kind);
 chart(result.series);
 $('numbers').replaceChildren(...result.stats.map(([label,value])=>{const box=el('div');box.append(el('span',label),el('strong',String(value)));return box;}));
 $('first-value').textContent=String(Number(state.first.toFixed(2)));
 $('second-value').textContent=String(Number(state.second.toFixed(2)));
 $('current-condition').textContent=result.condition;
 $('finding').textContent=result.finding;
 if(chapter==='15.2')$('toggle-case').textContent=state.kind==='roll'?'切换到一步预测':'切换回自由滚动';
 if(chapter==='15.3')$('toggle-case').textContent=state.kind==='state'?'切换到参数梯度':'切换回状态轨迹';
 if(chapter==='15.5')$('toggle-case').textContent=state.kind==='state'?'切换到独立通量':'切换回总量轨迹';
}
function fail(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent='探索未能运行：'+error.message+'。请刷新重试。';$('controls').disabled=true;}
function guard(fn){try{fn();}catch(error){fail(error);}}
async function openLesson(lesson,button){button.disabled=true;try{const session=await(await fetch('/api/session')).json();const response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})});const result=await response.json();$('open-status').textContent=result.message||result.error||'打开请求已发送。';}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}}
async function start(){
 const {current:chapter}=await mountShell('explore');const config=configs[chapter?.id];if(!config)throw Error('本章没有此探索页');
 $('chapter-label').textContent=chapter.id+' '+chapter.title;$('experiment-title').textContent=config.title;$('question').textContent=config.question;
 $('context').textContent=config.context;$('formula').textContent=config.formula;$('assumptions').textContent=config.assumptions;
 $('chart-title').textContent=config.chart;$('reading-intro').textContent=config.reading;
 const ranges=[['first',config.first],['second',config.second]];
 for(const[key,definition]of ranges){const[label,min,max,step,initial]=definition,input=$(key+'-range');$(key+'-label').textContent=label;
  Object.assign(input,{min,max,step,value:initial});state[key]=initial;input.addEventListener('input',()=>guard(()=>{state[key]=Number(input.value);draw(config,chapter.id);}));}
 state.kind=config.kind;
 if(config.kind){$('toggle-case').addEventListener('click',()=>guard(()=>{state.kind=nextKind(chapter.id,state.kind);draw(config,chapter.id);}));}
 else $('toggle-case').hidden=true;
 $('reset').addEventListener('click',()=>guard(()=>{state.first=config.first[4];state.second=config.second[4];state.kind=config.kind;
  $('first-range').value=String(state.first);$('second-range').value=String(state.second);draw(config,chapter.id);}));
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',()=>openLesson(lesson,button));$('notebooks').append(button);}
 draw(config,chapter.id);$('controls').disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';
}
start().catch(fail);
