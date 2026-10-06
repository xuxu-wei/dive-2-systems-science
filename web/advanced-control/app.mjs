import {mountShell,el} from '../shared/course-shell.mjs';
import {feedbackView,robustView,adaptiveView,stochasticView,consensusView,learningView,decisionView,nextKind} from './model.mjs';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const configs={
 '16.1':{title:'输入受限时，偏差还能继续减小吗？',question:'先算当前状态的请求输入，再预测：执行器截断输入后，偏差平方会增大还是减小？',context:'x是相对参考水平的偏差，单位U。模型x′=−0.4x+0.8x³+u，请求u=−0.8x−1.2x³。实际输入被限制在正负执行上限之间；先画V=x²/2的导数，再切换到当前初值的短轨迹。',formula:'实际u=clip(−0.8x−1.2x³)；V′=x(−0.4x+0.8x³+实际u)',assumptions:'时间单位T，连续输入单位U/T。clip表示按滑块给定的正负上限截断。V的单位U²，用于衡量偏差；轨迹使用0.02 T步长更新12次。',chart:'实际限幅与未触及限幅的对照',reading:'Notebook先推导未限幅的下降条件，再手算实际输入和不同初值的变化。',first:['实际输入上限 / U/T',.2,3,.1,.5],second:['所检查状态或轨迹初值 / U',.1,1.5,.1,1.1],kind:'energy',labels:['切换到状态路径','切换回能量导数'],run:feedbackView},
 '16.2':{title:'一个P怎样覆盖两个顶点之间的模型？',question:'先预测：两个顶点的导数都严格下降，为什么同一个P可以继续用于中间的矩阵？',context:'二维偏差满足x′=A(α)x，A(α)=(1−α)A₀+αA₁，0≤α≤1。A₀=[[-0.4,0.1],[0,−0.5]]，A₁=[[-0.8,0.1],[0,−0.5]]，矩阵元素单位1/T。P=diag(p,1)表示对角元素为p和1；图中显示AᵀP+PA的最大特征值。',formula:'共同条件：P≻0，且AᵢᵀP+PAᵢ≺0；i取两个顶点',assumptions:'≻0、≺0分别表示正定、负定。粉点反例使用左上元素+0.2的另一矩阵，它不属于给定凸组合；其横坐标1.15只是显示位置。',chart:'同一个P下的导数矩阵特征值',reading:'Notebook用凸组合展开二次型，再区分候选P未通过与模型本身不稳定。',first:['两个顶点之间的权重 α',0,1,.05,.5],second:['P的第一项对角元素 p',.2,3,.1,1],kind:'inside',labels:['查看集合外反例','返回模型集合'],run:robustView},
 '16.3':{title:'观测到变化后，估计怎样进入下一次决策？',question:'先预测：减少旧数据的权重或收紧输入上限，会怎样改变参数估计和状态误差？',context:'离散状态满足x⁺=ax+u，x和u单位U。目标r=1 U、初态0.5 U、初始估计â=0.5。先用旧估计选择实际输入，新状态到达后以y=x⁺−u、φ=x更新递推估计。完成11次更新后，生成系数从0.65变为0.9。',formula:'u=clip(r−âx)；观测x⁺后，用y=x⁺−u更新â',assumptions:'clip按实际输入上限截断。参数投影到[0,1.2]，信息尺度初值P=2/U²；蓝线真实系数只用于核对。遗忘因子越小，旧数据权重衰减越快。',chart:'参数估计与状态跟踪',reading:'Notebook展开递推第一步、零输入反例和先决策后更新的时间顺序。',first:['旧数据的遗忘因子 λ',.8,1,.01,.95],second:['每次实际输入上限 / U',.1,1,.05,.4],kind:'estimate',labels:['查看状态跟踪','返回参数估计'],run:adaptiveView},
 '16.4':{title:'增加重复数和减小步长，各改变什么？',question:'先预测：固定步长增加路径数后，模拟统计靠近连续理论，还是离散规则的理论？',context:'X是相对参考水平的偏差，可正可负。每次从+1 U出发，到2 T结束；Z为独立标准正态数。蓝线为连续方程的理论矩，绿线为当前离散更新的理论矩，粉线为有限路径的统计。',formula:'dX=−aXdt+σdW；离散：X⁺=(1−ah)X+σ√h Z',assumptions:'h为每步时间长度，a单位1/T、σ单位U/√T。方差显示各路径偏差平方的平均（除以路径数R）；Notebook的样本方差另用R−1。a=0时连续方差为σ²t。实际步长由固定终点与整数步数对齐。',chart:'连续理论、离散理论与有限重复统计',reading:'Notebook先解释布朗增量和粗细路径配对，再展开随机矩与阈值事件频率。',first:['恢复率 a / (1/T)',0,1.2,.05,.6],second:['噪声幅度 σ / (U/√T)',.1,1,.05,.4],kind:'variance',labels:['切换到均值','切换回方差'],run:stochasticView},
 '16.5':{title:'总和不变时，节点差也会趋于零吗？',question:'先手算一轮，再预测：相同路径图加入延迟或增加步长后，节点差会怎样变化？',context:'节点0—1—2双向连接，各连接权重1/T。初态按节点顺序为[0,4,0] U。图拉普拉斯矩阵L=[[1,−1,0],[−1,2,−1],[0,−1,1]]；每轮一起读取过去的节点差，再统一更新当前状态。',formula:'xₙ₊₁=xₙ−hLxₙ₋d；d为延迟的步数',assumptions:'给定x₋d至x₀的每一行均为[0,4,0] U，运行18次更新。此处延迟整组过去差值。无延迟谱界不能直接用于带延迟的规则。',chart:'各节点状态或最大节点差',reading:'Notebook分别推导总和、无延迟收敛条件与一拍延迟特征根，并给出两步手算。',first:['每轮时间长度 h / T',.05,.7,.01,.4],second:['读取差值的延迟 / 步',0,3,1,1],kind:'states',labels:['查看节点差距','返回节点轨迹'],run:consensusView},
 '16.6':{title:'固定经验怎样改变Q值？',question:'先算一次终止更新，再比较：反复读同两条经验，访问数和Q值分别告诉了什么？',context:'每轮按次序使用[0,0,1,0,False]、[0,1,2,1,True]，五项为当前状态、动作、奖励、下一状态和终止标记；重复30轮。状态1终止，Q初值均为0。此网页经验与Notebook的三条经验不同。',formula:'Q(s,a)←Q(s,a)+α[r+γ(1−d)max Q(s′,·)−Q(s,a)]',assumptions:'α为学习率、γ为折扣；d=1表示终止，此时目标只含本步奖励r。两个状态0动作都被访问，状态1的动作未被训练；Q曲线来自这张固定经验表。',chart:'Q值与动作访问数',reading:'Notebook先算已知模型的固定策略价值，再逐条解释Q更新和独立评价需要的输入。',first:['单次更新学习率 α',.05,1,.05,.4],second:['未来奖励的折扣 γ',0,.95,.05,.8],kind:'q',labels:['查看动作访问数','返回 Q 值'],run:learningView},
 '16.7':{title:'怎样核对预测选中的动作？',question:'先列出通过预测筛选的动作，再核对：它们的实际后继状态是多少？',context:'当前x=1.2 U、目标r=1.1 U，候选动作依次为[−1,−0.5,0,0.5,1] U。按输入上限和预测状态[0,1.6] U筛选，再最小化预测偏差平方加0.1倍输入平方。真实系数0.9仅用于实际结果核验。',formula:'x̂⁺=âx+u；成本=(x̂⁺−1.1)²+0.1u²；实际x⁺=0.9x+u',assumptions:'â由滑块给定；曲线包含所有候选，绿点只标出被选中的可行动作。无可行候选时返回失败。预测可行是否带来实际可行，需另检查实际状态。',chart:'所有候选与选中动作的后继状态',reading:'Notebook展开动作成本表、范围外的失配反例与不可行情况，再分开计算四项评价指标。',first:['用于选择动作的预测系数 â',.4,1.4,.05,1],second:['允许输入的绝对值上限 / U',0,1,.1,.5],kind:'prediction',labels:['查看实际状态','返回预测状态'],run:decisionView}
};
const state={first:0,second:0,kind:null,extra:{count:400,h:.1}};
function svg(tag,attrs={},label){const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);if(label!==undefined)node.textContent=label;return node;}
function chart(series){
 const plot=$('chart');plot.replaceChildren(svg('title',{},'教学模型条件对照'),svg('desc',{},'不同颜色对应图例中的模型或条件，圆点为当前选择。'));
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
function draw(config){const result=config.run(state.first,state.second,state.kind,state.extra);chart(result.series);
 $('numbers').replaceChildren(...result.stats.map(([label,value])=>{const box=el('div');box.append(el('span',label),el('strong',String(value)));return box;}));
 $('first-value').textContent=String(Number(state.first.toFixed(2)));$('second-value').textContent=String(Number(state.second.toFixed(2)));
 if(!$('stochastic-controls').hidden){$('repeat-value').textContent=String(state.extra.count);$('step-value').textContent=String(state.extra.h);}
 $('current-condition').textContent=result.condition;$('finding').textContent=result.finding;
 $('toggle-case').textContent=state.kind===config.kind?config.labels[0]:config.labels[1];}
function fail(error){$('loading-note').hidden=false;$('loading-note').classList.add('error');$('loading-note').textContent='探索未能运行：'+error.message+'。请刷新重试。';$('controls').disabled=true;}
function guard(fn){try{fn();}catch(error){fail(error);}}
async function openLesson(lesson,button){button.disabled=true;try{const session=await(await fetch('/api/session')).json();const response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id:lesson.id})});const result=await response.json();$('open-status').textContent=result.message||result.error||'打开请求已发送。';}catch{$('open-status').textContent='本机连接中断，请恢复后重试。';}finally{button.disabled=false;}}
async function start(){const{current:chapter}=await mountShell('explore'),config=configs[chapter?.id];if(!config)throw Error('本章没有此探索页');
 $('chapter-label').textContent=chapter.id+' '+chapter.title;$('experiment-title').textContent=config.title;$('question').textContent=config.question;$('context').textContent=config.context;$('formula').textContent=config.formula;$('assumptions').textContent=config.assumptions;$('chart-title').textContent=config.chart;$('reading-intro').textContent=config.reading;
 for(const[key,definition]of [['first',config.first],['second',config.second]]){const[label,min,max,step,initial]=definition,input=$(key+'-range');$(key+'-label').textContent=label;Object.assign(input,{min,max,step,value:initial});state[key]=initial;input.addEventListener('input',()=>guard(()=>{state[key]=Number(input.value);draw(config);}));}
 if(chapter.id==='16.4'){$('stochastic-controls').hidden=false;
  $('repeat-range').addEventListener('input',()=>guard(()=>{state.extra.count=Number($('repeat-range').value);draw(config);}));
  $('step-range').addEventListener('input',()=>guard(()=>{state.extra.h=Number($('step-range').value);draw(config);}));}
 state.kind=config.kind;$('toggle-case').addEventListener('click',()=>guard(()=>{state.kind=nextKind(chapter.id,state.kind);draw(config);}));
 $('reset').addEventListener('click',()=>guard(()=>{state.first=config.first[4];state.second=config.second[4];state.kind=config.kind;state.extra={count:400,h:.1};$('first-range').value=String(state.first);$('second-range').value=String(state.second);$('repeat-range').value='400';$('step-range').value='0.1';draw(config);}));
 for(const lesson of chapter.lessons){const button=el('button','在默认 IDE 打开：'+lesson.title);button.type='button';button.addEventListener('click',()=>openLesson(lesson,button));$('notebooks').append(button);}
 draw(config);$('controls').disabled=false;document.querySelector('.exploration').hidden=false;$('loading-note').hidden=true;document.body.dataset.ready='true';}
start().catch(fail);
