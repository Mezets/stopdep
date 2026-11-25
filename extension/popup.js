function twitchProfile(address) {
  try {
    const url = new URL(address);
    if (!/(^|\.)twitch\.tv$/.test(url.hostname)) return null;
    const parts = url.pathname.toLowerCase().split('/').filter(Boolean);
    return parts[0] === 'popout' ? parts[1] : parts[0] || 'home';
  } catch {
    return null;
  }
}

const controls = ['enabled', 'bet', 'cases', 'gambling', 'banners', 'twitchProcessing'];
const $ = (id) => document.getElementById(id);
const status = $('status');
let activeTab;
let page;
let busy = false;
let shownMask;
let editingKey;
let catalogRequested = false;
const selectedMasks = new Set();
let catalogMasks = [];
let previewMask;
let switchingMask = false;

function updateShowButtons() {
  for (const button of document.querySelectorAll('[data-mask-key]')) {
    const shown =
      button.dataset.maskKey === shownMask || button.dataset.maskKey === previewMask;
    button.textContent = t(shown ? 'Скрыть' : 'Показать');
    button.setAttribute('aria-pressed', String(shown));
    button.setAttribute(
      'aria-label',
      button.textContent + ' · ' + t('Область') + ' ' + button.dataset.maskIndex
    );
  }
}

function report(message = '') {
  status.textContent = localizedStatus(message);
  status.hidden = !message;
}

async function refresh() {
  const data = await chrome.storage.local.get(null);
  const kopecks = Object.entries(data)
    .filter(([key]) => key.startsWith('saving:'))
    .reduce(
      (sum, [, value]) => sum + (Number.isSafeInteger(value.kopecks) ? value.kopecks : 0),
      0
    );
  const amount = new Intl.NumberFormat(data.language === 'en' ? 'en-GB' : 'ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(kopecks / 100);
  $('savedMoney').textContent =
    (data.language === 'en' ? 'Saved you ' : 'Сохранили тебе ') + amount;
  const language = data.language === 'en' ? 'en' : 'ru';
  if (language !== locale || !$('releaseList').children.length) setLanguage(language);
  if (editingKey && !data[editingKey]) finishEdit();
  for (const key of controls) $(key).checked = data[key] !== false;
  if (document.activeElement !== $('lingerMs')) $('lingerMs').value = data.lingerMs ?? 0;
  catalogMasks = Object.entries(data)
    .filter(([key]) => key.startsWith('mask:'))
    .map(([, mask]) => mask);
  updateCatalogMarks();
  $('undoLast').disabled = !data.lastMaskAction;
  const folders = Array.isArray(data.maskFolders) ? data.maskFolders : [];
  const selectedFolder = $('folderFilter').value;
  $('folderFilter').replaceChildren(
    ...[
      ['*', t('Все области')],
      ['', t('Без папки')],
      ...folders.map((f) => [f.id, f.name]),
    ].map(([value, name]) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = name;
      return o;
    })
  );
  $('folderFilter').value =
    selectedFolder === '*' ||
    selectedFolder === '' ||
    folders.some((f) => f.id === selectedFolder)
      ? selectedFolder
      : '*';
  for (const key of selectedMasks) if (!data[key]) selectedMasks.delete(key);
  $('bulkMove').replaceChildren(
    ...[
      ['?', t('Переместить выбранные…')],
      ['', t('Без папки')],
      ...folders.map((f) => [f.id, f.name]),
    ].map(([value, name]) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = name;
      return o;
    })
  );
  $('bulkMove').disabled = !selectedMasks.size;
  $('selectionCount').textContent = t('Выбрано') + ': ' + selectedMasks.size;
  const currentFolder = folders.find((f) => f.id === $('folderFilter').value);
  $('folderEditForm').hidden = !currentFolder;
  if (document.activeElement !== $('folderRename'))
    $('folderRename').value = currentFolder?.name || '';
  const search = $('maskSearch').value.trim().toLowerCase();
  const masks = Object.entries(data)
    .filter(
      ([key, mask]) =>
        key.startsWith('mask:') &&
        (sameSite(mask.page) || (mask.source && !mask.pageOnly))
    )
    .filter(
      ([, mask]) =>
        !search ||
        [
          mask.name,
          folders.find((f) => f.id === mask.folderId)?.name,
          mask.page,
          mask.source?.url,
          mask.createdAt ? new Date(mask.createdAt).toLocaleString() : '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)
    )
    .filter(
      ([, mask]) =>
        $('folderFilter').value === '*' ||
        (mask.folderId || '') === $('folderFilter').value
    );
  $('clearPageMasks').disabled = !masks.length;
  const editor = $('editActions');
  $('saved').replaceChildren(
    ...masks.map(([key, mask], index) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'mask-label';
      const name = document.createElement('input');
      name.className = 'mask-name';
      name.maxLength = 100;
      name.value = mask.name || t('Область') + ' ' + (index + 1);
      name.setAttribute('aria-label', t('Название области'));
      name.onchange = () =>
        updateMaskMetadata(key, { name: name.value.trim().slice(0, 100) }).catch(
          (error) => report(error.message)
        );
      label.append(name);
      const kind = document.createElement('small');
      kind.textContent = t(
        { image: 'картинка', blur: 'размытие', solid: 'заливка' }[mask.mode] || 'размытие'
      );
      label.append(kind);
      const timestamp = document.createElement('small');
      timestamp.className = 'mask-created';
      const date = Number.isFinite(mask.createdAt) ? new Date(mask.createdAt) : null;
      if (date && !Number.isNaN(date.getTime())) {
        timestamp.textContent = new Intl.DateTimeFormat(
          locale === 'en' ? 'en-GB' : 'ru-RU',
          {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
          }
        ).format(date);
      } else timestamp.textContent = t('Дата добавления неизвестна');
      label.append(timestamp);
      const selection = document.createElement('input');
      selection.type = 'checkbox';
      selection.className = 'mask-select';
      selection.checked = selectedMasks.has(key);
      selection.setAttribute('aria-label', t('Выбрать область'));
      selection.onchange = () => {
        if (selection.checked) selectedMasks.add(key);
        else selectedMasks.delete(key);
        $('bulkMove').disabled = !selectedMasks.size;
        $('selectionCount').textContent = t('Выбрано') + ': ' + selectedMasks.size;
      };
      item.append(selection, label);
      const remove = document.createElement('button');
      remove.textContent = t('Удалить');
      remove.setAttribute(
        'aria-label',
        t('Удалить') + ' · ' + t('Область') + ' ' + (index + 1)
      );
      remove.onclick = async () => {
        await chrome.storage.local.set({ lastMaskAction: { key, before: mask } });
        await chrome.storage.local.remove(key);
      };

      const actions = document.createElement('span');
      actions.className = 'mask-actions';
      const show = document.createElement('button');
      show.dataset.maskKey = key;
      show.dataset.maskIndex = String(index + 1);
      show.onclick = () => toggleMask(key, mask).catch((error) => report(error.message));
      const edit = document.createElement('button');
      edit.textContent = t('Править');
      edit.onclick = () => beginEdit(key, mask, item);
      actions.append(show, edit, remove);
      item.append(actions);
      const destination = document.createElement('select');
      destination.className = 'mask-folder';
      destination.setAttribute('aria-label', t('Переместить в папку'));
      for (const [value, text] of [
        ['', t('Без папки')],
        ...folders.map((f) => [f.id, f.name]),
      ]) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = text;
        destination.append(o);
      }
      destination.value = mask.folderId || '';
      destination.onchange = () =>
        updateMaskMetadata(key, { folderId: destination.value }).catch((error) =>
          report(error.message)
        );
      item.append(destination);

      return item;
    })
  );
  if (!data[shownMask]) shownMask = undefined;
  if (previewMask && !data[previewMask]) clearSelection();
  updateShowButtons();
  $('pick').disabled = busy || !page || !$('enabled').checked;
  $('pickPage').disabled = $('pick').disabled;
}

