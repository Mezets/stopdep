const COMMUNITY_URL =
  'https://raw.githubusercontent.com/Mezets/stopdep/main/filters/community.json';
let communityPending;
function validCommunity(data) {
  if (
    data?.format !== 'stopdep-community' ||
    data.version !== 1 ||
    typeof data.revision !== 'string' ||
    !Array.isArray(data.folders) ||
    !data.masks ||
    typeof data.masks !== 'object'
  )
    throw Error('Invalid community format');
  const entries = Object.entries(data.masks);
  if (entries.length > 2000 || data.folders.length > 200)
    throw Error('Community limit exceeded');
  for (const [key, mask] of entries) {
    if (
      !/^mask:[a-z0-9-]+$/i.test(key) ||
      !['blur', 'solid'].includes(mask?.mode) ||
      !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(mask[k])) ||
      mask.width <= 0 ||
      mask.height <= 0 ||
      mask.image
    )
      throw Error('Invalid community mask');
    const url = new URL(mask.page);
    if (
      url.protocol !== 'https:' ||
      !['www.twitch.tv', 'twitch.tv', 'slay-award.ru'].includes(url.hostname)
    )
      throw Error('Invalid community page');
    if (mask.anchor && (typeof mask.anchor !== 'string' || mask.anchor.length > 4000))
      throw Error('Invalid anchor');
  }
  for (const folder of data.folders)
    if (
      typeof folder?.id !== 'string' ||
      !/^[a-z0-9-]{1,80}$/i.test(folder.id) ||
      typeof folder.name !== 'string' ||
      folder.name.length > 100
    )
      throw Error('Invalid folder');
  return data;
}
async function mergeCommunity(preset) {
  validCommunity(preset);
  const local = await chrome.storage.local.get(null);
  if (local.communityEnabled !== true) return;
  const previous = local.communityManaged || {};
  const managed = { ...previous };
  const changes = {};
  for (const [key, mask] of Object.entries(preset.masks)) {
    const fingerprint = JSON.stringify(mask),
      existing = local[key];
    if (key in previous) {
      if (existing && JSON.stringify(existing) === previous[key]) {
        changes[key] = mask;
        managed[key] = fingerprint;
      }
    } else if (!existing) {
      changes[key] = mask;
      managed[key] = fingerprint;
    } else if (JSON.stringify(existing) === fingerprint) managed[key] = fingerprint;
  }
  const removed = [];
  for (const key of Object.keys(previous))
    if (!(key in preset.masks)) {
      if (local[key] && JSON.stringify(local[key]) === previous[key]) removed.push(key);
      delete managed[key];
    }
  const folders = Array.isArray(local.maskFolders) ? local.maskFolders : [];
  const ids = new Set(folders.map((f) => f.id));
  changes.maskFolders = [...folders, ...preset.folders.filter((f) => !ids.has(f.id))];
  Object.assign(changes, {
    communityManaged: managed,
    communityRevision: preset.revision,
    communityCheckedAt: Date.now(),
    communityError: '',
  });
  await chrome.storage.local.set(changes);
  if (removed.length) await chrome.storage.local.remove(removed);
}
function updateCommunity() {
  if (communityPending) return communityPending;
  communityPending = (async () => {
    const local = await chrome.storage.local.get('communityEnabled');
    if (local.communityEnabled !== true) return;
    const response = await fetch(COMMUNITY_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('GitHub: ' + response.status);
    const text = await response.text();
    if (text.length > 2000000) throw Error('Filter file too large');
    await mergeCommunity(JSON.parse(text));
  })()
    .catch(async (error) => {
      await chrome.storage.local.set({ communityError: error.message });
      throw error;
    })
    .finally(() => {
      communityPending = null;
    });
  return communityPending;
}
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const response = await fetch(chrome.runtime.getURL('community.json'));
    await mergeCommunity(await response.json());
  } catch (error) {
    console.error(error);
  }
  await chrome.alarms.create('community-update', { periodInMinutes: 360 });
  updateCommunity().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('community-update', { periodInMinutes: 360 });
  updateCommunity().catch(() => {});
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'community-update') updateCommunity().catch(() => {});
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'update-community' || sender.id !== chrome.runtime.id) return;
  updateCommunity()
    .then(() => respond({ ok: true }))
    .catch((error) => respond({ error: error.message }));
  return true;
});
