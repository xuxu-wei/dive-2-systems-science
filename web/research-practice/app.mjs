import {mountShell,el} from '../shared/course-shell.mjs';
import {claimView,protocolView,ablationView,transferView,nextKind} from './model.mjs?v=m18-2';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const configs={
 '17.1':{title:'相似轨迹等于复现原论文了吗？',question:'先预测：缩短轨迹和缩小候选字典后，哪一项主张仍能由实验核验？',context:'R18 原文 Lorenz 窗口为 100 个归一化时间单位、步长 0.001，并考虑至五次多项式。课程拟合使用前 4 单位、步长 0.01 和二次字典；图展示任务规模差别。',formula:'候选项数 = C(3+d,d)；课程采样点数 = 窗口/0.01 + 1',assumptions:'图只比较实验规模，不绘制原论文的实际性能；R19 的潜变量编码器与大量带噪轨迹也不由网页重训。',chart:'课程与原始任务的条件边界',reading:'Notebook 分别锁定两篇原论文版本、主张、原始任务与课程缩减条件。',first:['课程窗口 / 归一化时间',1,5,.5,4],second:['多项式最高次数',2,5,1,2],kind:'samples',labels:['查看字典列数','返回采样窗口'],run:claimView},
 '17.2':{title:'低训练残差就是方程发现吗？',question:'先预测：改变阈值后，拟合曲线和保留项会怎样变化？',context:'网页使用可手算的两项回归作为顺序阈值教学替身。完整 Lorenz 方程恢复和连续伴随梯度在 Notebook 中运行，并与独立参考核对。',formula:'先最小二乘 → 小系数置零 → 保留项重拟合',assumptions:'此网页不是两篇论文的性能结果；训练、测试和梯度核验以 Notebook 的固定协议为准。',chart:'同一小回归的拟合与支持项',reading:'Notebook 给出 Lorenz 稀疏系数、独立初态轨迹与二维连续伴随的有限差分核验。',first:['系数阈值',0,.4,.02,.1],second:['导数噪声代理',0,.5,.05,.1],kind:'fit',labels:['查看保留系数','返回拟合曲线'],run:protocolView},
 '17.3':{title:'失效是否应留在结果表中？',question:'先预测：导数噪声变大，保留项数与无噪参考函数误差一定同时变好吗？',context:'固定小回归的输入和噪声序列，只改变预先声明的噪声强度或稀疏阈值。Notebook 运行课程 Lorenz 噪声/阈值对照，以及固定神经动力学候选的步长与结构对照；后者没有重训模型。',formula:'无噪参考误差与支持项数分别报告；失败场景不删除',assumptions:'这里只是网页教学替身，不能称作原文 Lorenz 或 Neural ODE 的消融结果。',chart:'噪声与结构判定的边界',reading:'Notebook 运行已声明的课程缩减实验；固定配对结果表的统计练习单独提供，原论文全配置留作扩展。',first:['当前噪声强度',0,.5,.1,.2],second:['系数阈值',0,.4,.02,.1],kind:'error',labels:['查看保留项数','返回无噪参考误差'],run:ablationView},
 '17.4':{title:'预测好还需要检查总量收支吗？',question:'先预测：改变双室交换强度，会改变两室总量的收支等式吗？',context:'人工双室清除模型作为生命系统课程迁移。室间交换改变各室路径，但在两个室相加后应抵消。',formula:'d(A₁+A₂)/dt = u₁+u₂−k₁A₁−k₂A₂',assumptions:'状态 U，时间 T；交换系数与一阶消除系数均为 1/T。图中仅为显式 Euler 的共同人工模型，不代表临床有效性。',chart:'各室状态与总量收支',reading:'Notebook 对同一观测和独立条件比较机制与数据模型，报告误差、收支和失败。',first:['室间交换率 /T',0,.8,.05,.3],second:['室 1 输入 / U/T',0,.6,.05,.2],kind:'amounts',labels:['查看总量收支','返回各室路径'],run:transferView}
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
