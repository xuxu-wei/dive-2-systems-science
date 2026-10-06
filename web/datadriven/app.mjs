import {mountShell,el} from '../shared/course-shell.mjs';
import {aliasing,lifted,sparseView,structureView,nextKind} from './model.mjs';

const $=id=>document.getElementById(id);
const ns='http://www.w3.org/2000/svg';
const configs={
 '14.2':{title:"隔多久看一次，会怎样改变频率判断？",question:"先比较两次观测之间的转角。如果期间多转一整圈，采样点能否把它区分出来？",context:"给定y(t)=exp(−0.1t)cos(ωt)，蓝线按真实ω生成，绿点按当前间隔采样。页面由已知ω计算每步转角并取主值，粉线使用这一主值频率；横轴为时间T，纵轴为观测值。",formula:"θ=atan2(sin(ωΔt),cos(ωΔt))；ω₀=θ/Δt；ωℓ=(θ+2πℓ)/Δt。",assumptions:"固定衰减率0.1/T，显示0至6 T。改变Δt时，采样时刻也改变。真实ω是教学参照；相差整圈的转角产生同一离散乘子，主值只选出其中一个时间频率。",chart:"真实频率、采样点与主值频率",reading:"回到Notebook，先配对完整状态，再拟合DMD矩阵，逐项解释其特征值与新初值预测。",first:['采样间隔 / T',.2,1.2,.05,.4],second:['真实角频率 / rad/T',2,6,.2,4],kind:null,run:(a,b)=>aliasing(a,b)},
 '14.3':{title:"少一项函数，剩下的系数会怎样变化？",question:"y的更新含0.4x²。先删掉这一作用，再在短字典上重新回归，比较两种计算给出的y系数。",context:"规则为x⁺=0.8x、y⁺=0.7y+0.4x²，上标⁺表示下一步。字典按[x,y]或[x,y,x²]排序；同一状态代入这些函数，得到特征列。图中横轴为更新步数，纵轴为y/U。",formula:"z=[x,y,x²]ᵀ；z⁺=Kz；三行分别来自0.8x、0.7y+0.4x²和0.64x²。",assumptions:"训练取x=0.2、0.5、0.8、1 U，各配y=−0.2、0.2 U，共8个一步配对。“人为删项”直接去掉平方作用；两种“重拟合”各在自己的特征表回归。初值y固定0.1 U，只改变所显示的x与预测步数。",chart:"三种表示下的第二状态预测",reading:"Notebook逐行推导闭合矩阵，并用另一组对称训练状态比较字典与岭正则；网页训练x均为正值，所以遗漏项会部分进入剩余系数。",first:['留出初值 x / U',.1,1.8,.1,1.5],second:['预测步数',1,12,1,8],kind:'drop',run:(a,b,k)=>lifted(a,b,k)},
 '14.4':{title:"阈值删掉了哪些函数，又怎样改变导数？",question:"按[1,x,x²]检查三项系数。先固定扰动幅度，再提高阈值，观察什么时候删除了已知增长作用。",context:"50个训练状态均匀分布在[0.1,1] U，候选表每行一个状态、每列一个函数。目标导数为1.2x−0.4x²，列按各自二范数归一化后回归，再按系数阈值筛选和重新拟合。",formula:"d≈Θξ；归一化系数绝对值≥阈值时保留，最后换回原列尺度。",assumptions:"第i个导数加上幅度×sin(1+7i)，i从0编号。改变幅度时保留同一波形；单位U/T。横轴为x/U，导数曲线显示0至2.5 U，包含训练范围外的状态。",chart:"生成导数与候选导数曲线",reading:"Notebook的无噪阈值实验训练到2.5 U，四个给定阈值保留相同两项。随后另用等距含噪轨迹解释差分误差、重复系数和独立初值预测。",first:['归一化系数阈值',.01,6,.01,.01],second:['导数扰动幅度 / U/T',0,.3,.01,0],kind:null,run:(a,b)=>sparseView(a,b)},
 '14.5':{title:"总量不变，各室就一定合理吗？",question:"先算两室的第一步，再检查总量。改变交换矩阵和Euler时间步，分别观察收支错误与负值。",context:"状态为两室总量/U，初值[2,0] U。原矩阵为[[-1,0.2],[1,−0.2]]/T；另一候选只把第一行第二列改为0.3，第二列合计多出0.1/T。",formula:"M=x₁+x₂；dM/dt=1ᵀAx；Euler一步x⁺=(I+hA)x。",assumptions:"没有系统外的物质进出。蓝线为两室合计，粉线为第一室；横轴是更新步数k，对应时间kh。列和为零使总量保持；I+hA还需各元素非负，才能保证任意非负初态的一步结果。",chart:"逐步总量与第一室的值",reading:"Notebook从逐室作用推导列和、非对角项及时间步条件，再按共同数据比较多种方法的独立预测、总量差与负值数。",first:['Euler 步长 / T',.05,2,.05,.2],second:['更新步数',1,12,1,8],kind:'closed',run:(a,b,k)=>structureView(k,a,b)}
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
