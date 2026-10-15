// 概念链接来自课程目录；查询参数只用于选择当前章已有的对应项。
export function questionReadingReference(chapter, questionId){
  const question=(chapter?.lessons||[]).flatMap(lesson=>lesson.questions||[]).find(item=>item.id===questionId);
  return question?.reading_url&&question.concept_title?{url:question.reading_url,title:question.concept_title}:null;
}
export function explorationReadingReferences(chapter, search=''){
  const items=(chapter?.lessons||[]).flatMap(lesson=>(lesson.concepts||[])
    .filter(concept=>concept.explore&&concept.url&&concept.key)
    .map(concept=>({key:concept.key,url:concept.url,title:concept.title,lessonId:lesson.id})));
  const key=new URLSearchParams(search).get('concept');
  return {items,selected:key?items.find(item=>item.key===key)||null:null};
}
