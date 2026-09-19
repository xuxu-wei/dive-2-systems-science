// Analytic special case of a three-room symmetric exchange model.
// The training trajectory excites only the antisymmetric decay direction.
export const times=Array.from({length:31},(_,i)=>i/5);
export const averageDecay=times.reduce((sum,t)=>sum+Math.exp(-t),0)/times.length;

export function trueState(kind,time){
  const slow=Math.exp(-time);
  if(kind==='train')return[1+slow,1,1-slow];
  if(kind==='holdout'){
    const fast=Math.exp(-3*time);
    return[1+1.5*slow+.5*fast,1-fast,1-1.5*slow+.5*fast];
  }
  throw Error('Unknown initial condition');
}

export function reducedState(kind,time,rank){
  if(![0,1].includes(rank))throw Error('Rank must be 0 or 1');
  if(!Number.isFinite(time)||time<0)throw Error('Time must be nonnegative');
  if(kind!=='train'&&kind!=='holdout')throw Error('Unknown initial condition');
  const mean=[1+averageDecay,1,1-averageDecay];
  if(rank===0)return mean;
  const amplitude=kind==='train'?1:1.5;
  const slow=Math.exp(-time);
  return[1+amplitude*slow,1,1-amplitude*slow];
}

export function nextKind(kind){return kind==='train'?'holdout':'train';}

export function distance(a,b){return Math.hypot(...a.map((value,i)=>value-b[i]));}
