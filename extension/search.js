(() => {
  if (
    !/^(?:www\.)?google\.(?:com|ru|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(
      location.hostname
    ) ||
    location.pathname !== '/search'
  )
    return;

  const marker = 'data-stopbk-search';
  let stopped = false;
  let scanTimer;
  let observer;
  function contextAlive() {
    try {
      return Boolean(chrome.runtime.id);
    } catch {
      return false;
    }
  }
  function stop() {
    stopped = true;
    clearTimeout(scanTimer);
    observer?.disconnect();
    revision++;
  }
  function requestScan() {
    if (stopped) return;
    scan().catch((error) => {
      if (!contextAlive() || String(error).includes('context invalidated')) stop();
      else console.error('StopDEP search filtering:', error);
    });
  }

  function destination(link) {
    let url = new URL(link, location.origin);
    if (url.origin === location.origin && url.pathname === '/url') {
      const destination = url.searchParams.get('url') || url.searchParams.get('q');
      if (!destination || !/^https?:\/\//i.test(destination)) return;
      url = new URL(destination);
    }
    if (!['https:', 'http:'].includes(url.protocol)) return;
    return url;
  }

  function category(url, host) {
    for (const [key, domains] of Object.entries(searchDomains)) {
      if (domains.some((domain) => host === domain || host.endsWith('.' + domain)))
        return key;
    }
    const profile = url.pathname.toLowerCase().split('/')[1];
    if (
      (host === 'www.twitch.tv' || host === 'twitch.tv' || host === 't.me') &&
      profile === 'casebattle_official'
    )
      return 'cases';
  }

  const bettingBrands =
    /(?<![\p{L}\p{N}])(?:winline|винлайн|1\s*win|1\s*вин|bet[\s-]*boom|бет[\s-]*бум|fon[\s-]*bet|фон[\s-]*бет|bet[\s-]*city|бет[\s-]*сити|лига ставок|olimp[\s-]*bet|олимп[\s-]*бет|1x[\s-]*bet|1xставка|parimatch|париматч|melbet|мелбет|mostbet|мостбет|bet365)(?![\p{L}\p{N}])/giu;

  function blurNames() {
    const results = document.querySelector('#search');
    if (!results) return;
    const walker = document.createTreeWalker(results, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        !node.parentElement ||
        node.parentElement.closest(
          '.stopbk-bet-brand, script, style, textarea, [contenteditable]'
        )
      )
        continue;
      const brands = [...node.data.matchAll(bettingBrands)];
      if (brands.length) matches.push([node, brands]);
    }
    for (const [node, brands] of matches) {
      const text = node.data;
      const fragment = document.createDocumentFragment();
      let position = 0;
      for (const brand of brands) {
        fragment.append(text.slice(position, brand.index));
        const label = document.createElement('span');
        label.className = 'stopbk-bet-brand';
        label.textContent = brand[0];
        fragment.append(label);
        position = brand.index + brand[0].length;
      }
      fragment.append(text.slice(position));
      node.replaceWith(fragment);
    }
  }

  let revision = 0;
  async function scan() {
    if (!contextAlive()) {
      stop();
      return;
    }

    const version = ++revision;
    const pending = new Map();
    for (const marked of document.querySelectorAll('[' + marker + ']'))
      marked.removeAttribute(marker);
    for (const heading of document.querySelectorAll('#search h3')) {
      const link = heading.closest('a[href]');
      if (!link) continue;
      const card = link.closest('.MjjYud, .Gx5Zad, .g');
      if (!card) continue;
      let url;
      try {
        url = destination(link.href);
      } catch {
        continue;
      }
      if (!url) continue;
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      const match = category(url, host);
      if (match) card.setAttribute(marker, match);
      else {
        if (!pending.has(host)) pending.set(host, []);
        pending.get(host).push(card);
      }
    }
    if (!pending.size) return;
    let hosts;
    try {
      hosts = await chrome.runtime.sendMessage({
        type: 'search-gambling',
        hosts: [...pending.keys()],
      });
    } catch (error) {
      if (!contextAlive() || String(error).includes('context invalidated')) stop();
      return;
    }
    if (version !== revision || !Array.isArray(hosts)) return;
    for (const host of hosts) {
      for (const card of pending.get(host) || []) card.setAttribute(marker, 'gambling');
    }
  }

  let queued = false;
  observer = new MutationObserver(() => {
    if (queued || stopped) return;
    queued = true;
    scanTimer = setTimeout(() => {
      queued = false;
      requestScan();
    }, 200);
  });
  requestScan();
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
})();
