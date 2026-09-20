const blue='#008bfb',pink='#ff0051',green='#00a56a';
const round=(x,n=4)=>Number(x.toFixed(n));
const line=(label,color,points,dots=false)=>({label,color,points,dots});

function feedback(x,limit){
 const requested=-.8*x-1.2*x*x*x,actual=Math.max(-limit,Math.min(limit,requested));
 return {requested,actual,rate:-.4*x+.8*x*x*x+actual};
}
export function feedbackView(limit,x0,kind='energy'){
 const actual=feedback(x0,limit),vdot=x0*actual.rate;
 if(kind==='path'){
  const path=(cap)=>{let x=x0;const rows=[[0,x]];for(let n=0;n<12;n++){x+=.02*feedback(x,cap).rate;rows.push([round((n+1)*.02,3),x]);}return rows;};
  return {series:[line('当前执行上限',pink,path(limit)),line('未触及限幅',blue,path(100))],
   stats:[['请求输入 / U/T',round(actual.requested)],['实际输入 / U/T',round(actual.actual)],['当前 V 导数 / U²/T',round(vdot)]],
   condition:`初态 ${round(x0)} U；上限 ${round(limit)} U/T；12 步、每步 0.02 T。`,
   finding:'这只是当前初值的有限 Euler 轨迹；未限幅的能量证明不能直接转给限幅执行器。'};
 }
 const xs=Array.from({length:61},(_,i)=>i/30),cap=xs.map(x=>[x,x*feedback(x,limit).rate]),free=xs.map(x=>[x,x*feedback(x,100).rate]);
 return {series:[line('实际限幅后的 V 导数',pink,cap),line('未触及限幅的 V 导数',blue,free),line('当前状态',green,[[x0,vdot]],true)],
  stats:[['请求输入 / U/T',round(actual.requested)],['实际输入 / U/T',round(actual.actual)],['当前 V 导数 / U²/T',round(vdot)]],
  condition:`状态 ${round(x0)} U；执行上限 ${round(limit)} U/T；V=x²/2。`,
  finding:vdot>0?'当前状态的能量上升，直接反驳把未限幅下降结论扩展到此条件。':'当前状态能量下降；单点结果不证明全局吸引。'};
}

const A0=[[-.4,.1],[0,-.5]],A1=[[-.8,.1],[0,-.5]];
function margin(A,p){const a=2*p*A[0][0],b=p*A[0][1]+A[1][0],d=2*A[1][1];return (a+d+Math.hypot(a-d,2*b))/2;}
export function robustView(alpha,p,kind='inside'){
 const matrix=t=>[[(1-t)*A0[0][0]+t*A1[0][0],.1],[0,-.5]];
 const rows=Array.from({length:51},(_,i)=>{const t=i/50;return [t,margin(matrix(t),p)];});
 const outside=[[.2,.1],[0,-.5]],selected=kind==='outside'?margin(outside,p):margin(matrix(alpha),p);
 return {series:[line('仿射区间内的最大导数特征值',blue,rows),line(kind==='outside'?'集合外矩阵':'当前区间参数',pink,[[kind==='outside'?1.15:alpha,selected]],true)],
  stats:[['P 最小特征值',round(Math.min(p,1))],['两顶点最大裕度',round(Math.max(margin(A0,p),margin(A1,p)))],['当前矩阵最大裕度',round(selected)]],
  condition:kind==='outside'?`P=diag(${round(p)},1)；粉点 α=1.15 仅作集合外反例，不是该仿射式的外推。`:`A(α)=(1−α)A₀+αA₁；α=${round(alpha)}；P=diag(${round(p)},1)。`,
  finding:kind==='outside'?'共同证书只覆盖已声明的凸包；外部矩阵可失稳，不能反过来推翻区间内证明。':'必须同用一个 P 且两个顶点严格负定，才能把结论覆盖到整个仿射区间。'};
}

