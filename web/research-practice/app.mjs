import {mountShell,el} from '../shared/course-shell.mjs';
import {claimView,protocolView,ablationView,transferView,nextKind} from './model.mjs?v=m18-2';

const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const configs={
 '17.1':{title:'先数清数据行与候选列',question:'窗口延长、候选次数提高时，样本行和待估系数分别怎样增加？',context:'Lorenz 论文使用时间0—100、间隔0.001、最高五次字典。这里可调课程窗口与次数，课程间隔固定为0.01；蓝线与粉点按课程间隔计数，绿点标出论文配置。',formula:'样本行数=窗口/0.01+1；三状态、最高d次字典的列数=(d+3)(d+2)(d+1)/6。',assumptions:'窗口图横轴为归一化时间长度，纵轴为行数的log₁₀，实际行数见下方读数。切换后横轴为最高次数，纵轴为候选列数。计数帮助说明任务规模，结构恢复还要实际拟合与核对。',chart:'窗口或字典次数对应的规模',reading:'Notebook先代入Lorenz方程、展开十列字典，再用解析螺旋建立伴随学习的参考。',first:['课程窗口 / 归一化时间',1,5,.5,4],second:['多项式最高次数',2,5,1,2],kind:'samples',labels:['查看字典列数','返回采样窗口'],run:claimView},
 '17.2':{title:'删去小系数后，为什么还要重拟合？',question:'提高阈值会删去哪一项，保留项的系数与训练误差会怎样变？',context:'两项小回归使用25个等距x值，从−1到1。目标为2x+0.05x²，加上固定形状的正弦扰动；滑块只改变其幅度。先拟合x与x²，再筛选并在保留项上重拟合。',formula:'目标=2x+0.05x²+扰动；系数绝对值低于阈值时删项，再重新估计保留系数。',assumptions:'这里的两项回归用于看清筛选过程。曲线图横轴为x，纵轴为目标与拟合值；系数图的横轴1、2分别对应x、x²。',chart:'同一数据上的曲线与保留系数',reading:'Notebook把筛选用于Lorenz十列字典，再实现二维螺旋的伴随训练、梯度核对与同观测基线。',first:['系数阈值',0,.4,.02,.1],second:['固定扰动幅度',0,.5,.05,.1],kind:'fit',labels:['查看保留系数','返回拟合曲线'],run:protocolView},
 '17.3':{title:'保留项更少，参考误差也更小吗？',question:'固定阈值、改变扰动幅度，保留项数与参考函数误差是否同步变化？',context:'沿用目标2x+0.05x²与25个训练点，固定正弦扰动形状。每档幅度重新筛选与拟合，再在−1至1的41个点上与无扰动函数比较。',formula:'分别报告相对2x+0.05x²的RMSE和保留项数。',assumptions:'横轴是扰动幅度；纵轴切换为参考函数RMSE或保留项数。每次只调一个滑块，观察当前小回归中的差异。',chart:'同档扰动下的误差与项数',reading:'Notebook另比较Lorenz导数噪声与阈值，并固定螺旋观测、参数来检查积分精度；配对练习提供给定结果表。',first:['当前扰动幅度',0,.5,.1,.2],second:['系数阈值',0,.4,.02,.1],kind:'error',labels:['查看保留项数','返回无噪参考误差'],run:ablationView},
 '17.4':{title:'交换改变分配，总账怎样检查？',question:'改变交换系数后，哪一室的路径变化，总量收支是否仍相符？',context:'双室初态为[2,1]U，列表第一、第二项分别对应第一、第二室。第一室输入可调，第二室输入为零；清除系数为[0.1,0.2]/T。交换量率为e×(A₁−A₂)。',formula:'d(A₁+A₂)/dt=u₁+u₂−k₁A₁−k₂A₂；交换在两式中一减一加。',assumptions:'状态单位U，时间单位T，交换系数e的单位1/T。页面以步长0.05T同步Euler更新60步。总账曲线从初始总量3U开始，再逐步累加输入减清除。',chart:'逐室路径与整体收支对照',reading:'Notebook用前五十行精确数据恢复双室一阶系数，再解释给定配对表中的误差、质量失败和结论范围。',first:['交换系数 / (1/T)',0,.8,.05,.3],second:['室 1 输入 / U/T',0,.6,.05,.2],kind:'amounts',labels:['查看总量收支','返回各室路径'],run:transferView}
};
const state={first:0,second:0,kind:null};
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
