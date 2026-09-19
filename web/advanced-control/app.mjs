import {mountShell,el} from '../shared/course-shell.mjs';
import {feedbackView,robustView,adaptiveView,stochasticView,consensusView,learningView,decisionView,nextKind} from './model.mjs';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const configs={
 '16.1':{title:'执行上限会改变能量下降吗？',question:'先预测：无饱和的反馈证明对大扰动仍成立吗？',context:'标量非线性系统 x′=−0.4x+0.8x³+u；请求 u=−0.8x−1.2x³，实际输入要截断。先看 V=x²/2 的导数，再切换到短路径。',formula:'V′=x[−0.4x+0.8x³+clip(−0.8x−1.2x³)]',assumptions:'状态 U，时间 T，输入 U/T；只展示给定方程与有限路径。',chart:'实际执行与请求反馈',reading:'Notebook 推导未饱和充分条件，逐行核对实际输入和不同初值。',first:['执行上限 / U/T',.2,3,.1,.5],second:['状态或初值 / U',.1,1.5,.1,1.1],kind:'energy',labels:['切换到状态路径','切换回能量导数'],run:feedbackView},
 '16.2':{title:'何时能说整个模型区间稳定？',question:'先预测：只验证两端、使用同一个 P，可以推出哪些中间模型？',context:'二维仿射模型 A(α)=(1−α)A₀+αA₁。P=diag(p,1)，展示 AᵀP+PA 的最大特征值；集合外矩阵作为反例单列。',formula:'P≻0；每个顶点 AᵢᵀP+PAᵢ≺0',assumptions:'结论覆盖 α∈[0,1] 的仿射凸包；外部矩阵不是这两个顶点的凸组合。',chart:'共同二次证书的最大导数特征值',reading:'Notebook 逐项检查顶点、共同 P、凸组合和集合外失效。',first:['区间权重 α',0,1,.05,.5],second:['P 第一对角值',.2,3,.1,1],kind:'inside',labels:['查看集合外反例','返回声明集合'],run:robustView},
 '16.3':{title:'在线估计什么时候能追上变化？',question:'先预测：弱激励、遗忘与输入限幅会怎样影响参数估计和状态跟踪？',context:'控制器先用当前估计选限幅输入；真实状态到达后才按递推最小二乘更新。第 11 步真实系数改变。',formula:'u=clip(r−âx)；x⁺=a x+u；随后更新 â',assumptions:'真实系数蓝线只供核验，决策器不读取未来观测。跟踪好不等于辨识准。',chart:'估计与真实漂移',reading:'Notebook 展示递推增益、投影、弱激励和执行先后。',first:['遗忘因子',.8,1,.01,.95],second:['输入上限 / U',.1,1,.05,.4],kind:'estimate',labels:['查看状态跟踪','返回参数估计'],run:adaptiveView},
 '16.4':{title:'单条路径能代表随机风险吗？',question:'先预测：随机路径的平均和方差怎样与解析 OU 结果对应？',context:'用固定随机种子重复 400 次 Euler–Maruyama，每次只读取本步布朗增量；与已知解析矩比较。',formula:'dX=−aXdt+σdW；Var X(t)=σ²(1−e⁻²ᵃᵗ)/(2a)',assumptions:'a=0 使用 σ²t 极限；有限 Monte Carlo 误差不等于数值离散误差。',chart:'解析矩与固定种子模拟',reading:'Notebook 先固定增量，随后做粗细路径配对和阈值风险实验。',first:['恢复率 a /T',0,1.2,.05,.6],second:['噪声幅度 σ / U/√T',.1,1,.05,.4],kind:'variance',labels:['切换到均值','切换回方差'],run:stochasticView},
 '16.5':{title:'平均守恒就一定达成一致吗？',question:'先预测：相同无向网络在延迟与大步长下，节点会怎样变化？',context:'三节点路径图从[0,4,0]出发。所有更新先读旧历史，再统一写入新状态。',formula:'xₙ₊₁=xₙ−h L xₙ₋d',assumptions:'无延迟谱条件不能直接用于 d>0；有限曲线只说明当前历史与步数。',chart:'延迟下的局部一致性',reading:'Notebook 推导图平均守恒、无延迟谱界和延迟反例。',first:['同步步长 h / T',.05,.7,.01,.4],second:['整数延迟 / 步',0,3,1,1],kind:'states',labels:['查看节点差距','返回节点轨迹'],run:consensusView},
 '16.6':{title:'训练表变平就已学到最优策略吗？',question:'先预测：重复固定经验如何改变 Q 值，访问计数能说明什么？',context:'同两条经验重复 30 次。终止经验只累加本步奖励，不再使用后继 Q 值。',formula:'Q(s,a)←Q(s,a)+α[r+γmax Q(s′,·)−Q(s,a)]',assumptions:'固定经验只是教学更新；不具备一般收敛定理所需的完整探索与步长条件。',chart:'有限经验下的表格更新',reading:'Notebook 从已知模型的策略评价进入固定经验 Q 更新，区分训练与独立评估。',first:['学习率 α',.05,1,.05,.4],second:['折扣因子 γ',0,.95,.05,.8],kind:'q',labels:['查看动作访问数','返回 Q 值'],run:learningView},
 '16.7':{title:'预测可行能保证实际安全吗？',question:'先预测：预测系数偏离真实值时，最小代价动作会不会让实际状态越界？',context:'在有限动作中先检查输入上限与预测状态范围，再按预测误差与动作成本选最小值。真实系数仅用于最终核验。',formula:'x̂⁺=âx+u；目标=(x̂⁺−r)²+0.1u²',assumptions:'动作选取只使用 â；真实值不参加选择。没有可行候选必须显示失败。',chart:'预测与实际状态的约束',reading:'Notebook 给出有限动作优化、无可行候选和完整配对测试。',first:['预测系数 â',.4,1.4,.05,1],second:['输入上限 / U',0,1,.1,.5],kind:'prediction',labels:['查看实际状态','返回预测状态'],run:decisionView}
};
const state={first:0,second:0,kind:null};
function svg(tag,attrs={},label){const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);if(label!==undefined)node.textContent=label;return node;}
function chart(series){
 const plot=$('chart');plot.replaceChildren(svg('title',{},'教学模型条件对照'),svg('desc',{},'不同颜色为已声明的模型或条件，圆点为当前选择。'));
 const points=series.flatMap(row=>row.points),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 if(!points.length||points.some(([x,y])=>!Number.isFinite(x)||!Number.isFinite(y)))throw Error('计算结果不是有限数值');
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),padding=Math.max(.1,(maxY-minY)*.12);
 const lo=minY-padding,hi=maxY+padding,left=64,right=692,top=20,bottom=330;
 const x=value=>left+(right-left)*(value-minX)/Math.max(maxX-minX,1e-9);
 const y=value=>bottom-(bottom-top)*(value-lo)/Math.max(hi-lo,1e-9);
 for(let tick=0;tick<=4;tick++){const value=lo+(hi-lo)*tick/4,yy=y(value);plot.append(svg('line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'#d4deeb','stroke-width':1}),svg('text',{x:left-8,y:yy+4,'text-anchor':'end','font-size':13,fill:'#536b81'},Number(value.toFixed(2)).toString()));}
 for(let tick=0;tick<=4;tick++){const value=minX+(maxX-minX)*tick/4;plot.append(svg('text',{x:x(value),y:354,'text-anchor':'middle','font-size':13,fill:'#536b81'},Number(value.toFixed(2)).toString()));}
 for(const row of series){if(!row.dots){const path=row.points.map(([xx,yy],i)=>(i?'L':'M')+x(xx).toFixed(2)+' '+y(yy).toFixed(2)).join(' ');plot.append(svg('path',{d:path,fill:'none',stroke:row.color,'stroke-width':3,'stroke-linejoin':'round'}));}else for(const [xx,yy] of row.points)plot.append(svg('circle',{cx:x(xx),cy:y(yy),r:4.5,fill:row.color,stroke:'#fff','stroke-width':1}));}
 $('legend').replaceChildren(...series.map(row=>{const item=el('span');const mark=el('i');mark.style.background=row.color;item.append(mark,el('span',row.label));return item;}));
}
function draw(config){const result=config.run(state.first,state.second,state.kind);chart(result.series);
 $('numbers').replaceChildren(...result.stats.map(([label,value])=>{const box=el('div');box.append(el('span',label),el('strong',String(value)));return box;}));
 $('first-value').textContent=String(Number(state.first.toFixed(2)));$('second-value').textContent=String(Number(state.second.toFixed(2)));
 $('current-condition').textContent=result.condition;$('finding').textContent=result.finding;
 $('toggle-case').textContent=state.kind===config.kind?config.labels[0]:config.labels[1];}
function fail(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent='探索未能运行：'+error.message+'。请刷新重试。';$('controls').disabled=true;}
function guard(fn){try{fn();}catch(error){fail(error);}}
async function openLesson(lesson,button){button.disabled=true;try{const session=await(await fetch('/api/session')).json();const response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})});const result=await response.json();$('open-status').textContent=result.message||result.error||'打开请求已发送。';}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}}
async function start(){const{current:chapter}=await mountShell('explore'),config=configs[chapter?.id];if(!config)throw Error('本章没有此探索页');
 $('chapter-label').textContent=chapter.id+' '+chapter.title;$('experiment-title').textContent=config.title;$('question').textContent=config.question;$('context').textContent=config.context;$('formula').textContent=config.formula;$('assumptions').textContent=config.assumptions;$('chart-title').textContent=config.chart;$('reading-intro').textContent=config.reading;
 for(const[key,definition]of [['first',config.first],['second',config.second]]){const[label,min,max,step,initial]=definition,input=$(key+'-range');$(key+'-label').textContent=label;Object.assign(input,{min,max,step,value:initial});state[key]=initial;input.addEventListener('input',()=>guard(()=>{state[key]=Number(input.value);draw(config);}));}
 state.kind=config.kind;$('toggle-case').addEventListener('click',()=>guard(()=>{state.kind=nextKind(chapter.id,state.kind);draw(config);}));
 $('reset').addEventListener('click',()=>guard(()=>{state.first=config.first[4];state.second=config.second[4];state.kind=config.kind;$('first-range').value=String(state.first);$('second-range').value=String(state.second);draw(config);}));
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',()=>openLesson(lesson,button));$('notebooks').append(button);}
 draw(config);$('controls').disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';}
start().catch(fail);
