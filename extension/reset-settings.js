(() => {
  let pending;
  const el=id=>document.getElementById(id);
  const questions={masks:'Удалить все сохранённые замазки на всех сайтах?',blocks:'Восстановить все скрытые блоки на всех сайтах?',words:'Удалить свои замены и вернуть встроенные?',sites:'Удалить все сайты, добавленные вручную?'};
  for(const button of document.querySelectorAll('[data-reset]'))button.onclick=()=>{pending=button.dataset.reset;el('resetQuestion').textContent=questions[pending];el('resetConfirmation').hidden=false;el('resetConfirm').focus();};
  el('resetCancel').onclick=()=>{pending=null;el('resetConfirmation').hidden=true;};
  el('resetConfirm').onclick=async()=>{
    const action=pending;if(!action)return;el('resetConfirm').disabled=true;
    try{
      if(action==='masks'){
        const data=await chrome.storage.local.get(null);
        await chrome.storage.local.remove([...Object.keys(data).filter(key=>key.startsWith('mask:')),'lastMaskAction','lastClearedMasks']);
      }else if(action==='blocks')await chrome.storage.local.set({hiddenBlocks:[]});
      else if(action==='words')await chrome.storage.local.remove('wordReplacements');
      else if(action==='sites')await chrome.storage.local.set({customDomains:[]});
      pending=null;el('resetConfirmation').hidden=true;el('resetResult').textContent='Сброс выполнен.';
      if(action==='words'||action==='sites')location.reload();
    }catch(error){el('resetResult').textContent=error.message;}finally{el('resetConfirm').disabled=false;}
  };
})();