for (const button of document.querySelectorAll('[data-tab]')) {
  button.onclick = () => {
    for (const tab of document.querySelectorAll('[data-tab]')) {
      const selected = tab === button;
      tab.setAttribute('aria-pressed', String(selected));
      $(tab.dataset.tab).hidden = !selected;
    }
    if (button.dataset.tab === 'regions' && !catalogRequested) {
      catalogRequested = true;
      $('browseImages').onclick();
    }
  };
}

for (const key of controls) {
  $(key).onchange = () =>
    chrome.storage.local
      .set({ [key]: $(key).checked })
      .catch((error) => report(error.message));
}

function mode() {
  return document.querySelector('[name=mode]:checked').value;
}
for (const radio of document.querySelectorAll('[name=mode]')) {
  radio.onchange = () => {
    $('fileRow').hidden = mode() !== 'image';
    $('strengthRow').hidden = mode() !== 'blur';
    $('colorRow').hidden = mode() !== 'solid';
    report();
  };
}
$('strength').oninput = () => {
  $('strengthValue').value = $('strength').value;
};

async function readImage(input = $('file')) {
  const file = input.files[0];
  if (
    !file ||
    !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
    file.size > 600 * 1024
  ) {
    throw new Error('Выбери PNG, JPG, WebP или GIF до 600 КБ.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать картинку.'));
    reader.readAsDataURL(file);
  });
}

