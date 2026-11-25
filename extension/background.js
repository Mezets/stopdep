async function syncRules() {
  const settings = await chrome.storage.local.get([
    'enabled',
    'bet',
    'cases',
    'gambling',
  ]);
  const rules = [
    ['bookmakers', 'bet'],
    ['cases', 'cases'],
    ['gambling', 'gambling'],
    ['gambling_extra', 'gambling'],
  ];
  const enableRulesetIds = rules
    .filter(([, key]) => settings.enabled !== false && settings[key] !== false)
    .map(([id]) => id);
  const disableRulesetIds = rules
    .map(([id]) => id)
    .filter((id) => !enableRulesetIds.includes(id));
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds,
    disableRulesetIds,
  });
}

let pending = Promise.resolve();
function scheduleSync() {
  pending = pending.then(syncRules).catch(console.error);
}
chrome.runtime.onInstalled.addListener(scheduleSync);
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'local' &&
    ['enabled', 'bet', 'cases', 'gambling'].some((key) => key in changes)
  )
    scheduleSync();
});

let gamblingIndex;
function loadGamblingIndex() {
  if (!gamblingIndex) {
    gamblingIndex = Promise.all(
      ['gambling.json', 'gambling-extra.json'].map(async (file) => {
        const response = await fetch(chrome.runtime.getURL(file));
        return response.json();
      })
    )
      .then((parts) => parts.flat())
      .then((rules) => {
        const domains = new Set();
        for (const rule of rules) {
          for (const domain of rule.condition.requestDomains) domains.add(domain);
        }
        return domains;
      })
      .catch((error) => {
        gamblingIndex = undefined;
        throw error;
      });
  }
  return gamblingIndex;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'search-gambling' || !Array.isArray(message.hosts)) return;
  loadGamblingIndex()
    .then((domains) => {
      respond(
        message.hosts.slice(0, 300).filter((hostname) => {
          if (typeof hostname !== 'string') return false;
          for (
            let host = hostname;
            host.includes('.');
            host = host.slice(host.indexOf('.') + 1)
          ) {
            if (domains.has(host)) return true;
          }
          return false;
        })
      );
    })
    .catch(() => respond([]));
  return true;
});

const imageTabs = new Map();
const imageQueues = new Map();

function imageKey(tabId) {
  return 'loaded-images:' + tabId;
}

function updateImages(tabId, change) {
  const key = imageKey(tabId);
  const pending = imageQueues.get(tabId) || Promise.resolve();
  const next = pending
    .catch(() => {})
    .then(async () => {
      if (!imageTabs.has(tabId)) {
        const stored = await chrome.storage.session.get(key);
        imageTabs.set(tabId, stored[key] || []);
      }
      const images = change(imageTabs.get(tabId));
      if (images === null) {
        imageTabs.delete(tabId);
        await chrome.storage.session.remove(key);
      } else if (images) {
        imageTabs.set(tabId, images);
        await chrome.storage.session.set({ [key]: images });
      }
    });
  imageQueues.set(tabId, next);
  next.catch(console.error).finally(() => {
    if (imageQueues.get(tabId) === next) imageQueues.delete(tabId);
  });
  return next;
}

const web = ['http://*/*', 'https://*/*'];
chrome.webRequest.onBeforeRequest.addListener(
  ({ tabId }) => {
    if (tabId >= 0) updateImages(tabId, () => []);
  },
  { urls: web, types: ['main_frame'] }
);

chrome.webRequest.onCompleted.addListener(
  ({ tabId, url, type, statusCode, responseHeaders }) => {
    if (tabId < 0 || statusCode >= 400 || url.length > 4096) return;
    const mime =
      responseHeaders?.find((header) => header.name.toLowerCase() === 'content-type')
        ?.value || '';
    const parsed = new URL(url);
    if (
      type !== 'image' &&
      !/^image\//i.test(mime) &&
      !/\.(?:png|webp|jpe?g|svg|avif|gif|bmp|ico)$/i.test(parsed.pathname)
    )
      return;
    parsed.hash = '';
    updateImages(tabId, (images) => {
      if (images.length >= 500 || images.includes(parsed.href)) return;
      return [...images, parsed.href];
    });
  },
  { urls: web, types: ['image'] },
  ['responseHeaders']
);

