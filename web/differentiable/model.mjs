const round=(value,digits=4)=>Number(value.toFixed(digits));
const blue='#008bfb',pink='#ff0051';

export function graphView(exponent,x){
 const w=1.1,b=.2,v=.9,c=-.1,y=.4;
 const loss=weight=>{const prediction=v*Math.tanh(weight*x+b)+c;return .5*(prediction-y)**2;};
 const z=w*x+b,a=Math.tanh(z),error=v*a+c-y;
 const analytic=error*v*(1-a*a)*x;
 const rows=[];
 for(let e=-11;e<=-1;e+=.25){
  const h=10**e,difference=(loss(w+h)-loss(w-h))/(2*h);
  rows.push([round(e,2),Math.log10(Math.max(Math.abs(difference-analytic),1e-16))]);
 }
 const h=10**exponent,numeric=(loss(w+h)-loss(w-h))/(2*h),absolute=Math.abs(numeric-analytic);
 return {
  series:[{label:'梯度绝对差的十进对数',color:blue,points:rows},
          {label:'当前步长',color:pink,points:[[exponent,Math.log10(Math.max(absolute,1e-16))]],dots:true}],
  stats:[['手推的损失对 w 导数',round(analytic,6)],['差分的损失对 w 导数',round(numeric,6)],['绝对差',absolute.toExponential(2)]],
  condition:'实际输入 '+round(x)+' U 除以参考量 1 U 后，网络收到无量纲数值 x='+round(x)+'；中心差分步长 10^'+round(exponent,1)+'；其余权重与目标固定。',
  finding:'先看步长缩小时差分误差是否下降，再看极小步长处的舍入影响。这个比较核对当前损失对 w 的局部导数，预测与机制仍需另外的证据。'
 };
}

function step(x,u,a){return a*x+.2*u+.04*Math.tanh(x);}
export function rolloutView(a,steps,kind){
 let actual=1.4,pred=1.4;
 const truth=[[0,actual]],candidate=[[0,pred]];
 for(let n=0;n<steps;n++){
  const next=step(actual,.3,.88);
  pred=kind==='one'?step(actual,.3,a):step(pred,.3,a);
  actual=next;truth.push([n+1,actual]);candidate.push([n+1,pred]);
 }
 const mse=truth.slice(1).reduce((sum,row,i)=>sum+(row[1]-candidate[i+1][1])**2,0)/steps;
 return {
  series:[{label:'已知生成映射',color:blue,points:truth},
          {label:kind==='one'?'每步使用真实当前状态':'从初态自由滚动',color:pink,points:candidate}],
  stats:[['后续步 MSE / U²',round(mse,6)],['终点绝对差 / U',round(Math.abs(actual-pred),6)],['候选 a',round(a,3)]],
  condition:'输入每步 0.3 U；初态 1.4 U；tanh 的状态输入先除以参考量 1 U；'+steps+' 步；当前为'+(kind==='one'?'一步预测':'自由滚动')+'。',
  finding:kind==='one'?'每步从真实状态重新出发，使此前偏差被重置；这条曲线评估一步映射在真实路径附近的表现。':'每步使用自己的上一状态，当前偏差会通过状态依赖传入后续预测；结合均方与终点误差看这条自由路径。'
 };
}

export function odeView(requestedStep,k,kind){
 const T=2,x0=2,N=Math.max(1,Math.round(T/requestedStep)),h=T/N;
 let state=x0,sensitivity=0;
 const truth=[],euler=[];
 for(let n=0;n<=N;n++){
  const t=n*h,continuous=x0*Math.exp(-k*t);
  truth.push([round(t,6),kind==='state'?continuous:-t*continuous]);
  euler.push([round(t,6),kind==='state'?state:sensitivity]);
  const nextSensitivity=(1-k*h)*sensitivity-h*state;
  state=(1-k*h)*state;sensitivity=nextSensitivity;
 }
 const gap=Math.abs(truth.at(-1)[1]-euler.at(-1)[1]);
 return {
  series:[{label:kind==='state'?'连续解析状态':'连续状态对 k 的导数',color:blue,points:truth},
          {label:kind==='state'?'Euler 状态':'Euler 状态对 k 的导数',color:pink,points:euler}],
  stats:[['实际步长 / T',round(h,5)],['终点绝对差',round(gap,6)],['网格步数',N]],
  condition:'一阶消除常数 k='+round(k)+'/T；固定终点 2 T；请求步长 '+round(requestedStep)+' T，实际采用 '+round(h,5)+' T 使终点对齐。',
  finding:kind==='state'?'固定参数时，细化网格使本例Euler状态靠近连续解。改变模型参数再比较，还会混入模型本身的变化。':'粉色曲线对每次Euler更新求导，蓝色曲线对连续解析状态求导；有限步长下的差异随前向状态的离散近似而来。'
 };
}

