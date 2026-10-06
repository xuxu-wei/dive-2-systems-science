const blue='#008bfb',pink='#ff0051',green='#00a56a';
const round=(x,n=4)=>Number(x.toFixed(n));
const line=(label,color,points,dots=false)=>({label,color,points,dots});
const terms=degree=>(degree+3)*(degree+2)*(degree+1)/6;

export function claimView(window,degree,kind='samples'){
 const count=Math.round(window*100)+1;
 if(kind==='terms')return {series:[line('多项式字典列数',blue,[2,3,4,5].map(d=>[d,terms(d)])),line('当前课程选择',pink,[[degree,terms(degree)]],true)],
  stats:[['当前字典列',terms(degree)],['论文最高次数',5],['课程窗口采样点',count]],
  condition:`课程窗口 ${round(window)} 个归一化时间单位、每 0.01 一点；当前多项式至 ${degree} 次。`,
  finding:'次数增加让字典变宽；轨迹能否区分这些列，还要结合实际状态覆盖和系数拟合检查。'};
 return {series:[line('课程采样点数（log₁₀）',blue,Array.from({length:51},(_,i)=>[i*2,Math.log10(i*200+1)])),line('课程当前窗口',pink,[[window,Math.log10(count)]],true),line('原论文配置',green,[[100,Math.log10(100001)]],true)],
  stats:[['当前样本点',count],['原论文样本点',100001],['当前字典列',terms(degree)]],
  condition:`纵轴为样本行数的log₁₀，原始行数见下方读数。课程步长 0.01，原文步长 0.001；当前窗口 ${round(window)}、${degree} 次字典。`,
  finding:'窗口延长让数据表增加行，次数提高让字典增加列。把两种规模分开看，再安排拟合与独立核验。'};
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
  condition:`固定25个训练点；确定性扰动幅度 ${round(noise)}；绝对阈值 ${round(threshold)}。`,
  finding:'当前阈值删去小系数后，剩余项重新拟合；切换视图，把保留系数与训练误差联系起来。'};
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
 return {series:[line(kind==='support'?'保留项数':'无噪参考函数误差',blue,values),line('当前扰动',pink,[current],true)],
  stats:[['当前扰动幅度',round(noise)],['固定阈值',round(threshold)],['当前'+(kind==='support'?'保留项数':'函数误差'),round(current[1])]],
  condition:`训练点与正弦扰动形状固定；当前曲线逐档改变幅度，在41个参考点上计算无扰动函数误差。`,
  finding:'先看当前幅度下保留几项，再看参考误差。项数相同不代表系数或预测相同，减少项数也未必降低误差。'};
}
export function transferView(exchange,input,kind='amounts'){
 let a=2,b=1,integral=3;const first=[[0,a]],second=[[0,b]],total=[[0,a+b]],balance=[[0,integral]];
 for(let i=1;i<=60;i++){
  const h=.05,da=input-.1*a-exchange*(a-b),db=-.2*b+exchange*(a-b);
  integral+=h*(input-.1*a-.2*b);a+=h*da;b+=h*db;
  first.push([round(i*h,3),a]);second.push([round(i*h,3),b]);total.push([round(i*h,3),a+b]);balance.push([round(i*h,3),integral]);
 }
 return {series:kind==='balance'?[line('两室总量',pink,total),line('初始总量＋累计输入减清除',blue,balance)]:[line('室 1',blue,first),line('室 2',pink,second)],
  stats:[['末时室 1 / U',round(a)],['末时室 2 / U',round(b)],['收支残差 / U',round(Math.abs(a+b-integral),8)]],
  condition:`双室初态 [2,1] U；输入 [${round(input)},0] U/T；清除率 [0.1,0.2]/T；交换率 ${round(exchange)}/T。`,
  finding:'交换在两室一减一加，改变各室路径；整体收支仍由输入减清除决定，图中两种总量计算可以直接对照。'};
}
export function nextKind(chapter,kind){
 const other={'17.1':['samples','terms'],'17.2':['fit','support'],'17.3':['error','support'],'17.4':['amounts','balance']}[chapter];
 return other?.[0]===kind?other[1]:other?.[0]??kind;
}