export function adaptiveView(forget,limit,kind='estimate'){
 let x=.5,theta=.5,P=2;const xs=[[0,x]],hats=[[0,theta]],truths=[[0,.65]],inputs=[];
 for(let n=0;n<22;n++){
  const a=n<11?.65:.9,reference=1,u=Math.max(-limit,Math.min(limit,reference-theta*x));
  const next=a*x+u,gain=P*x/(forget+x*x*P);
  theta=Math.max(0,Math.min(1.2,theta+gain*((next-u)-theta*x)));
  P=(P-gain*x*P)/forget;x=next;
  xs.push([n+1,x]);hats.push([n+1,theta]);truths.push([n+1,n+1<=11?.65:.9]);inputs.push(u);
 }
 const series=kind==='state'?[line('实际状态',pink,xs),line('目标状态 1 U',blue,xs.map(([n])=>[n,1]))]:[line('在线估计',pink,hats),line('核验用真实系数',blue,truths)];
 return {series,stats:[['末步估计',round(theta)],['末步状态 / U',round(x)],['最大实际输入 / U',round(Math.max(...inputs.map(Math.abs)))]],
  condition:`第 11 步后真实系数由 0.65 变为 0.9；遗忘因子 ${round(forget,2)}；实际输入上限 ${round(limit)} U。`,
  finding:kind==='state'?'当前状态和输入受限幅、模型变化共同影响；跟踪误差不是参数辨识误差。':'控制器先用旧估计选输入，下一状态到达后才更新；蓝线真实系数仅供教学核验。'};
}

function seededNormal(seed){let value=seed>>>0;return ()=>{value=(1664525*value+1013904223)>>>0;const u=Math.max((value+.5)/4294967296,1e-12);value=(1664525*value+1013904223)>>>0;const v=(value+.5)/4294967296;return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};}
export function stochasticView(a,sigma,kind='variance',options={}){
 const count=options.count??400,requestedStep=options.h??.1,steps=Math.max(1,Math.round(2/requestedStep)),h=2/steps,rng=seededNormal(1604);
 const sums=Array(steps+1).fill(0),squares=Array(steps+1).fill(0);
 for(let path=0;path<count;path++){
  let x=1;
  for(let n=0;n<=steps;n++){
   sums[n]+=x;squares[n]+=x*x;
   if(n<steps)x=(1-a*h)*x+sigma*Math.sqrt(h)*rng();
  }
 }
 const empirical=[],analytic=[],discrete=[],q=1-a*h;
 for(let n=0;n<=steps;n++){
  const time=n*h,mean=sums[n]/count,variance=Math.max(0,squares[n]/count-mean*mean);
  const exactMean=Math.exp(-a*time),exactVar=a===0?sigma*sigma*time:sigma*sigma*(-Math.expm1(-2*a*time))/(2*a);
  const discreteMean=q**n,discreteVar=Math.abs(1-q*q)<1e-12?n*sigma*sigma*h:sigma*sigma*h*(1-q**(2*n))/(1-q*q);
  empirical.push([round(time,3),kind==='mean'?mean:variance]);
  analytic.push([round(time,3),kind==='mean'?exactMean:exactVar]);
  discrete.push([round(time,3),kind==='mean'?discreteMean:discreteVar]);
 }
 const unit=kind==='mean'?'U':'U²';
 return {series:[line('连续方程理论结果',blue,analytic),line('当前离散更新理论结果',green,discrete),line(kind==='mean'?'有限重复的样本均值':'有限重复的样本方差',pink,empirical)],
  stats:[['终点连续理论 / '+unit,round(analytic.at(-1)[1])],['终点离散理论 / '+unit,round(discrete.at(-1)[1])],['终点模拟 / '+unit,round(empirical.at(-1)[1])],['重复路径',count],['实际步长 / T',round(h,4)]],
  condition:`稳态偏差 X：dX=−${round(a)}Xdt+${round(sigma)}dW；初始偏差 +1 U；固定终点 2 T、${steps} 步、${count} 条路径。`,
  finding:'增加重复次数通常会减小抽样波动，但一次固定种子结果不保证逐次更接近理论；它不能消除离散理论与连续理论之间的步长偏差，再缩小步长检查后者。'};
}