async function startPicking(pageRegion) {
  if (busy) return;
  busy = true;
  $('pick').disabled = true;
  $('pickPage').disabled = true;
  report();
  try {
    const selected = mode();
    const image = selected === 'image' ? await readImage() : null;
    const selectionTarget = pageRegion ? 'page' : 'media';
    const options = {
      type: 'pick-mask-' + selectionTarget,
      page,
      language: locale,
      mode: selected,
      image,
      color: $('coverColor').value,
      strength: Number($('strength').value),
    };
    let response = await chrome.tabs
      .sendMessage(activeTab.id, options, { frameId: 0 })
      .catch(() => null);
    if (response?.retry) {
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        response = await chrome.tabs
          .sendMessage(activeTab.id, options, { frameId: 0 })
          .catch(() => null);
        if (response?.target === selectionTarget) break;
      }
    }
    if (response?.target !== selectionTarget)
      throw new Error('Перезагрузи страницу после обновления СтопДЕП и попробуй снова.');
    window.close();
  } catch (error) {
    report(error.message);
  } finally {
    busy = false;
    $('pick').disabled = !page || !$('enabled').checked;
    $('pickPage').disabled = $('pick').disabled;
  }
}

$('pick').onclick = () => startPicking(false);
$('pickPage').onclick = () => startPicking(true);

(async () => {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (/^https?:/.test(activeTab?.url || '')) {
    const url = new URL(activeTab.url);
    page = url.origin + url.pathname + url.search;
  }
  if (activeTab?.id) {
    const state = await chrome.tabs
      .sendMessage(activeTab.id, { type: 'highlight-status' }, { frameId: 0 })
      .catch(() => null);
    shownMask = state?.key || undefined;
  }
  await refresh();
  chrome.storage.onChanged.addListener(() =>
    refresh().catch((error) => report(error.message))
  );
})().catch((error) => report(error.message));
const catalogBox = $('imageCatalog');
const assets = $('imageAssets');
const stage = $('imageStage');
const preview = $('assetPreview');
const video = $('assetVideo');
const overlay = $('assetSelection');
const saveArea = $('saveAsset');
let entries = [];
let selection;
let dragStart;

function clearSelection() {
  if (previewMask) {
    previewMask = undefined;
    updateShowButtons();
  }
  selection = null;
  overlay.hidden = true;
  saveArea.disabled = true;
}

function closeCatalog() {
  clearSelection();
  dragStart = null;
  video.pause();
  catalogBox.hidden = true;
}

$('closeCatalog').onclick = closeCatalog;

function fileMasks(entry) {
  if (!entry) return [];
  return catalogMasks.filter(
    (mask) =>
      mask.source?.url === entry.source.url &&
      (!mask.pageOnly ||
        (mask.page === page && ['img', 'svg', 'video'].includes(mask.source.kind)))
  );
}

function updateCatalogMarks() {
  for (const option of assets.options) {
    if (!option.dataset.label) option.dataset.label = option.text;
    const count = fileMasks(entries[Number(option.value)]).length;
    option.text = count
      ? '● ' + option.dataset.label + ' [' + count + ']'
      : option.dataset.label;
  }
  $('savedAssetAreas').replaceChildren(
    ...fileMasks(entries[Number(assets.value)]).map((mask) => {
      const rect = document.createElement('span');
      rect.style.left = 100 * mask.x + '%';
      rect.style.top = 100 * mask.y + '%';
      rect.style.width = 100 * mask.width + '%';
      rect.style.height = 100 * mask.height + '%';
      return rect;
    })
  );
}

function changeAsset() {
  clearSelection();
  const entry = entries[Number(assets.value)];
  const isVideo = entry?.source.kind === 'video';
  video.pause();
  video.hidden = !isVideo;
  $('stepVideo').hidden = !isVideo;
  preview.hidden = !entry || isVideo;
  if (isVideo) video.src = entry.preview;
  else if (entry) preview.src = entry.preview;
  updateCatalogMarks();
}

$('browseImages').onclick = async () => {
  catalogRequested = true;
  report();
  if (!page) return report('Открой вкладку с сайтом.');
  catalogBox.hidden = false;
  try {
    const selectedUrl = entries[Number(assets.value)]?.source.url;
    const [network, pageAssets] = await Promise.all([
      chrome.runtime
        .sendMessage({ type: 'loaded-images', tabId: activeTab.id })
        .catch(() => []),
      chrome.tabs
        .sendMessage(activeTab.id, { type: 'image-catalog' }, { frameId: 0 })
        .catch(() => []),
    ]);
    const unique = new Map();
    for (const entry of [...(network || []), ...(pageAssets || [])]) {
      const existing = unique.get(entry.source.url);
      if (!existing || entry.source.kind !== 'resource')
        unique.set(entry.source.url, entry);
    }
    const priority = (entry) => (/preloader|winline/i.test(entry.source.url) ? 0 : 1);
    entries = [...unique.values()].sort((a, b) => priority(a) - priority(b));
    if (!entries.length) {
      assets.replaceChildren();
      updateCatalogMarks();
      preview.hidden = true;
      video.hidden = true;
      clearSelection();
      return report('Список пока пуст. Перезагрузи сайт и снова открой «Области».');
    }
    assets.replaceChildren(
      ...entries.map((entry, index) => {
        const name = entry.source.url.startsWith('inline-svg:')
          ? t('Встроенный SVG')
          : new URL(entry.source.url).pathname.split('/').pop() || entry.source.url;
        return new Option(index + 1 + '. ' + name, index);
      })
    );
    assets.selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.source.url === selectedUrl)
    );
    changeAsset();
  } catch {
    report('Обнови вкладку и открой каталог ещё раз.');
  }
};
assets.onchange = changeAsset;
preview.onerror = () =>
  report('Сайт не отдал этот файл для предпросмотра. Выбери другое изображение.');

