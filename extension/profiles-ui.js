(() => {
  const el = (id) => document.getElementById(id);
  const labels = {
    bet: 'Букмекерские баннеры',
    cases: 'Баннеры кейсов',
    gambling: 'Баннеры казино',
    banners: 'Скрывать распознанные баннеры и ссылки',
    masks: 'Сохранённые области',
    blocks: 'Скрытые блоки',
  };
  let selected = '',
    rendering = false;
  function channelName(text) {
    try {
      if (text.includes('://'))
        text = new URL(text).pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
    text = text.trim().replace(/^@/, '').toLowerCase();
    return /^[a-z0-9_]{1,25}$/.test(text) ? text : null;
  }
  async function renderProfiles() {
    if (rendering) return;
    rendering = true;
    try {
      const data = await chrome.storage.local.get(null),
        profiles = data.twitchProfiles || {};
      if (!selected) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        try {
          const url = new URL(tab?.url);
          if (/(^|\.)twitch\.tv$/.test(url.hostname))
            selected = channelName(url.pathname.split('/')[1]) || '';
        } catch {}
      }
      const channels = [
        ...new Set([
          ...Object.keys(profiles),
          ...(data.hiddenBlocks||[]).map(rule=>{try{const u=new URL(rule.page);return /(^|\.)twitch\.tv$/.test(u.hostname)?channelName(u.pathname.split('/')[1]):null;}catch{return null;}}).filter(Boolean),
          ...Object.values(data)
            .filter((m) => m && typeof m === 'object' && m.page)
            .map((m) => {
              try {
                const url = new URL(m.page);
                return /(^|\.)twitch\.tv$/.test(url.hostname)
                  ? channelName(url.pathname.split('/')[1])
                  : null;
              } catch {
                return null;
              }
            })
            .filter(Boolean),

        ]),
      ].sort();
      if (!channels.includes(selected)) selected = channels[0] || '';
      el('profileSelect').replaceChildren(
        ...channels.map((channel) => {
          const o = document.createElement('option');
          o.value = channel;
          o.textContent = channel;
          return o;
        })
      );
      el('profileSelect').value = selected;
      el('profileReset').disabled = !selected || !profiles[selected];
      el('profileOptions').replaceChildren(
        ...(selected
          ? Object.entries(labels).map(([key, label]) => {
              const row = document.createElement('label');
              row.className = 'row';
              const text = document.createElement('span');
              text.textContent = label;
              const input = document.createElement('input');
              input.type = 'checkbox';
              input.setAttribute('role', 'switch');
              input.checked = (profiles[selected]?.[key] ?? data[key]) !== false;
              input.onchange = async () => {
                const latest = await chrome.storage.local.get('twitchProfiles');
                await chrome.storage.local.set({
                  twitchProfiles: {
                    ...latest.twitchProfiles,
                    [selected]: {
                      ...latest.twitchProfiles?.[selected],
                      [key]: input.checked,
                    },
                  },
                });
              };
              row.append(text, input);
              if(key==='masks'||key==='blocks'){
                const group=document.createElement('div');group.className='profile-rule-group';group.append(row);
                const list=document.createElement('ul');list.className='profile-rule-list';
                const belongs=page=>{try{const url=new URL(page);return /(^|\.)twitch\.tv$/.test(url.hostname)&&channelName(url.pathname.split('/')[1])===selected;}catch{return false;}};
                const entries=key==='masks'?Object.entries(data).filter(([id,mask])=>id.startsWith('mask:')&&belongs(mask.page)):(data.hiddenBlocks||[]).filter(rule=>belongs(rule.page)).map(rule=>[rule.id,rule]);
                for(const [id,rule] of entries){
                  const item=document.createElement('li');const title=document.createElement('strong');title.textContent=rule.name||rule.label||(key==='masks'?'Область':'Скрытый блок');item.append(title);
                  if(key==='blocks'){
                    const technical=!rule.label||/^(img|div|a|span|section)$/i.test(rule.label);
                    if(technical)title.textContent='Скрытый блок '+(entries.findIndex(([entryId])=>entryId===id)+1);
                    if(rule.image && /^https?:/.test(rule.image)){
                      const imageLink=document.createElement('a');imageLink.className='hidden-block-preview';imageLink.href=rule.image;imageLink.target='_blank';imageLink.rel='noopener noreferrer';imageLink.title='Открыть изображение скрытого блока';
                      const preview=document.createElement('img');preview.src=rule.image;preview.alt='Изображение скрытого блока';preview.loading='lazy';preview.onerror=()=>{imageLink.textContent='Открыть изображение блока';};imageLink.append(preview);item.prepend(imageLink);
                    }
                    if(rule.image){const filename=document.createElement('small');try{filename.textContent=decodeURIComponent(new URL(rule.image).pathname.split('/').pop());}catch{}filename.className='block-source-name';item.append(filename);}
                  }
                  const meta=document.createElement('small');meta.textContent=Number.isFinite(rule.createdAt)?new Date(rule.createdAt).toLocaleString(locale==='en'?'en-GB':'ru-RU',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):t('Дата добавления неизвестна');item.append(meta);
                  const link=document.createElement('a');link.href=rule.page;link.textContent='twitch.tv/'+selected;link.target='_blank';link.rel='noopener noreferrer';item.append(link);
                  const actions=document.createElement('div');actions.className='mask-actions';
                  if(key==='masks'){
                    const show=document.createElement('button');show.textContent=t('Показать');show.dataset.maskKey=id;show.onclick=()=>toggleMask(id,rule).catch(error=>report(error.message));
                    const edit=document.createElement('button');edit.textContent=t('Править');edit.onclick=()=>beginEdit(id,rule,item);
                    const remove=document.createElement('button');remove.textContent=t('Удалить');remove.onclick=async()=>{await chrome.storage.local.set({lastMaskAction:{key:id,before:rule}});await chrome.storage.local.remove(id);};actions.append(show,edit,remove);
                  }else{const restore=document.createElement('button');restore.textContent=t('Вернуть');restore.onclick=async()=>{const latest=await chrome.storage.local.get('hiddenBlocks');await chrome.storage.local.set({hiddenBlocks:(latest.hiddenBlocks||[]).filter(r=>r.id!==id)});};actions.append(restore);}
                  item.append(actions);list.append(item);
                }
                if(!entries.length){const empty=document.createElement('li');empty.textContent='Для этого канала пока ничего не сохранено';list.append(empty);}
                group.append(window.stopdepFold('profile:'+selected+':'+key,(key==='masks'?'Области':'Блоки')+' · '+entries.length,list));return group;
              }
              return row;
            })
          : [])
      );
      updateShowButtons();
      el('communityEnabled').checked = data.communityEnabled === true;
      el('communityStatus').textContent =
        (data.communityRevision
          ? 'Набор: ' + data.communityRevision
          : 'Встроенный набор') +
        (data.communityCheckedAt
          ? ' · Проверено ' + new Date(data.communityCheckedAt).toLocaleString()
          : '') +
        (data.communityError ? ' · Не удалось обновить: ' + data.communityError : '');
    } finally {
      rendering = false;
    }
  }
  el('profileAdd').onsubmit = async (event) => {
    event.preventDefault();
    const name = channelName(el('profileChannel').value);
    if (!name) {
      el('profileChannel').setCustomValidity('Введи название канала Twitch.');
      el('profileChannel').reportValidity();
      return;
    }
    selected = name;
    const data = await chrome.storage.local.get('twitchProfiles');
    await chrome.storage.local.set({
      twitchProfiles: {
        ...data.twitchProfiles,
        [name]: data.twitchProfiles?.[name] || {},
      },
    });
    el('profileChannel').value = '';
    renderProfiles();
  };
  el('profileChannel').oninput = () => el('profileChannel').setCustomValidity('');
  el('profileSelect').onchange = () => {
    selected = el('profileSelect').value;
    renderProfiles();
  };
  el('profileReset').onclick = async () => {
    const data = await chrome.storage.local.get('twitchProfiles');
    const profiles = { ...data.twitchProfiles };
    delete profiles[selected];
    await chrome.storage.local.set({ twitchProfiles: profiles });
  };
  el('communityEnabled').onchange = async () => {
    await chrome.storage.local.set({ communityEnabled: el('communityEnabled').checked });
  };
  el('communityUpdate').onclick = async () => {
    el('communityUpdate').disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'update-community' });
      if (response?.error) el('communityStatus').textContent = response.error;
    } catch (error) {
      el('communityStatus').textContent = error.message;
    } finally {
      el('communityUpdate').disabled = false;
      renderProfiles();
    }
  };
  chrome.storage.onChanged.addListener(() => renderProfiles().catch(console.error));
  renderProfiles().catch(console.error);
})();
