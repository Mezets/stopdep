(() => {
 const defaults = {"депни":"проеби деньги","winline":"svinline","винлайн":"свинлайн","1win":"1слив","betboom":"БетСлив","бетбум":"БетСлив","фонбет":"ФонСлив","fonbet":"ФонСлив","ggdrop":"GG твоим деньгам","pari":"Пари — деньги испарились","olimpbet":"ОлимпМинус","олимпбет":"ОлимпМинус","лига ставок":"Лига остатков","марафон":"Марафон до нуля","marathon":"Marathon to Zero","пари-матч":"Пари-Минус","parimatch":"Пари-Минус","stoiximan":"Стоишь без денег","betsson":"Бедсон","bet365":"Минус365","bwin":"bLose","netbet":"НетБабок","sportingbet":"SportingDebt","winline.kz":"svinline.kz","case battle":"Слив Батл","case-battle":"Слив-Батл","casebattle":"СливБатл","кейс батл":"Кошелёк на батл","caser":"Кейсер — хрен тебе дроп","кейсер":"Кейсер — хрен тебе дроп","upgrader":"Даунгрейдер кошелька","skin.club":"Скинул бабки клуб","skinclub":"Скинул бабки клуб","hellcase":"Ад для баланса","key-drop":"Ключ в минус","keydrop":"Ключ в минус","farmskins":"Ферма твоих денег","datdrop":"ДатСлив","clash.gg":"Клэш твоей зарплаты","rustclash":"Ржавый слив","rustchance":"Шанс остаться без штанов","rustypot":"Ржавая дыра","rustyloot":"Ржавый лутосос","dota2hunt":"Охота на твой кошелёк","dota2bestyolo":"YOLO твоим деньгам","dota2cases":"ДотаКейсы — минус маны и денег"};
 const state = new WeakMap();
 let observer, timer, replacements, pattern;
 const pending = new Set();
 function escapeRegex(value) {
  return [...value].map(char => '\\^$.*+?()[]{}|'.includes(char) ? '\\' + char : char).join('');
 }
 function replaceNode(node) {
  if (!node.parentElement || node.parentElement.closest('script,style,textarea,input,[contenteditable]')) return;
  const previous = state.get(node);
  if (previous?.output === node.data) return;
  const source = node.data;
  const output = source.replace(pattern, match => {
   const key = match.toLocaleLowerCase().replace(/[s ‐-―-]+/g, '');
   if (['кейсбатл','кейсбаттл','кейсбаттл','casebattle'].includes(key)) return replacements.get('case battle') || 'Слив Батл';
   return replacements.get(match.toLocaleLowerCase());
  });
  state.set(node, {output});
  if (output !== source) node.data = output;
 }
 function scan(root) {
  if (root.nodeType === Node.TEXT_NODE) return replaceNode(root);
  if (!root.isConnected) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) replaceNode(walker.currentNode);
 }
 function flush() {
  try {
   if(!chrome.runtime.id){observer?.disconnect();pending.clear();return;}
  }catch{observer?.disconnect();pending.clear();return;}
  timer = null;
  observer.disconnect();
  for (const root of pending) scan(root);
  pending.clear();
  observer.observe(document.body, {childList:true,subtree:true,characterData:true});
 }
 async function start() {
  const data = await chrome.storage.local.get(['wordReplacements','wordEditor','enabled']);
  if (data.enabled === false || data.wordEditor === false) return;
  const pairs = Object.entries({...defaults, ...data.wordReplacements}).filter(([a,b]) => a && typeof b === 'string');
  if (!pairs.length) return;
  replacements = new Map(pairs.map(([a,b]) => [a.toLocaleLowerCase(), b]));
  pattern = new RegExp('(?:кейс[\s\u00a0\u2010-\u2015-]*бат(?:т)?л|case[\s\u00a0\u2010-\u2015-]*battle)|' + pairs.sort((a,b)=>b[0].length-a[0].length).map(([a])=>escapeRegex(a)).join('|'), 'giu');
  observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') pending.add(record.target);
      else for (const node of record.addedNodes) pending.add(node);
    }
    if (pending.size && !timer) timer = setTimeout(flush, 200);
  });
  pending.add(document.body);
  flush();
 }
 start().catch(error=>{
  observer?.disconnect();
  clearTimeout(timer);
  if(!String(error).includes('context invalidated'))console.error('StopDEP replacements:',error);
 });
})();