function point(event) {
  const media = video.hidden ? preview : video;
  const rect = media.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  };
}

stage.onpointerdown = (event) => {
  if (event.button !== 0) return;
  dragStart = point(event);
  if (!dragStart || (!preview.hidden && (!preview.complete || !preview.naturalWidth))) {
    dragStart = null;
    return;
  }
  clearSelection();
  stage.setPointerCapture(event.pointerId);
};
stage.onpointermove = (event) => {
  if (!dragStart) return;
  const position = point(event);
  if (!position) return;
  selection = {
    x: Math.min(position.x, dragStart.x),
    y: Math.min(position.y, dragStart.y),
    width: Math.abs(position.x - dragStart.x),
    height: Math.abs(position.y - dragStart.y),
  };
  overlay.style.backgroundColor = mode() === 'solid' ? coverColor.value : '';
  overlay.style.left = 100 * selection.x + '%';
  overlay.style.top = 100 * selection.y + '%';
  overlay.style.width = 100 * selection.width + '%';
  overlay.style.height = 100 * selection.height + '%';
  overlay.hidden = false;
};
stage.onpointerup = () => {
  dragStart = null;
  if (selection && selection.width > 0.005 && selection.height > 0.005)
    saveArea.disabled = false;
};
stage.onpointercancel = () => {
  dragStart = null;
  clearSelection();
};
$('stepVideo').onclick = () => {
  if (!video.hidden && Number.isFinite(video.duration))
    video.currentTime = Math.min(video.duration, video.currentTime + 0.5);
};
saveArea.onclick = async () => {
  if (!selection) return;
  const source = entries[Number(assets.value)]?.source;
  if (!source) return;
  try {
    const area = { ...selection };
    const bitmapSize = preview.hidden
      ? null
      : { width: preview.naturalWidth, height: preview.naturalHeight };
    const chosen = mode();
    const image = chosen === 'image' ? await readImage() : null;
    const newKey = 'mask:' + crypto.randomUUID();
    await chrome.storage.local.set({
      lastMaskAction: { key: newKey, before: null },
      [newKey]: {
        ...area,
        createdAt: Date.now(),
        page,
        source,
        bitmapSize,
        blurVersion: 2,
        mode: chosen,
        image,
        color: $('coverColor').value,
        strength: Number($('strength').value),
      },
    });
    clearSelection();
    report('Область сохранена.');
  } catch (error) {
    report(error.message);
  }
};

function delayValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(10000, Math.round(number))) : 0;
}

$('lingerMs').onchange = async () => {
  const lingerMs = delayValue($('lingerMs').value);
  $('lingerMs').value = lingerMs;
  try {
    await chrome.storage.local.set({ lingerMs });
  } catch (error) {
    report(error.message);
  }
};

$('exportSettings').onclick = async () => {
  try {
    const data = await chrome.storage.local.get(null);
    const settings = Object.fromEntries(
      controls.map((key) => [key, data[key] !== false])
    );
    settings.maskFolders = data.maskFolders || [];
    settings.wordReplacements = data.wordReplacements || {};
    settings.customDomains = data.customDomains || [];
    settings.lingerMs = delayValue(data.lingerMs);
    settings.language = data.language === 'en' ? 'en' : 'ru';
    const masks = Object.fromEntries(
      Object.entries(data).filter(([key]) => key.startsWith('mask:'))
    );
    const body = JSON.stringify(
      { format: 'stopdep-backup', version: 1, settings, masks },
      null,
      2
    );
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'StopDEP-settings-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (error) {
    report(error.message);
  }
};

function validBackupMask(mask) {
  if (!mask || typeof mask !== 'object' || !/^https?:\/\//i.test(mask.page || ''))
    return false;
  if (!['blur', 'solid', 'image'].includes(mask.mode)) return false;
  if (
    !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(mask[key])) ||
    mask.width <= 0 ||
    mask.height <= 0
  )
    return false;
  if (mask.anchor) {
    if (typeof mask.anchor !== 'string') return false;
    try {
      document.querySelector(mask.anchor);
    } catch {
      return false;
    }
  }
  if (
    mask.source &&
    ![
      'img',
      'resource',
      'background',
      'svg',
      'video',
      'video-player',
      '::before',
      '::after',
    ].includes(mask.source.kind)
  )
    return false;
  if (
    mask.source &&
    mask.source.kind !== 'video-player' &&
    typeof mask.source.url !== 'string'
  )
    return false;
  if (
    mask.mode === 'image' &&
    (typeof mask.image !== 'string' ||
      !/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(mask.image) ||
      mask.image.length > 850000)
  )
    return false;
  return true;
}