export function consensusView(h,delay,kind='states'){
 const L=[[1,-1,0],[-1,2,-1],[0,-1,1]],history=Array.from({length:delay+1},()=>[0,4,0]);
 const rows=[history.at(-1)];for(let n=0;n<18;n++){const current=history.at(-1),past=history.at(-1-delay),next=current.map((x,i)=>x-h*L[i].reduce((sum,value,j)=>sum+value*past[j],0));history.push(next);rows.push(next);}
 const series=kind==='spread'?[line('最大与最小状态差',pink,rows.map((r,i)=>[i,Math.max(...r)-Math.min(...r)]))]:
  [line('节点0',blue,rows.map((r,i)=>[i,r[0]])),line('节点1',pink,rows.map((r,i)=>[i,r[1]])),line('节点2',green,rows.map((r,i)=>[i,r[2]]))];
 return {series,stats:[['初始均值 / U',round(4/3)],['终点总和 / U',round(rows.at(-1).reduce((s,x)=>s+x,0))],['终点最大差 / U',round(Math.max(...rows.at(-1))-Math.min(...rows.at(-1)))]],
  condition:`三节点无向路径；初态 [0,4,0] U；h=${round(h)} T；延迟 ${delay} 步；18 步。`,
  finding:delay===0?'无延迟时可用拉普拉斯谱界分析；总和守恒仍不自动说明给定步长收敛。':'延迟改变特征根。总和守恒与各节点达到一致是两件事，有限曲线不是完整稳定性证明。'};
}

export function learningView(alpha,gamma,kind='q'){
 const Q=[[0,0],[0,0]],values=[],visits=[0,0],counts=[];
 const experience=[[0,0,1,0,false],[0,1,2,1,true]];
 for(let epoch=0;epoch<=30;epoch++){
  values.push([epoch,Q[0][0],Q[0][1]]);counts.push([epoch,...visits]);
  if(epoch<30)for(const[s,act,r,next,done]of experience){const target=done?r:r+gamma*Math.max(...Q[next]);Q[s][act]+=alpha*(target-Q[s][act]);visits[act]++;}
 }
 const series=kind==='visits'?[line('动作0累计访问',blue,counts.map(r=>[r[0],r[1]])),line('动作1累计访问',pink,counts.map(r=>[r[0],r[2]]))]:
  [line('Q(状态0,动作0)',blue,values.map(r=>[r[0],r[1]])),line('Q(状态0,动作1)',pink,values.map(r=>[r[0],r[2]]))];
 return {series,stats:[['最终 Q(0,0)',round(Q[0][0])],['最终 Q(0,1)',round(Q[0][1])],['各动作访问次数',visits.join(' / ')]],
  condition:`固定两条经验重复 30 次；学习率 ${round(alpha,2)}；折扣 ${round(gamma,2)}；终止经验不再追加未来价值。`,
  finding:'这是固定有限经验表的计算示例；访问次数和训练内 Q 值不足以证明一般环境里的渐近最优性或安全性。'};
}

export function decisionView(coefficient,limit,kind='prediction'){
 const x=1.2,target=1.1,trueA=.9,actions=[-1,-.5,0,.5,1],rows=actions.map(u=>({u,pred:coefficient*x+u,actual:trueA*x+u}));
 const feasible=rows.filter(r=>Math.abs(r.u)<=limit&&r.pred>=0&&r.pred<=1.6);
 feasible.sort((a,b)=>{const ca=(a.pred-target)**2+.1*a.u*a.u,cb=(b.pred-target)**2+.1*b.u*b.u;return ca-cb||Math.abs(a.u)-Math.abs(b.u)||a.u-b.u;});
 const choice=feasible[0],shown=kind==='actual'?'actual':'pred';
 return {series:[line(shown==='actual'?'实际后继状态':'模型预测后继状态',pink,rows.map(r=>[r.u,r[shown]])),
                 line('状态允许上界',blue,actions.map(u=>[u,1.6])),...(choice?[line('预测选中动作',green,[[choice.u,choice[shown]]],true)]:[])],
  stats:[['预测可行动作',feasible.length],['选中动作 / U',choice?round(choice.u):'无可行解'],['选中动作实际状态 / U',choice?round(choice.actual):'无']],
  condition:`预测系数 ${round(coefficient)}；真实系数 0.9 仅供核验；动作上限 ${round(limit)} U；预测状态范围 [0,1.6] U。`,
  finding:choice?`当前选择在预测模型下可行；实际状态 ${round(choice.actual)} U，必须另外检查是否在 [0,1.6] U。`:'没有预测可行候选；必须保留求解失败，不可假装返回了最优动作。'};
}

export function nextKind(chapter,kind){
 const other={'16.1':['energy','path'],'16.2':['inside','outside'],'16.3':['estimate','state'],
  '16.4':['variance','mean'],'16.5':['states','spread'],'16.6':['q','visits'],'16.7':['prediction','actual']}[chapter];
 return other?.[0]===kind?other[1]:other?.[0]??kind;
}