chrome.tabs.onRemoved.addListener((id) => updateImages(id, () => null));

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'loaded-images' || !Number.isInteger(message.tabId) || sender.tab)
    return;
  updateImages(message.tabId, () => {})
    .then(() => {
      respond(
        (imageTabs.get(message.tabId) || []).map((url) => ({
          source: { kind: 'resource', url },
          preview: url,
        }))
      );
    })
    .catch(() => respond([]));
  return true;
});

let customWork = Promise.resolve();
function updateCustomSites() {
  customWork = customWork
    .catch(() => {})
    .then(async () => {
      const data = await chrome.storage.local.get(['customDomains', 'enabled']);
      const domains = (data.customDomains || []).filter((x) => x !== 'slay-award.ru');
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [900001],
        addRules:
          domains.length && data.enabled !== false
            ? [
                {
                  id: 900001,
                  priority: 10,
                  action: {
                    type: 'redirect',
                    redirect: { extensionPath: '/blocked.html' },
                  },
                  condition: { requestDomains: domains, resourceTypes: ['main_frame'] },
                },
              ]
            : [],
      });
    })
    .catch(console.error);
}
chrome.storage.onChanged.addListener((changes) => {
  if (changes.customDomains || changes.enabled) updateCustomSites();
});
chrome.runtime.onInstalled.addListener(updateCustomSites);
chrome.runtime.onStartup.addListener(updateCustomSites);
chrome.webNavigation.onErrorOccurred.addListener(async (e) => {
  if (e.frameId !== 0 || e.error !== 'net::ERR_BLOCKED_BY_CLIENT') return;
  const host = new URL(e.url).hostname;
  if (host === 'slay-award.ru') return;
  const prefs = await chrome.storage.local.get(['enabled', 'bet', 'cases', 'gambling']);
  if (prefs.enabled === false) return;
  for (const [file, key] of [
    ['rules.json', 'bet'],
    ['cases.json', 'cases'],
    ['gambling.json', 'gambling'],
    ['gambling-extra.json', 'gambling'],
  ]) {
    if (prefs[key] === false) continue;
    const rules = await (await fetch(chrome.runtime.getURL(file))).json();
    if (
      rules.some((r) =>
        r.condition.requestDomains.some((d) => host === d || host.endsWith('.' + d))
      )
    ) {
      const tab = await chrome.tabs.get(e.tabId).catch(() => null);
      if (tab?.url === e.url || tab?.pendingUrl === e.url)
        await chrome.tabs.update(e.tabId, { url: chrome.runtime.getURL('blocked.html') });
      break;
    }
  }
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'save-deposit') return;
  if (sender.url !== chrome.runtime.getURL('blocked.html')) return;
  const amount = message.amount;
  if (
    !/^[a-z0-9-]{36}$/i.test(message.id) ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > 10000000000
  ) {
    respond({ ok: false });
    return;
  }
  chrome.storage.local
    .set({ ['saving:' + message.id]: { kopecks: amount, createdAt: Date.now() } })
    .then(() => respond({ ok: true }))
    .catch(() => respond({ ok: false }));
  return true;
});