export function pinnView(rate,slope){
 const D=.2,exactRate=D*Math.PI**2,t=.5;
 const reference=[],candidate=[];
 let residual=0,solutionError=0,initialError=0;
 for(let i=0;i<=40;i++){
  const x=i/40,cos=Math.cos(Math.PI*x);
  const expected=Math.exp(-exactRate*t)*cos;
  const trial=Math.exp(-rate*t)*cos+slope*x;
  reference.push([x,expected]);candidate.push([x,trial]);
  const r=(D*Math.PI**2-rate)*Math.exp(-rate*t)*cos;
  residual+=r*r;solutionError+=(trial-expected)**2;initialError+=(slope*x)**2;
 }
 return {
  series:[{label:'满足初值与无通量条件的解析剖面',color:blue,points:reference},
          {label:'当前候选函数',color:pink,points:candidate}],
  stats:[['方程残差均方 / (U/V/T)²',round(residual/41,6)],['端点导数平方均值 / (U/V)²',round(slope*slope,6)],['初值均方根偏差 / (U/V)',round(Math.sqrt(initialError/41),6)],['参考剖面均方根误差 / (U/V)',round(Math.sqrt(solutionError/41),6)]],
  condition:'归一化位置 x∈[0,1]；观察时间 0.5 T；D=0.2/T；候选衰减率 '+round(rate)+'/T，线性项系数 '+round(slope)+'。',
  finding:Math.abs(rate-exactRate)<.02&&slope>.001?'衰减率接近Dπ²使方程残差很小，但s·x留下初值差sx与端点导数s；用这两项检查能发现方程项看不见的变化。':'方程检查变化率关系，初值检查起始剖面，端点检查无通量条件，参考误差比较当前函数值；先分别解释四项，再看它们怎样随候选改变。'
 };
}

function confoundedPath(k,theta){
 let x=1.;const values=[[0,x]],flux=[[0,k*x]];
 for(let n=0;n<80;n++){
  const u=n<40 ? 0.2 : 0.8;
  x+=.05*(u-(k-theta)*x);
  values.push([round((n+1)*.05,3),x]);flux.push([round((n+1)*.05,3),k*x]);
 }
 return {values,flux};
}
export function hybridView(k,theta,kind){
 const baseline=confoundedPath(.4,.1),candidate=confoundedPath(k,theta);
 const view=kind==='flux'?'flux':'values';
 const gap=Math.abs(baseline.values.at(-1)[1]-candidate.values.at(-1)[1]);
 return {
  series:[{label:view==='flux'?'基线清除通量':'基线总量',color:blue,points:baseline[view]},
          {label:view==='flux'?'候选清除通量':'候选总量',color:pink,points:candidate[view]}],
  stats:[['净消除系数 / (1/T)',round(k-theta,3)],['终点总量差 / U',round(gap,6)],['初始通量差 / U/T',round(Math.abs(k-.4),3)]],
  condition:'基线 k=0.4/T、θ=0.1/T；候选 k='+round(k,2)+'/T、θ='+round(theta,2)+'/T；输入在 2 T 时变化。',
  finding:Math.abs(k-theta-.3)<1e-9?'两组参数的净系数相同，因此任何同一已知输入下总量路径都相同。在非零总量处，独立机制消除通量可以进一步区分两个参数。':'当前候选改变了净系数k−θ，所以总量路径分开；这类总量信息仍只确定参数差值，需要另一种测量才能分开两系数。'
 };
}

export function nextKind(chapter,kind){
 if(chapter==='15.2')return kind==='one'?'roll':'one';
 if(chapter==='15.3')return kind==='state'?'gradient':'state';
 if(chapter==='15.5')return kind==='state'?'flux':'state';
 return kind;
}
