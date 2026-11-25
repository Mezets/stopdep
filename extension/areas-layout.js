(() => {
  const region=document.getElementById('regions');
  const create=document.createElement('details');create.className='area-section';
  const summary=document.createElement('summary');summary.textContent='Создать замазку';create.append(summary);
  const first=region.querySelector('.modes');const stop=document.getElementById('clearPageMasks');
  first.before(create);
  let node=first;while(node&&node!==stop){const next=node.nextSibling;create.append(node);node=next;}
  const list=document.getElementById('saved');const saved=list.closest('.list-fold');
  if(saved){
    saved.classList.add('area-section');saved.querySelector('summary span').textContent='Сохранённые замазки';
    const filter=document.getElementById('folderFilter').closest('label');
    const search=document.getElementById('maskSearch');const count=document.getElementById('maskListCount');
    filter.hidden=true;
    list.before(search,document.getElementById('maskPageFilter').closest('label'),count);
    const manage=document.createElement('details');manage.className='area-subsection';
    const heading=document.createElement('summary');heading.textContent='Папки и перенос';manage.append(heading);
    const tools=region.querySelector('.folder-tools');const bulk=region.querySelector('.bulk-tools');manage.append(tools,bulk);manage.hidden=true;list.before(manage);
    const actions=document.createElement('details');actions.className='area-subsection';const title=document.createElement('summary');title.textContent='Удаление и отмена';actions.append(title);
    for(const id of ['undoLast','clearPageMasks','undoClearMasks'])actions.append(document.getElementById(id));list.after(actions);
  }
  region.querySelector('.hidden-blocks-panel').querySelector('summary').textContent='Скрытые блоки';
  region.prepend(create);
  if(saved)create.after(saved);
})();
