(() => {
  let settings = {},
    picker;
  const style = document.createElement('style');
  const scope = () => location.origin + location.pathname;
  const originals=new Map();
  let layoutTimer;
  const isTwitch=/(^|\.)twitch\.tv$/.test(location.hostname);
  function remember(node){if(!originals.has(node))originals.set(node,node.getAttribute('style'));}
  function restore(){for(const [node,original] of originals){if(original===null)node.removeAttribute('style');else node.setAttribute('style',original);}originals.clear();}
  function panelFor(element){
    if(!isTwitch||element.closest('.chat-room,[data-a-target="chat-room-component-layout"]'))return element;
    let node=element;
    for(let depth=0;depth<10&&node&&node!==document.body;depth++,node=node.parentElement){
      if(getComputedStyle(node).position==='absolute'&&node.parentElement&&[...node.parentElement.children].filter(child=>getComputedStyle(child).position==='absolute').length>1)return node;
    }
    return element;
  }
  function apply() {
    restore();
    if(!style.isConnected&&document.documentElement)document.documentElement.append(style);
    style.textContent='';
    if(settings.enabled===false||stopdepProfile(settings).blocks===false)return;
    const hidden=new Set(),grids=new Set();
    for(const rule of settings.hiddenBlocks||[]){if(rule.page!==scope())continue;try{for(const element of document.querySelectorAll(rule.selector)){const panel=panelFor(element);hidden.add(panel);if(panel!==element||getComputedStyle(panel).position==='absolute')grids.add(panel.parentElement);}}catch{}}
    const layouts=[];
    for(const grid of grids){
      if(!grid||grid.closest('.chat-room'))continue;
      const bounds=grid.getBoundingClientRect();
      const cards=[...grid.children].filter(node=>getComputedStyle(node).position==='absolute').map(node=>({node,rect:node.getBoundingClientRect()})).filter(card=>card.rect.width>0);
      const columns=[];
      for(const x of cards.map(c=>Math.round(c.rect.left-bounds.left)).sort((a,b)=>a-b))if(!columns.length||x-columns[columns.length-1]>8)columns.push(x);
      if(!columns.length)continue;
      let gap=Infinity;
      for(const x of columns){const column=cards.filter(c=>Math.abs(c.rect.left-bounds.left-x)<8).sort((a,b)=>a.rect.top-b.rect.top);for(let i=1;i<column.length;i++){const space=column[i].rect.top-column[i-1].rect.bottom;if(space>=0)gap=Math.min(gap,space);}}
      layouts.push({grid,cards,columns,gap:Number.isFinite(gap)?gap:16});
    }
    for(const node of hidden){remember(node);node.style.setProperty('display','none','important');}
    for(const {grid,cards,columns,gap} of layouts){const heights=columns.map(()=>0);const visible=cards.filter(c=>!hidden.has(c.node)).sort((a,b)=>a.rect.top-b.rect.top||a.rect.left-b.rect.left);
      for(const {node,rect} of visible){const column=heights.indexOf(Math.min(...heights));remember(node);node.style.setProperty('left','0','important');node.style.setProperty('top','0','important');node.style.setProperty('transform','translate('+columns[column]+'px,'+heights[column]+'px)','important');heights[column]+=rect.height+gap;}
      remember(grid);grid.style.setProperty('height',Math.max(0,Math.max(...heights)-gap)+'px','important');
    }
  }
  function scheduleLayout(){if(layoutTimer)return;layoutTimer=setTimeout(()=>{layoutTimer=null;apply();},180);}
  const mutations=new MutationObserver(records=>{if((settings.hiddenBlocks||[]).some(rule=>rule.page===scope())&&records.some(record=>record.target!==style&&!style.contains(record.target)))scheduleLayout();});
  mutations.observe(document,{childList:true,subtree:true});
  addEventListener('resize',scheduleLayout,{passive:true});
  document.addEventListener('load',event=>{if(event.target instanceof HTMLImageElement)scheduleLayout();},true);
  chrome.storage.local.get(['enabled', 'hiddenBlocks', 'twitchProfiles']).then((data) => {
    settings = data;
    apply();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of ['enabled', 'hiddenBlocks', 'twitchProfiles'])
      if (changes[key]) settings[key] = changes[key].newValue;
    apply();
  });
  let lastScope=scope();
  setInterval(()=>{if(scope()!==lastScope){lastScope=scope();apply();}},1000);
  function selectorFor(element) {
    const parts = [];
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (node.id) {
        parts.unshift('#' + CSS.escape(node.id));
        break;
      }
      const attr =
        node.getAttribute('data-a-target') || node.getAttribute('data-test-selector');
      if (attr) {
        const key = node.hasAttribute('data-a-target')
          ? 'data-a-target'
          : 'data-test-selector';
        parts.unshift('[' + key + '="' + CSS.escape(attr) + '"]');
        if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
      } else {
        const siblings = [...node.parentElement.children].filter(
          (s) => s.localName === node.localName
        );
        parts.unshift(
          node.localName + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')'
        );
      }
    }
    return parts.join(' > ');
  }
  function startPicker() {
    if (picker) return;
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #f5ce00;background:#f5ce0020;box-sizing:border-box';
    const hint = document.createElement('div');
    hint.textContent = 'СтопДЕП · Клик — скрыть блок · Esc — отмена';
    hint.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483647;top:12px;left:12px;padding:12px;background:#171717;color:#f5ce00;border:1px solid #f5ce00;border-radius:8px;font:14px sans-serif';
    document.documentElement.append(box, hint);
    let target;
    const move = (event) => {
      target = event.target;
      if (
        !(target instanceof Element) ||
        [document.body, document.documentElement].includes(target)
      )
        return;
      const r = target.getBoundingClientRect();
      Object.assign(box.style, {
        left: r.left + 'px',
        top: r.top + 'px',
        width: r.width + 'px',
        height: r.height + 'px',
      });
    };
    const stop = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      box.remove();
      hint.remove();
      picker = null;
    };
    const click = async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const chosen = event.target;
      if (
        !(chosen instanceof Element) ||
        [document.body, document.documentElement].includes(chosen)
      )
        return;
      const selector = selectorFor(chosen);
      const image = chosen.matches('img') ? chosen : chosen.querySelector('img');
      const rule = {
        createdAt: Date.now(),
        id: crypto.randomUUID(),
        page: scope(),
        selector,
        label: (
          chosen.getAttribute('aria-label') || image?.alt || image?.title ||
          chosen.textContent ||
          chosen.localName
        )
          .trim()
          .slice(0, 100),
        image: image?.currentSrc || image?.src || null,
      };
      stop();
      try {
        const data = await chrome.storage.local.get('hiddenBlocks');
        await chrome.storage.local.set({
          hiddenBlocks: [...(data.hiddenBlocks || []), rule],
        });
      } catch {}
    };
    const key = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        stop();
      }
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    picker = stop;
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === 'pick-hidden-block') {
      startPicker();
      respond({ ok: true });
    }
  });
})();