$('importSettings').onclick = () => $('backupFile').click();
$('backupFile').onchange = async () => {
  const input = $('backupFile');
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  report();
  try {
    if (file.size > 15 * 1024 * 1024)
      throw new Error('Файл резервной копии слишком большой.');
    const backup = JSON.parse(await file.text());
    if (
      backup?.version !== 1 ||
      !['stopdep-backup', 'stopdep-masks'].includes(backup.format)
    ) {
      throw new Error('Выбери резервную копию СтопДЕП.');
    }
    const values = {};
    for (const key of controls) {
      if (typeof backup.settings?.[key] === 'boolean') values[key] = backup.settings[key];
    }
    if (typeof backup.settings?.lingerMs === 'number')
      values.lingerMs = delayValue(backup.settings.lingerMs);
    if (['ru', 'en'].includes(backup.settings?.language))
      values.language = backup.settings.language;
    if (
      backup.settings?.wordReplacements &&
      typeof backup.settings.wordReplacements === 'object'
    ) {
      values.wordReplacements = Object.fromEntries(
        Object.entries(backup.settings.wordReplacements).filter(
          ([a, b]) =>
            a.length > 0 && a.length < 150 && typeof b === 'string' && b.length < 500
        )
      );
    }
    if (Array.isArray(backup.settings?.customDomains))
      values.customDomains = backup.settings.customDomains.filter(
        (d) =>
          typeof d === 'string' &&
          /^[a-z0-9.-]+$/i.test(d) &&
          d.includes('.') &&
          d !== 'slay-award.ru'
      );
    if (Array.isArray(backup.settings?.maskFolders))
      values.maskFolders = backup.settings.maskFolders
        .filter(
          (f) =>
            f &&
            typeof f.id === 'string' &&
            /^[a-z0-9-]{1,80}$/i.test(f.id) &&
            typeof f.name === 'string' &&
            f.name.trim()
        )
        .map((f) => ({ id: f.id, name: f.name.trim().slice(0, 80) }));
    let count = 0;
    for (const [key, mask] of Object.entries(backup.masks || {})) {
      if (!/^mask:[a-z0-9-]+$/i.test(key) || !validBackupMask(mask)) continue;
      values[key] = mask;
      count++;
    }
    if (!Object.keys(values).length)
      throw new Error('В файле нет подходящих настроек или областей.');
    await chrome.storage.local.set(values);
    report('Импорт завершён · областей: ' + count);
  } catch (error) {
    report('Импорт не выполнен. ' + error.message);
  }
};

async function toggleMask(key, mask) {
  if (switchingMask) return;
  switchingMask = true;
  try {
    report();
    const wasShown = shownMask === key || previewMask === key;
    if (previewMask) closeCatalog();
    if (shownMask && activeTab?.id) {
      await chrome.tabs
        .sendMessage(activeTab.id, { type: 'hide-highlight' }, { frameId: 0 })
        .catch(() => null);
      shownMask = undefined;
    }
    if (!wasShown) await showMask(key, mask);
  } finally {
    switchingMask = false;
    updateShowButtons();
  }
}

async function showMask(key, mask) {
  report();
  const result =
    activeTab?.id &&
    (await chrome.tabs
      .sendMessage(activeTab.id, { type: 'show-mask', key }, { frameId: 0 })
      .catch(() => null));
  if (result?.ok) {
    shownMask = key;
    return report('Область выделена на странице.');
  }
  if (!mask.source?.url)
    return report('Эта область сейчас недоступна. Открой нужный кадр или изображение.');
  if (!entries.some((entry) => entry.source.url === mask.source.url))
    await $('browseImages').onclick();
  let index = entries.findIndex((entry) => entry.source.url === mask.source.url);
  if (index < 0 && /^https?:\/\//i.test(mask.source.url)) {
    index = entries.length;
    entries.push({ source: mask.source, preview: mask.source.url });
    const name =
      new URL(mask.source.url).pathname.split('/').pop() || t('Сохранённый файл');
    assets.add(new Option(name, index));
  }
  if (index < 0)
    return report(
      'Предпросмотр недоступен. Открой страницу или слайд с этим изображением.'
    );
  catalogBox.hidden = false;
  assets.value = String(index);
  changeAsset();
  overlay.style.backgroundColor = '';
  overlay.style.left = 100 * mask.x + '%';
  overlay.style.top = 100 * mask.y + '%';
  overlay.style.width = 100 * mask.width + '%';
  overlay.style.height = 100 * mask.height + '%';
  overlay.hidden = false;
  previewMask = key;
  stage.scrollIntoView({ block: 'nearest' });
  report('Рамка показывает сохранённую область.');
}

for (const button of document.querySelectorAll('[data-language]')) {
  button.onclick = async () => {
    const language = button.dataset.language;
    if (language === locale) return;
    try {
      await chrome.storage.local.set({ language });
      report();
    } catch (error) {
      report(error.message);
    }
  };
}

