const blue='#008bfb',pink='#ff0051',green='#00a56a';
const round=(x,n=4)=>Number(x.toFixed(n));
const line=(label,color,points,dots=false)=>({label,color,points,dots});
const terms=degree=>(degree+3)*(degree+2)*(degree+1)/6;

export function claimView(window,degree,kind='samples'){
 const count=Math.round(window*100)+1;
 if(kind==='terms')return {series:[line('多项式字典列数',blue,[2,3,4,5].map(d=>[d,terms(d)])),line('当前课程选择',pink,[[degree,terms(degree)]],true)],
  stats:[['当前字典列',terms(degree)],['论文最高次数',5],['课程窗口采样点',count]],
  condition:`课程窗口 ${round(window)} 个归一化时间单位、每 0.01 一点；当前多项式至 ${degree} 次。`,
  finding:'原文另使用 0—100 T 与至五次候选；改动了任务规模，不能把缩减结果写成原论文全配置复现。'};
 return {series:[line('课程采样点数（log₁₀）',blue,Array.from({length:51},(_,i)=>[i*2,Math.log10(i*200+1)])),line('课程当前窗口',pink,[[window,Math.log10(count)]],true),line('原论文配置',green,[[100,Math.log10(100001)]],true)],
  stats:[['当前样本点',count],['原论文样本点',100001],['当前字典列',terms(degree)]],
  condition:`纵轴为采样点数的 log₁₀；原始数量见下方。课程步长 0.01，原文步长 0.001；当前窗口 ${round(window)}、${degree} 次字典。`,
  finding:'窗口与字典改变了数据量及辨识难度；轨迹图相似不等于原文性能数字已经复现。'};
}

function fitToy(noise,threshold){
 const xs=Array.from({length:25},(_,i)=>-1+i/12),target=xs.map((x,i)=>2*x+.05*x*x+noise*Math.sin(1.7*i));
 let a=0,b=0,c=0,d=0,u=0,v=0;
 for(let i=0;i<xs.length;i++){const x=xs[i],q=x*x;a+=x*x;b+=x*q;c+=q*x;d+=q*q;u+=x*target[i];v+=q*target[i];}
 const determinant=a*d-b*c;let first=(u*d-b*v)/determinant,second=(a*v-c*u)/determinant;
 if(Math.abs(first)<threshold)first=0;if(Math.abs(second)<threshold)second=0;
 if(first===0&&second!==0)second=v/d;
 if(second===0&&first!==0)first=u/a;
 return {xs,target,first,second};
}
export function protocolView(threshold,noise,kind='fit'){
 const {xs,target,first,second}=fitToy(noise,threshold);
 const prediction=xs.map(x=>first*x+second*x*x);
 const rmse=Math.sqrt(prediction.reduce((sum,y,i)=>sum+(y-target[i])**2,0)/xs.length);
 const series=kind==='support'?[line('保留系数绝对值',pink,[[1,Math.abs(first)],[2,Math.abs(second)]],true),line('筛除阈值',blue,[[1,threshold],[2,threshold]])]:
  [line('训练观测',blue,xs.map((x,i)=>[x,target[i]]),true),line('阈值重拟合',pink,xs.map((x,i)=>[x,prediction[i]]))];
 return {series,stats:[['x 系数',round(first)],['x² 系数',round(second)],['训练 RMSE',round(rmse)]],
  condition:`固定 25 个训练点；导数噪声代理强度 ${round(noise)}；绝对阈值 ${round(threshold)}。`,
  finding:'这是网页中的二项回归教学替身；完整 Lorenz 字典、轨迹隔离和伴随梯度在 Notebook 内核验。'};
}
export function ablationView(noise,threshold,kind='error'){
 const values=[];
 for(const amount of [0,.1,.2,.3,.4,.5]){
  const {first,second}=fitToy(amount,threshold);
  const xs=Array.from({length:41},(_,i)=>-1+i/20);
  const mse=xs.reduce((sum,x)=>sum+((first-2)*x+(second-.05)*x*x)**2,0)/xs.length;
  values.push([amount,kind==='support'?Number(Math.abs(first)>1e-9)+Number(Math.abs(second)>1e-9):Math.sqrt(mse)]);
 }
 const current=values.find(([x])=>Math.abs(x-noise)<1e-8)||values.reduce((best,row)=>Math.abs(row[0]-noise)<Math.abs(best[0]-noise)?row:best);
 return {series:[line(kind==='support'?'保留项数':'无噪参考函数误差',blue,values),line('当前噪声',pink,[current],true)],
  stats:[['当前噪声强度',round(noise)],['固定阈值',round(threshold)],['当前'+(kind==='support'?'保留项数':'函数误差'),round(current[1])]],
  condition:`同一组输入点和确定性噪声序列；只改变噪声幅度或阈值。`,
  finding:'网页展示小回归反例，不是原论文 Lorenz 消融数据；失败和非单调变化都应保留。'};
}
export function transferView(exchange,input,kind='amounts'){
 let a=2,b=1,integral=3;const first=[[0,a]],second=[[0,b]],total=[[0,a+b]],balance=[[0,integral]];
 for(let i=1;i<=60;i++){
  const h=.05,da=input-.1*a-exchange*(a-b),db=-.2*b+exchange*(a-b);
  integral+=h*(input-.1*a-.2*b);a+=h*da;b+=h*db;
  first.push([round(i*h,3),a]);second.push([round(i*h,3),b]);total.push([round(i*h,3),a+b]);balance.push([round(i*h,3),integral]);
 }
 return {series:kind==='balance'?[line('两室总量',pink,total),line('累计输入减清除',blue,balance)]:[line('室 1',blue,first),line('室 2',pink,second)],
  stats:[['末时室 1 / U',round(a)],['末时室 2 / U',round(b)],['收支残差 / U',round(Math.abs(a+b-integral),8)]],
  condition:`双室初态 [2,1] U；输入 [${round(input)},0] U/T；清除率 [0.1,0.2]/T；交换率 ${round(exchange)}/T。`,
  finding:'交换项在总量方程中抵消。该图是人工生命系统迁移，不属于两篇论文的原始实验。'};
}
export function nextKind(chapter,kind){
 const other={'17.1':['samples','terms'],'17.2':['fit','support'],'17.3':['error','support'],'17.4':['amounts','balance']}[chapter];
 return other?.[0]===kind?other[1]:other?.[0]??kind;
}