let pinterestCache, pinterestPending;
function parsePinterestCats(html) {
  const found = new Map();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    const url =
      value.images?.orig?.url ||
      value.images?.['736x']?.url ||
      value.images?.['474x']?.url;
    if (
      url &&
      /^[0-9]+$/.test(String(value.id)) &&
      url.startsWith('https://i.pinimg.com/')
    ) {
      found.set(String(value.id), {
        url,
        pin: 'https://ru.pinterest.com/pin/' + value.id + '/',
      });
    }
    for (const child of Object.values(value))
      if (child && typeof child === 'object') visit(child);
  }
  try {
    visit(JSON.parse(html));
  } catch {}
  const scripts = html
    .split('<script')
    .slice(1)
    .map((part) => [null, part.slice(part.indexOf('>') + 1).split('</script>')[0]]);
  for (const match of scripts) {
    try {
      visit(JSON.parse(match[1]));
    } catch {}
  }
  return [...found.values()];
}
let pinterestBookmark;
async function loadPinterestCats(query = 'котик', more = false) {
  if (pinterestCache?.query !== query) {
    pinterestCache = undefined;
    pinterestBookmark = undefined;
  }
  if (!more && pinterestCache && Date.now() - pinterestCache.at < 600000)
    return pinterestCache.cats;
  if (pinterestPending) return pinterestPending;
  pinterestPending = (async () => {
    const response = await fetch(
      'https://ru.pinterest.com/search/pins/?q=' +
        encodeURIComponent(query) +
        '&rs=typed',
      { credentials: 'include', signal: AbortSignal.timeout(15000) }
    );
    if (!response.ok) throw Error('Pinterest unavailable');
    let cats = parsePinterestCats(await response.text());
    if (!cats.length || more) {
      const data = encodeURIComponent(
        JSON.stringify({
          options: {
            query,
            scope: 'pins',
            page_size: 25,
            ...(more && pinterestBookmark ? { bookmarks: [pinterestBookmark] } : {}),
          },
          context: {},
        })
      );
      const endpoint =
        'https://ru.pinterest.com/resource/BaseSearchResource/get/?source_url=' +
        encodeURIComponent('/search/pins/?q=' + query + '&rs=typed') +
        '&data=' +
        data;
      const result = await fetch(endpoint, {
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        signal: AbortSignal.timeout(15000),
      });
      if (result.ok) {
        const text = await result.text();
        cats = parsePinterestCats(text);
        try {
          const body = JSON.parse(text);
          pinterestBookmark =
            body.resource_response?.bookmark || body.resource?.options?.bookmarks?.[0];
        } catch {}
      }
    }
    if (!cats.length) throw Error('No pins returned');
    pinterestCache = { at: Date.now(), cats, query };
    return cats;
  })();
  try {
    return await pinterestPending;
  } finally {
    pinterestPending = undefined;
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    message.type !== 'pinterest-cats' ||
    sender.url !== chrome.runtime.getURL('blocked.html')
  )
    return;

  chrome.storage.local
    .get(['blockPicture', 'blockPictureQuery'])
    .then((data) => {
      const query =
        { cats: 'котик', dogs: 'собачки', hamsters: 'хомяки' }[data.blockPicture] ||
        String(data.blockPictureQuery || 'котик').slice(0, 150);
      return loadPinterestCats(query, message.more === true);
    })
    .then((cats) => respond({ cats }))
    .catch(() => respond({ cats: [] }));

  return true;
});
function pictureIdentity(url) {
  const path = new URL(url).pathname.split('/');
  return path.slice(-1)[0].split('.')[0];
}
let pictureQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    message.type !== 'choose-block-picture' ||
    sender.url !== chrome.runtime.getURL('blocked.html')
  )
    return;
  pictureQueue = pictureQueue
    .catch(() => {})
    .then(async () => {
      const unique = new Map();
      for (const item of (message.pictures || []).slice(0, 500)) {
        try {
          const image = new URL(item.url),
            pin = new URL(item.pin);
          if (image.hostname === 'i.pinimg.com' && pin.hostname.endsWith('pinterest.com'))
            unique.set(pictureIdentity(item.url), item);
        } catch {}
      }
      const pictures = [...unique.values()];
      if (!pictures.length) {
        respond({});
        return;
      }
      const data = await chrome.storage.local.get('pictureHistory');
      const history = data.pictureHistory || {};
      const seen = new Set(
        Object.keys(history).map((key) =>
          key.startsWith('http') ? pictureIdentity(key) : key
        )
      );
      const unseen = pictures.filter((item) => !seen.has(pictureIdentity(item.url)));
      if (!unseen.length) {
        respond({ exhausted: true });
        return;
      }
      const oldest = Math.min(...pictures.map((item) => Number(history[item.url]) || 0));
      const pool = unseen.length
        ? unseen
        : pictures.filter((item) => (Number(history[item.url]) || 0) === oldest);
      const picture = pool[Math.floor(Math.random() * pool.length)];
      history[pictureIdentity(picture.url)] = Date.now();
      const trimmed = Object.fromEntries(
        Object.entries(history)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3000)
      );
      await chrome.storage.local.set({ pictureHistory: trimmed });
      respond({ picture });
    })
    .catch(() => respond({}));
  return true;
});

importScripts('community-updates.js');
