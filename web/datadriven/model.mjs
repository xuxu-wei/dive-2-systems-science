const round=(value,digits=3)=>Number(value.toFixed(digits));
const norm=(vector)=>Math.hypot(...vector);

export function aliasing(dt,omega){
 const angle=omega*dt,principal=Math.atan2(Math.sin(angle),Math.cos(angle))/dt;
 const trueCurve=[],inferred=[],samples=[];
 for(let t=0;t<=6.00001;t+=.04){trueCurve.push([round(t,4),Math.exp(-.1*t)*Math.cos(omega*t)]);inferred.push([round(t,4),Math.exp(-.1*t)*Math.cos(principal*t)]);}
 for(let k=0;k*dt<=6.00001;k++){const t=k*dt;samples.push([round(t,4),Math.exp(-.1*t)*Math.cos(omega*t)]);}
 return {series:[{label:'给定真实频率',color:'#008bfb',points:trueCurve},{label:'主值推断频率',color:'#ff0051',points:inferred},{label:'采样观测',color:'#00a56a',points:samples,dots:true}],
  stats:[['真实角频率 / rad/T',round(omega)],['主值推断 / rad/T',round(principal)],['采样间隔 / T',round(dt)]],
  finding:Math.abs(principal-omega)<1e-8?'此采样间隔下，主值角频率与页面设定的真实频率相同；仍需说明频率范围先验。':'离散样本容许整圈混叠；主值频率与页面设定的真实频率不同。',
  condition:`固定衰减率 0.1/T；采样间隔 ${round(dt)} T；真实角频率 ${round(omega)} rad/T。`};
}

export function lifted(initialX,steps,kind){
 const a=.8,b=.7,c=.4,initialY=.1;
 let x=initialX,y=initialY,approxX=initialX,approxY=initialY,extra=initialX*initialX;
 const exact=[],prediction=[];
 for(let k=0;k<=steps;k++){
  exact.push([k,y]);prediction.push([k,approxY]);
  const nextX=a*x,nextY=b*y+c*x*x;x=nextX;y=nextY;
  const nextApproxX=a*approxX;
  const nextApproxY=b*approxY+(kind==='full'?c*extra:0);
  extra=a*a*extra;approxX=nextApproxX;approxY=nextApproxY;
 }
 return {series:[{label:'真实 y',color:'#008bfb',points:exact},{label:kind==='full'?'三项闭合字典':'两项短字典',color:'#ff0051',points:prediction}],
  stats:[['最终真实 y / U',round(exact.at(-1)[1])],['最终预测 y / U',round(prediction.at(-1)[1])],['末步绝对误差 / U',round(Math.abs(exact.at(-1)[1]-prediction.at(-1)[1]))]],
  finding:kind==='full'?'在这个专门构造的三角映射中，[x,y,x²] 恰好闭合，留出轨迹可精确重建。':'短字典遗漏 x²；训练数据范围内的线性拟合不能保证此新初值的 y 预测。',
  condition:`初值 x=${round(initialX)} U、y=0.1 U；${kind==='full'?'三项闭合字典':'两项短字典'}；观察 ${steps} 步。`};
}

function solve(matrix,right){
 const n=right.length,aug=matrix.map((row,i)=>[...row,right[i]]);
 for(let col=0;col<n;col++){
  let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(aug[row][col])>Math.abs(aug[pivot][col]))pivot=row;
  if(Math.abs(aug[pivot][col])<1e-12)throw Error('训练字典在当前条件下不可逆');
  [aug[pivot],aug[col]]=[aug[col],aug[pivot]];
  const scale=aug[col][col];for(let j=col;j<=n;j++)aug[col][j]/=scale;
  for(let row=0;row<n;row++)if(row!==col){const factor=aug[row][col];for(let j=col;j<=n;j++)aug[row][j]-=factor*aug[col][j];}
 }
 return aug.map(row=>row[n]);
}