function updateEditInputs() {
  const chosen = $('editMode').value;
  $('editStrengthRow').hidden = chosen !== 'blur';
  $('editFileRow').hidden = chosen !== 'image';
  $('editColorRow').hidden = chosen !== 'solid';
}
$('editMode').onchange = updateEditInputs;
$('editStrength').oninput = () => {
  $('editStrengthValue').value = $('editStrength').value;
};

function beginEdit(key, mask, item) {
  if (editingKey === key) {
    finishEdit();
    return;
  }
  editingKey = key;
  $('editFile').value = '';
  $('editMode').value = mask.mode;
  const legacy = mask.source && !mask.pageOnly && mask.blurVersion !== 2;
  $('editStrength').value = Math.min(
    140,
    (Number(mask.strength) || 24) * (legacy ? 2 : 1)
  );
  $('editStrength').oninput();
  $('editColor').value = /^#[0-9a-f]{6}$/i.test(mask.color || '')
    ? mask.color
    : '#151515';
  updateEditInputs();
  const editor = $('editActions');
  item.append(editor);
  editor.hidden = false;
  $('editMode').focus({ preventScroll: true });
  editor.scrollIntoView({ block: 'nearest' });
}

function finishEdit() {
  editingKey = undefined;
  $('editFile').value = '';
  const editor = $('editActions');
  editor.hidden = true;
  $('editorHome').append(editor);
}

$('cancelEdit').onclick = finishEdit;
$('editActions').onsubmit = async (event) => {
  event.preventDefault();
  const key = editingKey;
  if (!key) return;
  const chosen = $('editMode').value;
  const strength = Number($('editStrength').value);
  const color = $('editColor').value;
  $('saveEdit').disabled = true;
  try {
    const current = (await chrome.storage.local.get(key))[key];
    if (!current) throw new Error('Область уже удалена.');
    let image = null;
    if (chosen === 'image') {
      const file = $('editFile');
      image =
        current.mode === 'image' && !file.files.length
          ? current.image
          : await readImage(file);
    }
    if (editingKey !== key) return;
    await chrome.storage.local.set({ lastMaskAction: { key, before: current } });
    await chrome.storage.local.set({
      [key]: { ...current, mode: chosen, image, strength, color, blurVersion: 2 },
    });
    if (editingKey === key) finishEdit();
    report('Область сохранена.');
  } catch (error) {
    report(error.message);
  } finally {
    $('saveEdit').disabled = false;
  }
};

