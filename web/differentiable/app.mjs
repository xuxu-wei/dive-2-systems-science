import {mountShell,el} from '../shared/course-shell.mjs';
import {graphView,rolloutView,odeView,pinnView,hybridView,nextKind} from './model.mjs';

const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const configs={
 '15.1':{title:"差分步长越小，参数导数一定越准吗？",question:"固定输入与网络参数，逐次缩小中心差分步长。差分与手推导数的差会一直减小吗？",context:"网络由加权输入 z=wx+b、激活 a=tanh(z) 和响应预测 va+c 组成，目标为 y。实际输入先除以参考量 1 U，得到无量纲 x；例如 2 U 对应数值2。本次只正负扰动 w，其余参数与目标固定，比较损失对 w 的导数。",formula:"x=xₚₕᵧₛ/(1 U)；z=wx+b；a=tanh(z)；L=(va+c−y)²/2",assumptions:"横轴是差分步长 h 的十进对数，纵轴是梯度绝对差的十进对数，粉色点对应当前步长。绘图把小于10⁻¹⁶的绝对差显示在−16处，指标仍给出实际绝对差。相近损失相减时，极小 h 可能放大舍入影响。",chart:"步长与参数导数核对误差",reading:"回到Notebook，按预测、误差、损失的顺序手算，再沿计算图反传四项参数导数，并用训练与验证输入比较。",first:['log₁₀ h（差分步长）',-10,-1,.5,-4],second:['实际测量量 / U',.2,1.5,.1,.7],kind:null,run:(a,b)=>graphView(a,b)},
 '15.2':{title:"每步预测接近，多步路径也接近吗？",question:"候选采用相同系数时，每步输入真实当前状态，与从初态使用自己的上一预测，会得到怎样的路径？",context:"状态 x 与本步输入量 u 以 U 记录，采样间隔固定为1 T。生成映射的状态系数为0.88，输入每步0.3 U；候选只改变状态系数 a。tanh 使用总量除以参考量1 U后的无量纲输入，修正幅度为0.04 U。",formula:"xₙ₊₁=a xₙ+0.2uₙ+(0.04 U)tanh(xₙ/(1 U))",assumptions:"两条路径从1.4 U开始。一步预测每次读取真实当前状态，自由滚动读取自己的上一状态；切换后比较的是同一候选在不同信息条件下的预测。指标排除共同初态。",chart:"相同初态下的一步预测与自由滚动",reading:"Notebook从状态配对与三系数拟合进入自由预测，再比较完整轨迹留出和两种训练目标在新初值下的结果。",first:['候选状态保留系数 a',.78,.95,.01,.85],second:['预测步数',3,25,1,16],kind:'roll',run:(a,b,k)=>rolloutView(a,b,k)},
 '15.3':{title:"连续状态导数与Euler导数怎样靠近？",question:"固定消除常数并减小Euler步长，终点状态及它对 k 的导数怎样靠近连续解析值？",context:"总量满足 x′=−kx，k 是一阶消除速率常数（1/T）。初态为2 U，终点为2 T；先比较状态，再切换到同一状态对 k 的导数。",formula:"x(t)=2 U·exp(−kt)；s(t)=∂x/∂k=−t x(t)",assumptions:"请求步长会调整到使终点对齐的实际步长。状态单位为U，参数导数单位为U·T。Euler曲线来自实际离散更新；与连续曲线的差要在固定参数及共同物理时刻比较。",chart:"连续解析结果与Euler递推",reading:"Notebook先推导两种灵敏度，再加入多时刻观测损失，逐项解释伴随跳跃、离散反向累加与状态回退。",first:['请求 Euler 步长 / T',.025,.4,.025,.2],second:['消除常数 k / (1/T)',.2,1.5,.1,.7],kind:'state',run:(a,b,k)=>odeView(a,b,k)},
 '15.4':{title:"方程残差为零，初值与边界也满足吗？",question:"将衰减率设到 Dπ² 附近，再增大线性项 s·x。方程、初始分布与两端空间导数各会怎样？",context:"x 是归一化位置。候选浓度偏差为 φ=exp(−rt)cos(πx)+s x，以1 U/V为数值单位，负值表示低于均匀背景。指定初值为余弦偏差，两端无通量，D=0.2/T。s·x的时间和二阶空间导数为零，却会同时改变初值与端点导数。",formula:"方程残差=(Dπ²−r)exp(−rt)cos(πx)；初值差=sx；两端导数=s",assumptions:"图比较0.5 T处的候选与解析剖面。方程均方、初值均方根和参考均方根采用同一组41个位置，边界项单独求两端导数平方；各项以1 U/V和1 T为参考单位。",chart:"候选与解析参考的浓度偏差剖面",reading:"Notebook先以清除候选分开数据、方程与初值损失，再逐项推导扩散时间、空间和端点导数，解释参考尺度。",first:['候选衰减率 r / (1/T)',1.4,2.6,.01,1.97],second:['线性项系数 s / (U/V)',0,.4,.01,.2],kind:null,run:(a,b)=>pinnView(a,b)},
 '15.5':{title:"总量路径相同，消除参数也相同吗？",question:"令候选与基线保持相同 k−θ，改变输入后，总量曲线与独立消除通量会分别给出什么信息？",context:"本页使用线性修正模型 x′=u−kx+θx，k 与 θ 都采用1/T。基线为 k=0.4/T、θ=0.1/T，候选两系数可调；输入率在2 T时由0.2改为0.8 U/T。",formula:"净消除系数 κ=k−θ；总量变化率 u−κx；机制消除通量 kx",assumptions:"总量方程只依赖两系数的差，相同差值与初态给出相同路径。独立通量 kx 在非零总量处提供另外的信息；切换显示后比较的是不同测量量。",chart:"总量与机制消除通量的比较",reading:"Notebook先固定机制参数学习tanh修正，再用本页的同形线性修正反例解释等价参数、独立通量与候选预测方差。",first:['候选消除常数 k / (1/T)',.3,.8,.05,.6],second:['候选线性修正 θ / (1/T)',0,.4,.05,.3],kind:'state',run:(a,b,k)=>hybridView(a,b,k)}
};
const state={first:0,second:0,kind:null};
function svg(tag,attrs={},label){const node=document.createElementNS(ns,tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,value);if(label!==undefined)node.textContent=label;return node;}
function chart(series){
 const plot=$('chart');plot.replaceChildren(svg('title',{},'当前条件下的结果比较'),svg('desc',{},'各曲线与当前取点见图例，计算条件及对应指标列在图旁。'));
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
 if(chapter==='15.3')$('toggle-case').textContent=state.kind==='state'?'切换到状态对 k 的导数':'切换回状态轨迹';
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