export function sparseFit(threshold,noise){
 const xs=Array.from({length:50},(_,i)=>.1+(.9*i/49));
 const theta=xs.map(x=>[1,x,x*x]);
 const data=xs.map((x,i)=>1.2*x-.4*x*x+noise*Math.sin(1+7*i));
 const scales=[0,1,2].map(j=>Math.hypot(...theta.map(row=>row[j])));
 const columns=theta.map(row=>row.map((value,j)=>value/scales[j]));
 let active=[0,1,2],coefficient=[0,0,0];
 for(let iteration=0;iteration<9;iteration++){
  if(!active.length)break;
  const gram=active.map(j=>active.map(k=>columns.reduce((sum,row)=>sum+row[j]*row[k],0)));
  const rhs=active.map(j=>columns.reduce((sum,row,i)=>sum+row[j]*data[i],0));
  const fit=solve(gram,rhs);coefficient=[0,0,0];active.forEach((j,i)=>coefficient[j]=fit[i]);
  const next=active.filter(j=>Math.abs(coefficient[j])>=threshold);
  if(next.join(',')===active.join(','))break;
  active=next;
 }
 coefficient=coefficient.map((value,j)=>active.includes(j)?value/scales[j]:0);
 return {coefficient,active};
}

export function sparseView(threshold,noise){
 const {coefficient,active}=sparseFit(threshold,noise),actual=[],predicted=[];
 for(let x=0;x<=2.5+1e-8;x+=.05){actual.push([round(x,4),1.2*x-.4*x*x]);predicted.push([round(x,4),coefficient[0]+coefficient[1]*x+coefficient[2]*x*x]);}
 const error=Math.sqrt(actual.reduce((sum,row,i)=>sum+(row[1]-predicted[i][1])**2,0)/actual.length);
 return {series:[{label:'生成方程',color:'#008bfb',points:actual},{label:'稀疏候选',color:'#ff0051',points:predicted}],
  stats:[['活动项',active.map(i=>['1','x','x²'][i]).join('、')||'无'],['候选系数 [1,x,x²]',coefficient.map(value=>round(value,2)).join(' / ')],['曲线 RMSE / U/T',round(error)]],
  finding:active.length===0?'阈值删去了全部候选项；稀疏不等于正确。':noise>0?'页面给导数观测加入了确定的扰动；系数变化显示对阈值和噪声的敏感性。':'这是无噪声教学例；即便恢复已知系数，也不能仅由稀疏外观证明机制。',
  condition:`50 个训练状态 x∈[0.1,1] U，曲线显示到 2.5 U；阈值 ${round(threshold)}，导数扰动幅度 ${round(noise)} U/T。`};
}

export function structureView(kind,dt,steps){
 const matrix=kind==='closed'?[[-1,.2],[1,-.2]]:[[-1,.3],[1,-.2]];
 let state=[2,0];const amount=[],room=[];
 for(let k=0;k<=steps;k++){
  amount.push([k,state[0]+state[1]]);room.push([k,state[0]]);
  const next=[state[0]+dt*(matrix[0][0]*state[0]+matrix[0][1]*state[1]),
              state[1]+dt*(matrix[1][0]*state[0]+matrix[1][1]*state[1])];
  state=next;
 }
 const deviation=Math.max(...amount.map(row=>Math.abs(row[1]-2)));
 const minRoom=Math.min(...room.map(row=>row[1]));
 return {series:[{label:'两室合计',color:'#008bfb',points:amount},{label:'第一室',color:'#ff0051',points:room}],
  stats:[['最大总量偏离 / U',round(deviation)],['第一室最小值 / U',round(minRoom)],['第二列和 / 1/T',kind==='closed'?0:.1]],
  finding:kind!=='closed'?'第二列和为 0.1/T，这个候选矩阵并非闭合交换；总量可能凭空增加。':dt>1?'连续矩阵守恒且正，但当前 Euler 步太大，第一室可变负；这是数值更新的失败。':'连续闭合交换与此 Euler 步长共同保持本例的总量与非负性。',
  condition:`${kind==='closed'?'闭合交换矩阵':'列和错误的候选矩阵'}；Euler 步长 ${round(dt)} T；观察 ${steps} 步。`};
}

export function nextKind(chapter,kind){
 if(chapter==='14.3')return kind==='short'?'full':'short';
 if(chapter==='14.5')return kind==='closed'?'leaky':'closed';
 return kind;
}
export {norm};
