import {mountShell,el} from '../shared/course-shell.mjs';
import {aliasing,lifted,sparseView,structureView,nextKind} from './model.mjs';

const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const configs={
 '14.2':{title:'采样间隔会改变你看到的振荡频率吗？',question:'先预测：同一连续振荡隔很久看一次，还能唯一读出原来的频率吗？',context:'只展示带指数衰减的余弦观测。页面知道教学真值；从离散样本推频率时只取复对数主值。',formula:'y(t)=exp(−0.1t) cos(ωt)；θ=arg exp(iωΔt)',assumptions:'真实角频率仅供教学对照。完整 DMD 配对矩阵与模态推导见 Notebook；单一主值不能排除相差整圈的频率。',chart:'同一振荡的连续曲线与离散观测',reading:'Notebook 给出配对快照、模态特征值、主值转换及新初值验证。',first:['采样间隔 / T',.2,1.2,.05,.4],second:['真实角频率 / rad/T',2,6,.2,4],kind:null,run:(a,b)=>aliasing(a,b)},
 '14.3':{title:'加入一个平方观测量，会改变预测吗？',question:'先预测：当下一步 y 含 x²，只有 [x,y] 的字典会遗漏什么？',context:'教学三角映射使用 x⁺=0.8x、y⁺=0.7y+0.4x²。先直接删项，再用同一小型训练集分别拟合两项与三项字典。',formula:'[x,y,x²]⁺ = K[x,y,x²]；短字典遗漏 x²',assumptions:'“人为删项”不重拟合；“两项字典重拟合”与“三项字典重拟合”共享页面声明的8个训练状态。少放一项时，它的作用可能被剩余系数部分吸收；本例完整字典恰好闭合，不保证别的系统也如此。',chart:'留出初值下第二状态的滚动预测',reading:'Notebook 在其声明的对称训练集上另行完成短、完整 EDMD 拟合，并讨论字典失配与正则化；训练范围不同，数值系数不必与网页相同。',first:['留出初值 x / U',.1,1.8,.1,1.5],second:['预测步数',1,12,1,8],kind:'drop',run:(a,b,k)=>lifted(a,b,k)},
 '14.4':{title:'阈值越高，方程就越真实吗？',question:'先预测：把候选项不断删去，何时会连已知真项也丢失？',context:'50 个训练状态 x∈[0.1,1] U 的候选项为 [1,x,x²]，教学真导数为 1.2x−0.4x²。先按训练列二范数归一化，再做顺序阈值回归；曲线显示到训练范围之外。',formula:'d≈Θξ；支持由归一化系数阈值决定',assumptions:'导数扰动是固定的教学波形，不模拟复杂生理噪声；Notebook 另用含噪状态差分与重复随机实验检查。',chart:'候选导数曲线与已知生成方程',reading:'Notebook 给出归一化、迭代重拟合、导数噪声和独立轨迹核验。',first:['归一化系数阈值',.01,6,.01,.01],second:['导数扰动幅度 / U/T',0,.3,.01,0],kind:null,run:(a,b)=>sparseView(a,b)},
 '14.5':{title:'曲线看似合理，交换结构仍成立吗？',question:'先预测：候选矩阵列和错误或 Euler 步长过大，会分别出现什么？',context:'状态是两室物质总量。闭合矩阵与列和错误的候选矩阵只差一个转移系数；均用显式 Euler 推进。',formula:'dM/dt=1ᵀAx；一步 x⁺=(I+hA)x',assumptions:'只针对无输入、总量坐标。列和零检验连续守恒；过大时间步造成的负值属于数值更新问题。',chart:'总量与第一室总量的逐步变化',reading:'Notebook 区分守恒矩阵、非负条件、相同预算的留出预测与含噪重复。',first:['Euler 步长 / T',.05,2,.05,.2],second:['更新步数',1,12,1,8],kind:'closed',run:(a,b,k)=>structureView(k,a,b)}
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
 if(chapter==='14.3')$('toggle-case').textContent=state.kind==='drop'?'用短字典重新拟合':state.kind==='short'?'查看完整字典重拟合':'返回人为删项';
 if(chapter==='14.5')$('toggle-case').textContent=state.kind==='closed'?'切换到列和错误的候选':'切换回闭合交换';
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
