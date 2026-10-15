const id=new URLSearchParams(location.search).get('id');
const status=document.getElementById('status'),retry=document.getElementById('retry');
async function open(){
 retry.hidden=true;status.textContent='正在连接本机学习环境，首次打开可能需要稍等。';
 try{
  if(!id)throw Error('请从教材中的实验入口选择 Notebook。');
  const sessionResponse=await fetch('/api/session',{signal:AbortSignal.timeout(8000)});
  if(!sessionResponse.ok)throw Error('无法连接教材服务。');
  const session=await sessionResponse.json(),lesson=session.notebooks.find(n=>n.id===id);
  if(!lesson)throw Error('没有找到这份实验。');
  document.getElementById('title').textContent='打开实验：'+lesson.title;
  const response=await fetch('/api/notebooks/open',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':session.token},body:JSON.stringify({id}),signal:AbortSignal.timeout(55000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'实验未能打开。');
  const url=new URL(result.url);
  if(url.hostname!=='127.0.0.1'||url.protocol!=='http:')throw Error('实验地址不正确。');
  location.replace(url.href);
 }catch(error){status.textContent=(error.name==='TimeoutError'?'连接超时，请重试。':error.message);retry.hidden=false;}
}
retry.addEventListener('click',open);void open();
