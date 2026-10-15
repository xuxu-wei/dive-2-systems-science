import {mountShell, locateLesson} from '../shared/course-shell.mjs';
const content=document.getElementById('lesson-content');
async function start(){
  await mountShell('reading');
  locateLesson(document.getElementById('main').dataset.lesson);
  const toc=document.getElementById('lesson-toc');
  for(const [i,h] of [...content.querySelectorAll('h2')].entries()){
    h.id = `section-${i+1}`;
    const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent;toc.append(a);
  }
  if(typeof renderMathInElement==='function'){
    const errors=[];
    renderMathInElement(content,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}],throwOnError:false,errorCallback:(message)=>errors.push(message)});
    if(errors.length)console.error('Equation rendering:',errors);
  }
  document.body.dataset.ready='true';
}
start().catch(error=>{const note=document.getElementById('loading-note');note.hidden=false;note.textContent='目录连接暂时中断，可继续阅读正文。'+error.message;});
