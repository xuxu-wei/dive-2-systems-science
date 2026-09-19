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
  series:[{label:'中心差分绝对误差的 log10',color:blue,points:rows},
          {label:'当前步长',color:pink,points:[[exponent,Math.log10(Math.max(absolute,1e-16))]],dots:true}],
  stats:[['解析 w 梯度',round(analytic,6)],['中心差分梯度',round(numeric,6)],['绝对差',absolute.toExponential(2)]],
  condition:'输入 x='+round(x)+' U，中心差分步长 10^'+round(exponent,1)+'；其余权重与目标固定。',
  finding:'中等差分步长常较可靠；极小步长会受浮点抵消影响。这里核验的是当前计算图的梯度，并非模型的机制正确性。'
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
          {label:kind==='one'?'每步用真实旧状态':'从初态自由滚动',color:pink,points:candidate}],
  stats:[['后续步 MSE / U²',round(mse,6)],['终点绝对差 / U',round(Math.abs(actual-pred),6)],['候选 a',round(a,3)]],
  condition:'输入每步 0.3 U；初态 1.4 U；'+steps+' 步；当前为'+(kind==='one'?'一步预测':'自由滚动')+'。',
  finding:kind==='one'?'当前候选每步获得真实旧状态，不能以这条曲线证明自主长时预测。':'当前候选只用自己的上一状态；局部映射差异会在后续步积累。'
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
  series:[{label:kind==='state'?'连续解析状态':'连续解析梯度',color:blue,points:truth},
          {label:kind==='state'?'Euler 状态':'Euler 程序梯度',color:pink,points:euler}],
  stats:[['实际步长 / T',round(h,5)],['终点绝对差',round(gap,6)],['网格步数',N]],
  condition:'清除率 '+round(k)+'/T；固定终点 2 T；请求步长 '+round(requestedStep)+' T，实际采用 '+round(h,5)+' T 使终点对齐。',
  finding:kind==='state'?'细化网格可检查求解器状态误差；它与模型失配不是同一种误差。':'自动微分穿过 Euler 得到离散程序梯度；有限步长下不必与连续解析梯度完全相同。'
 };
}

export function pinnView(rate,slope){
 const D=.2,exactRate=D*Math.PI**2,t=.5;
 const reference=[],candidate=[];
 let residual=0,solutionError=0;
 for(let i=0;i<=40;i++){
  const x=i/40,cos=Math.cos(Math.PI*x);
  const expected=Math.exp(-exactRate*t)*cos;
  const trial=Math.exp(-rate*t)*cos+slope*x;
  reference.push([x,expected]);candidate.push([x,trial]);
  const r=(D*Math.PI**2-rate)*Math.exp(-rate*t)*cos;
  residual+=r*r;solutionError+=(trial-expected)**2;
 }
 return {
  series:[{label:'满足方程与零通量的解析模态',color:blue,points:reference},
          {label:'当前候选函数',color:pink,points:candidate}],
  stats:[['内部残差均方',round(residual/41,6)],['边界导数平方',round(slope*slope,6)],['独立网格 RMSE',round(Math.sqrt(solutionError/41),6)]],
  condition:'归一化位置 x∈[0,1]；观察时间 0.5 T；D=0.2/T；候选衰减率 '+round(rate)+'/T，边界斜率 '+round(slope)+'。',
  finding:Math.abs(rate-exactRate)<.02&&slope>.001?'内部方程几乎满足，但端点导数不为零；不能把它当作所声明无通量问题的解。':'同时看内部残差、边界条件和独立位置误差；单一损失分项不能代替另外两项。'
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
  stats:[['有效清除率 /T',round(k-theta,3)],['终点总量差 / U',round(gap,6)],['初始通量差 / U/T',round(Math.abs(k-.4),3)]],
  condition:'基线 k=0.4/T、θ=0.1/T；候选 k='+round(k,2)+'/T、θ='+round(theta,2)+'/T；输入在 2 T 时变化。',
  finding:Math.abs(k-theta-.3)<1e-9?'两组总量轨迹在任何已知输入下都相同；独立清除通量测量才可拆分这两个同形参数。':'总量差主要由有效率 k−θ 改变；仅凭总量轨迹仍不能分别给 k 与 θ 唯一机制身份。'
 };
}

export function nextKind(chapter,kind){
 if(chapter==='15.2')return kind==='one'?'roll':'one';
 if(chapter==='15.3')return kind==='state'?'gradient':'state';
 if(chapter==='15.5')return kind==='state'?'flux':'state';
 return kind;
}