function sameSite(address) {
  try {
    const a = new URL(address),
      b = new URL(page);
    if (twitchProfile(address) && twitchProfile(page))
      return twitchProfile(address) === twitchProfile(page);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}

let clearedMasks = {};
$('clearPageMasks').onclick = async () => {
  try {
    const data = await chrome.storage.local.get(null);
    const candidates = Object.fromEntries(
      Object.entries(data).filter(
        ([key, mask]) =>
          key.startsWith('mask:') &&
          (sameSite(mask.page) || (mask.source && !mask.pageOnly))
      )
    );
    if (!Object.keys(candidates).length) return;
    await chrome.storage.local.remove(Object.keys(candidates));
    clearedMasks = { ...clearedMasks, ...candidates };
    $('undoClearMasks').hidden = false;
    report(t('Маски сайта удалены'));
  } catch (error) {
    report(error.message);
  }
};
$('undoClearMasks').onclick = async () => {
  try {
    await chrome.storage.local.set(clearedMasks);
    clearedMasks = {};
    $('undoClearMasks').hidden = true;
    report();
  } catch (error) {
    report(error.message);
  }
};

function addEditorRow(kind, first = '', second = '') {
  const row = document.createElement('div');
  row.className = 'custom-row';
  const input = document.createElement('input');
  input.value = first;
  input.placeholder = kind === 'words' ? 'Название' : 'Сайт';
  input.setAttribute('aria-label', input.placeholder);
  row.append(input);
  if (kind === 'words') {
    const replacement = document.createElement('input');
    replacement.value = second;
    replacement.placeholder = 'Замена';
    replacement.setAttribute('aria-label', 'Замена');
    row.append(replacement);
  }
  const remove = document.createElement('button');
  remove.textContent = '×';
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Удалить строку');
  remove.onclick = () => row.remove();
  row.append(remove);
  $(kind === 'words' ? 'wordRows' : 'siteRows').append(row);
  return input;
}
$('addWord').onclick = () => addEditorRow('words').focus();
$('addSite').onclick = () => addEditorRow('sites').focus();
chrome.storage.local.get(['wordReplacements', 'customDomains']).then((data) => {
  const defaults = {
    депни: 'проеби деньги',
    winline: 'svinline',
    винлайн: 'свинлайн',
    '1win': '1слив',
    betboom: 'БетСлив',
    бетбум: 'БетСлив',
    фонбет: 'ФонСлив',
    fonbet: 'ФонСлив',
    ggdrop: 'GG твоим деньгам',
    pari: 'Пари — деньги испарились',
    olimpbet: 'ОлимпМинус',
    олимпбет: 'ОлимпМинус',
    'лига ставок': 'Лига остатков',
    марафон: 'Марафон до нуля',
    marathon: 'Marathon to Zero',
    'пари-матч': 'Пари-Минус',
    parimatch: 'Пари-Минус',
    stoiximan: 'Стоишь без денег',
    betsson: 'Бедсон',
    bet365: 'Минус365',
    bwin: 'bLose',
    netbet: 'НетБабок',
    sportingbet: 'SportingDebt',
    'winline.kz': 'svinline.kz',
    'case battle': 'Слив Батл',
    'case-battle': 'Слив-Батл',
    casebattle: 'СливБатл',
    'кейс батл': 'Кошелёк на батл',
    caser: 'Кейсер — хрен тебе дроп',
    кейсер: 'Кейсер — хрен тебе дроп',
    upgrader: 'Даунгрейдер кошелька',
    'skin.club': 'Скинул бабки клуб',
    skinclub: 'Скинул бабки клуб',
    hellcase: 'Ад для баланса',
    'key-drop': 'Ключ в минус',
    keydrop: 'Ключ в минус',
    farmskins: 'Ферма твоих денег',
    datdrop: 'ДатСлив',
    'clash.gg': 'Клэш твоей зарплаты',
    rustclash: 'Ржавый слив',
    rustchance: 'Шанс остаться без штанов',
    rustypot: 'Ржавая дыра',
    rustyloot: 'Ржавый лутосос',
    dota2hunt: 'Охота на твой кошелёк',
    dota2bestyolo: 'YOLO твоим деньгам',
    dota2cases: 'ДотаКейсы — минус маны и денег',
  };
  for (const [a, b] of Object.entries({ ...defaults, ...data.wordReplacements }))
    addEditorRow('words', a, b);
  for (const domain of data.customDomains || []) addEditorRow('sites', domain);
});
$('saveWords').onclick = async () => {
  try {
    const replacements = {};
    for (const row of $('wordRows').children) {
      const inputs = row.querySelectorAll('input');
      const name = inputs[0].value.trim();
      if (name) replacements[name] = inputs[1].value;
    }
    const domains = [];
    for (const row of $('siteRows').children) {
      const value = row.querySelector('input').value.trim();
      if (!value) continue;
      const host = new URL(value.includes('://') ? value : 'https://' + value).hostname;
      if (!host.includes('.') || host === 'slay-award.ru')
        throw Error('Проверь сайт: ' + value);
      domains.push(host);
    }
    await chrome.storage.local.set({
      wordReplacements: replacements,
      customDomains: [...new Set(domains)],
    });
    report('Сохранено. Перезагрузи страницу');
  } catch (error) {
    report(error.message);
  }
};

function updatePictureChoice() {
  $('pictureSelected').textContent = $('blockPicture').selectedOptions[0].textContent;
  for (const button of document.querySelectorAll('[data-picture]'))
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.picture === $('blockPicture').value)
    );
  $('blockPictureCustom').hidden = $('blockPicture').value !== 'custom';
}
chrome.storage.local.get(['blockPicture', 'blockPictureQuery']).then((data) => {
  $('blockPicture').value = data.blockPicture || 'cats';
  $('blockPictureQuery').value = data.blockPictureQuery || '';
  updatePictureChoice();
});
$('blockPicture').onchange = async () => {
  updatePictureChoice();
  await chrome.storage.local.set({ blockPicture: $('blockPicture').value });
};
$('blockPictureQuery').onchange = () =>
  chrome.storage.local.set({ blockPictureQuery: $('blockPictureQuery').value.trim() });

