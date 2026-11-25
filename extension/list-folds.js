(() => {
  let state={};
  const bindings=new Map();
  window.stopdepFold=(key,title,content)=>{
    const details=document.createElement('details');details.className='list-fold';
    details.open=state[key]===true;
    const summary=document.createElement('summary');
    const label=document.createElement('span');label.textContent=title;
    const action=document.createElement('span');action.className='fold-action';
    const update=()=>action.textContent=typeof t==='function'?t(details.open?'Свернуть':'Развернуть'):(details.open?'Свернуть':'Развернуть');
    summary.append(label,action);details.append(summary,content);update();
    details.addEventListener('toggle',()=>{update();if(state[key]===details.open)return;state[key]=details.open;chrome.storage.local.set({listFoldState:{...state}}).catch(console.error);});
    bindings.set(key,details);return details;
  };
  chrome.storage.local.get('listFoldState').then(data=>{state=data.listFoldState||{};for(const [key,details] of bindings)details.open=state[key]===true;});
  for(const [id,title] of [['saved','Сохранённые области'],['wordRows','Замены слов'],['siteRows','Дополнительные сайты'],['releaseList','Список изменений']]){
    const list=document.getElementById(id);if(!list)continue;
    const slot=document.createElement('div');list.before(slot);slot.replaceWith(window.stopdepFold('list:'+id,title,list));
  }
})();
