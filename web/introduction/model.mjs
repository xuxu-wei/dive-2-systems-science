// 教学规则：每轮只读取旧名单；双向联系、收到后保持。
export const connections = {
  chain: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  star: [[0,1],[0,2],[0,3],[0,4],[0,5]],
};
export function propagate(edges, start=0, rounds=5) {
  const received=Array(6).fill(false);received[start]=true;
  const history=[received.slice()];
  for(let round=0;round<rounds;round++){
    const previous=received.slice();
    for(const [left,right] of edges){
      if(previous[left])received[right]=true;
      if(previous[right])received[left]=true;
    }
    history.push(received.slice());
  }
  return history;
}