function closePictureOptions() {
  $('pictureOptions').hidden = true;
  $('pictureSelectButton').setAttribute('aria-expanded', 'false');
}
$('pictureSelectButton').onclick = () => {
  const open = $('pictureOptions').hidden;
  $('pictureOptions').hidden = !open;
  $('pictureSelectButton').setAttribute('aria-expanded', String(open));
  if (open) $('pictureOptions').querySelector('[aria-pressed="true"]')?.focus();
};
for (const button of document.querySelectorAll('[data-picture]')) {
  button.onclick = async () => {
    $('blockPicture').value = button.dataset.picture;
    updatePictureChoice();
    closePictureOptions();
    $('pictureSelectButton').focus();
    try {
      await $('blockPicture').onchange();
    } catch (error) {
      report(error.message);
    }
  };
}
document.addEventListener('click', (event) => {
  if (!$('pictureSettings').contains(event.target)) closePictureOptions();
});
$('pictureSettings').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closePictureOptions();
    $('pictureSelectButton').focus();
  }
  const options = [...document.querySelectorAll('[data-picture]')];
  const index = options.indexOf(document.activeElement);
  if (index >= 0 && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    options[
      (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length
    ].focus();
  }
});
$('maskSearch').oninput = () => refresh().catch((error) => report(error.message));
$('undoLast').onclick = async () => {
  const data = await chrome.storage.local.get('lastMaskAction');
  const action = data.lastMaskAction;
  if (!action) return;
  if (action.before) await chrome.storage.local.set({ [action.key]: action.before });
  else await chrome.storage.local.remove(action.key);
  await chrome.storage.local.remove('lastMaskAction');
  report('Действие отменено');
};
$('replacementSample').oninput = previewWords;
$('wordRows').addEventListener('input', previewWords);
function previewWords() {
  let text = $('replacementSample').value;
  const pairs = [...$('wordRows').children]
    .map((row) => [...row.querySelectorAll('input')].map((input) => input.value))
    .filter(([name]) => name);
  const escaped = (value) =>
    [...value]
      .map((char) => ('\\^$.*+?()[]{}|'.includes(char) ? '\\' + char : char))
      .join('');
  if (pairs.length) {
    const lookup = new Map(pairs.map(([a, b]) => [a.toLowerCase(), b]));
    text = text.replace(
      new RegExp(
        pairs
          .sort((a, b) => b[0].length - a[0].length)
          .map(([a]) => escaped(a))
          .join('|'),
        'gi'
      ),
      (match) => lookup.get(match.toLowerCase())
    );
  }
  $('replacementResult').textContent = text;
}
$('diagnose').onclick = async () => {
  const data = await chrome.storage.local.get(null);
  const response = await chrome.tabs
    .sendMessage(activeTab.id, { type: 'stopdep-diagnostics' }, { frameId: 0 })
    .catch(() => null);
  const rules = await chrome.declarativeNetRequest.getEnabledRulesets();
  $('diagnosticResult').textContent = [
    'СтопДЕП: ' + (data.enabled === false ? 'выключен' : 'включён'),
    'Связь со страницей: ' + (response ? 'есть' : 'нет — обнови вкладку'),
    'Масок на странице: ' + (response?.masks ?? '—'),
    'Наборы блокировок: ' + rules.join(', '),
    'Twitch: ' +
      (data.twitchProcessing !== false ? 'обработка включена' : 'обработка отключена'),
    'Другие расширения браузер не раскрывает. Для проверки конфликта временно выключи обработку Twitch или маски.',
  ].join('\n');
};

async function updateMaskMetadata(key, patch) {
  const current = (await chrome.storage.local.get(key))[key];
  if (!current) return;
  await chrome.storage.local.set({
    lastMaskAction: { key, before: current },
    [key]: { ...current, ...patch },
  });
}
$('folderFilter').onchange = () => refresh().catch((error) => report(error.message));
$('newFolderForm').onsubmit = async (event) => {
  event.preventDefault();
  try {
    const name = $('newFolderName').value.trim().slice(0, 80);
    if (!name) return;
    const data = await chrome.storage.local.get('maskFolders');
    const folders = Array.isArray(data.maskFolders) ? data.maskFolders : [];
    await chrome.storage.local.set({
      maskFolders: [...folders, { id: crypto.randomUUID(), name }],
    });
    $('newFolderName').value = '';
  } catch (error) {
    report(error.message);
  }
};
$('folderEditForm').onsubmit = async (event) => {
  event.preventDefault();
  try {
    const id = $('folderFilter').value,
      name = $('folderRename').value.trim().slice(0, 80);
    if (!name) return;
    const data = await chrome.storage.local.get('maskFolders');
    await chrome.storage.local.set({
      maskFolders: (data.maskFolders || []).map((f) =>
        f.id === id ? { ...f, name } : f
      ),
    });
  } catch (error) {
    report(error.message);
  }
};
$('removeFolder').onclick = async () => {
  try {
    const id = $('folderFilter').value;
    if (!id || id === '*') return;
    const data = await chrome.storage.local.get(null);
    const values = { maskFolders: (data.maskFolders || []).filter((f) => f.id !== id) };
    for (const [key, mask] of Object.entries(data))
      if (key.startsWith('mask:') && mask.folderId === id)
        values[key] = { ...mask, folderId: '' };
    $('folderFilter').value = '*';
    await chrome.storage.local.set(values);
  } catch (error) {
    report(error.message);
  }
};

$('selectAllMasks').onclick = () => {
  const boxes = [...$('saved').querySelectorAll('.mask-select')];
  const select = boxes.some((box) => !box.checked);
  for (const box of boxes) {
    box.checked = select;
    box.onchange();
  }
};
$('bulkMove').onchange = async () => {
  try {
    const folderId = $('bulkMove').value;
    if (folderId === '?') return;
    const data = await chrome.storage.local.get([...selectedMasks]);
    const values = {};
    for (const [key, mask] of Object.entries(data)) values[key] = { ...mask, folderId };
    await chrome.storage.local.set(values);
    selectedMasks.clear();
    await refresh();
  } catch (error) {
    report(error.message);
  }
};
