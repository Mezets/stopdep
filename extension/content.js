function start(root) {
  const host = document.createElement('div');
  host.style.cssText =
    'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important';
  const shadow = host.attachShadow({ mode: 'closed' });
  const maskLayer = document.createElement('div');
  shadow.append(maskLayer);
  let settings = {};
  let frame = 0;
  let pickLayer;
  let currentPage;
  const rendered = new Map();
  const isTwitch = /(^|\.)twitch\.tv$/.test(location.hostname);
  let needsScrollLayout = false;
  let scrollSettleTimer;
  function handleScroll() {
    if (needsScrollLayout || highlighted) queueLayout();
    if (!rendered.size) return;
    clearTimeout(scrollSettleTimer);
    scrollSettleTimer = setTimeout(queueLayout, 160);
  }

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

  function pageKey() {
    return location.origin + location.pathname + location.search;
  }

  function attachHost() {
    if (!host.isConnected) root.append(host);
  }

  function queueLayout() {
    if (!rendered.size && !imageFilters.size && !backgroundLayers.size && !highlighted)
      return;
    if (!frame) frame = requestAnimationFrame(layout);
  }

  function imageVisible(anchor) {
    if (
      !anchor.isConnected ||
      anchor.closest(
        '.swiper-fade .swiper-slide:not(.swiper-slide-active), [aria-roledescription="slide"][aria-hidden="true"]'
      )
    )
      return false;
    if (getComputedStyle(anchor).visibility !== 'visible') return false;
    for (let node = anchor; node && node !== root; node = node.parentElement) {
      if (Number(getComputedStyle(node).opacity) === 0) return false;
    }
    return true;
  }

  const imageFilters = new Map();
  const filterNamespace = 'http://www.w3.org/2000/svg';
  let filterDefs;
  let filterSequence = 0;
  const filterPrefix = 'stopdep-' + Math.random().toString(36).slice(2) + '-';

  function svgNode(tag, attributes) {
    const node = document.createElementNS(filterNamespace, tag);
    for (const [name, value] of Object.entries(attributes))
      node.setAttribute(name, String(value));
    return node;
  }

  function applyImageFilters(groups) {
    for (const [image, record] of imageFilters) {
      if (groups.has(image)) continue;
      if (image.style.getPropertyValue('filter') === record.applied) {
        if (record.original)
          image.style.setProperty('filter', record.original, record.priority);
        else image.style.removeProperty('filter');
      }
      record.node.remove();
      imageFilters.delete(image);
    }

    for (const [image, regions] of groups) {
      const signature = JSON.stringify(
        regions.map((region) =>
          Object.values(region).map((value) =>
            typeof value === 'number' ? value.toFixed(5) : value
          )
        )
      );
      let record = imageFilters.get(image);
      if (
        record?.signature === signature &&
        image.style.getPropertyValue('filter') === record.applied
      )
        continue;
      if (!record) {
        if (!filterDefs) {
          const svg = svgNode('svg', { width: 0, height: 0, 'aria-hidden': true });
          svg.setAttribute('data-stopdep-owned', '');
          svg.style.cssText = 'position:absolute;pointer-events:none';
          filterDefs = svgNode('defs', {});
          svg.append(filterDefs);
          root.append(svg);
        }
        const id = filterPrefix + ++filterSequence;
        const node = svgNode('filter', {
          id,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          primitiveUnits: 'objectBoundingBox',
        });
        node.setAttribute('color-interpolation-filters', 'sRGB');
        filterDefs.append(node);
        record = {
          id,
          node,
          original: image.style.getPropertyValue('filter'),
          priority: image.style.getPropertyPriority('filter'),
        };
        imageFilters.set(image, record);
      } else if (image.style.getPropertyValue('filter') !== record.applied) {
        record.original = image.style.getPropertyValue('filter');
        record.priority = image.style.getPropertyPriority('filter');
      }
      record.signature = signature;
      record.node.replaceChildren();
      let input = 'SourceGraphic';
      regions.forEach(({ x, y, width, height, blurX, blurY, solid, color }, i) => {
        record.node.append(
          svgNode('feFlood', {
            x,
            y,
            width,
            height,
            'flood-color': color,
            result: 'area' + i,
          }),
          svgNode('feComposite', {
            in: input,
            in2: 'area' + i,
            operator: 'out',
            result: 'base' + i,
          })
        );
        let patch = 'area' + i;
        if (!solid) {
          record.node.append(
            svgNode('feGaussianBlur', {
              in: 'SourceGraphic',
              stdDeviation: blurX + ' ' + blurY,
              result: 'blur' + i,
            }),
            svgNode('feComposite', {
              in: 'blur' + i,
              in2: 'area' + i,
              operator: 'in',
              result: 'patch' + i,
            }),
            svgNode('feComposite', {
              in: 'patch' + i,
              in2: 'area' + i,
              operator: 'over',
              result: 'opaque' + i,
            })
          );
          patch = 'opaque' + i;
        }
        record.node.append(
          svgNode('feComposite', {
            in: patch,
            in2: 'base' + i,
            operator: 'over',
            result: 'out' + i,
          })
        );
        input = 'out' + i;
      });
      const own = 'url("#' + record.id + '")';
      const filter =
        record.original && record.original !== 'none' ? record.original + ' ' + own : own;
      image.style.setProperty('filter', filter, 'important');
      record.applied = image.style.getPropertyValue('filter');
    }
  }

  function coverColor(mask) {
    return /^#[0-9a-f]{6}$/i.test(mask.color || '') ? mask.color : '#151515';
  }

  function blurStrength(mask) {
    const strength = Number(mask.strength) || 24;
    const legacyCatalog = mask.source && !mask.pageOnly && mask.blurVersion !== 2;
    return Math.min(140, legacyCatalog ? strength * 2 : strength);
  }

  function imageRegion(anchor, rect, mask) {
    const box = anchor.getBoundingClientRect();
    if (!box.width || !box.height) return;
    return {
      x: (rect.left - box.left + mask.x * rect.width) / box.width,
      y: (rect.top - box.top + mask.y * rect.height) / box.height,
      width: (mask.width * rect.width) / box.width,
      height: (mask.height * rect.height) / box.height,
      blurX: blurStrength(mask) / box.width,
      blurY: blurStrength(mask) / box.height,
      solid: mask.mode === 'solid',
      color: coverColor(mask),
    };
  }

  const backgroundLayers = new Map();
  const generatedBackgrounds = new WeakSet();

  function backgroundSignature(areas, paint) {
    return JSON.stringify([
      areas.map(({ mask, bounds }) => [
        mask.mode,
        coverColor(mask),
        blurStrength(mask),
        ...[bounds.x, bounds.y, bounds.width, bounds.height].map((value) =>
          Math.round(value * 10000)
        ),
      ]),
      paint,
    ]);
  }

  function applyBackgroundBlurs(groups) {
    for (const [element, record] of backgroundLayers) {
      if (groups.has(element)) continue;
      for (const layer of record.layers) layer.remove();
      for (const [name, original, priority, applied] of record.styles) {
        if (element.style.getPropertyValue(name) !== applied) continue;
        if (original) element.style.setProperty(name, original, priority);
        else element.style.removeProperty(name);
      }
      backgroundLayers.delete(element);
    }

    for (const [element, areas] of groups) {
      const style = getComputedStyle(element);
      const background = [
        'backgroundImage',
        'backgroundPosition',
        'backgroundSize',
        'backgroundRepeat',
        'backgroundOrigin',
        'backgroundClip',
      ];
      const signature = backgroundSignature(
        areas,
        background.map((name) => style[name])
      );
      let record = backgroundLayers.get(element);
      if (record?.signature === signature) continue;
      if (!record) {
        const styles = [];
        if (style.position === 'static') styles.push(['position', 'relative']);
        if (style.isolation !== 'isolate') styles.push(['isolation', 'isolate']);
        record = {
          layers: [],
          styles: styles.map(([name, applied]) => {
            const saved = [
              name,
              element.style.getPropertyValue(name),
              element.style.getPropertyPriority(name),
              applied,
            ];
            element.style.setProperty(name, applied);
            return saved;
          }),
        };
        backgroundLayers.set(element, record);
      }
      for (const layer of record.layers.splice(areas.length)) layer.remove();
      record.signature = signature;
      record.layers = areas.map(({ mask, bounds }, index) => {
        const layer = record.layers[index] || document.createElement('span');
        generatedBackgrounds.add(layer);
        layer.setAttribute('aria-hidden', 'true');
        layer.style.cssText =
          'all:initial;display:block;position:absolute;inset:0;pointer-events:none;z-index:-1';
        if (mask.mode === 'blur') {
          for (const name of background) layer.style[name] = style[name];
          layer.style.filter = 'blur(' + blurStrength(mask) + 'px)';
        }
        const { x, y, width, height } = bounds;
        const insets = [y, 1 - x - width, 1 - y - height, x];
        layer.style.backgroundColor = coverColor(mask);
        layer.style.clipPath =
          'inset(' +
          insets.map((value) => 100 * Math.max(0, value) + '%').join(' ') +
          ')';
        if (layer.parentElement !== element) element.append(layer);
        return layer;
      });
    }
  }

  function backgroundImageBounds(element, box, size) {
    if (!size?.width || !size.height) return box;
    const style = getComputedStyle(element);
    const fit = style.backgroundSize.split(',')[0].trim();
    if (fit !== 'cover' && fit !== 'contain') return box;
    const horizontal = box.width / size.width;
    const vertical = box.height / size.height;
    const scale =
      fit === 'cover' ? Math.max(horizontal, vertical) : Math.min(horizontal, vertical);
    const width = size.width * scale;
    const height = size.height * scale;
    const [x = '50%', y = '50%'] = style.backgroundPosition
      .split(',')[0]
      .trim()
      .split(/\s+/);
    function offset(value, leftover) {
      if (value.endsWith('%')) return (leftover * parseFloat(value)) / 100;
      if (value.endsWith('px')) return parseFloat(value);
      return leftover / 2;
    }
    return {
      left: box.left + offset(x, box.width - width),
      top: box.top + offset(y, box.height - height),
      width,
      height,
    };
  }

  let highlighted;

  function highlightBounds(mask) {
    if (mask.pageRegion)
      return {
        anchor: null,
        left: mask.x - scrollX,
        top: mask.y - scrollY,
        width: mask.width,
        height: mask.height,
      };
    const anchor = mask.source
      ? imageAnchor(mask)
      : mask.anchor && document.querySelector(mask.anchor);
    if (!anchor || !imageVisible(anchor)) return;
    const kind =
      mask.source?.kind === 'resource'
        ? resourceKind(anchor, mask.source.url)
        : mask.source?.kind;
    if (!anchor.matches('img, svg, video, canvas') && kind !== 'background') return;
    let rect = imageBounds(anchor, kind);
    if (kind === 'background')
      rect = backgroundImageBounds(anchor, rect, mask.bitmapSize);
    if (!rect.width || !rect.height) return;
    return {
      anchor,
      left: rect.left + mask.x * rect.width,
      top: rect.top + mask.y * rect.height,
      width: mask.width * rect.width,
      height: mask.height * rect.height,
    };
  }

  function positionHighlight() {
    if (!highlighted) return;
    const { node, mask } = highlighted;
    const bounds = highlightBounds(mask);
    node.hidden = !bounds;
    if (!bounds) return;
    const { anchor, left, top, width, height } = bounds;
    node.style.left = left + 'px';
    node.style.top = top + 'px';
    node.style.width = width + 'px';
    node.style.height = height + 'px';
    clipMask(node, anchor, left, top, width, height, true);
  }

  function revealMask(key, mask) {
    const initial = highlightBounds(mask);
    if (!initial) return false;
    highlighted?.node.remove();
    attachHost();
    const node = document.createElement('div');
    node.style.cssText =
      'position:fixed;pointer-events:none;box-sizing:border-box;border:3px solid #ff3939;background:#ff33331b';
    shadow.append(node);
    highlighted = { node, mask, key };
    initial.anchor?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'instant',
    });
    const bounds = highlightBounds(mask);
    if (bounds && (bounds.top < 0 || bounds.top + bounds.height > innerHeight)) {
      for (
        let parent = bounds.anchor?.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (
          parent.scrollHeight > parent.clientHeight &&
          /^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)
        ) {
          const box = parent.getBoundingClientRect();
          parent.scrollBy({
            top: bounds.top + bounds.height / 2 - box.top - box.height / 2,
            behavior: 'instant',
          });
          break;
        }
      }
      const after = highlightBounds(mask);
      if (after && (after.top < 0 || after.top + after.height > innerHeight)) {
        scrollBy({
          top: after.top + after.height / 2 - innerHeight / 2,
          behavior: 'instant',
        });
      }
    }
    positionHighlight();
    return true;
  }

  function textIntersects(left, top, width, height) {
    const walker = document.createTreeWalker(document.body || root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const text = walker.currentNode;
      const parent = text.parentElement;
      if (
        !text.data.trim() ||
        !parent ||
        parent.closest('script, style, noscript, svg, [hidden]')
      )
        continue;
      const box = parent.getBoundingClientRect();
      if (
        box.right <= left ||
        box.left >= left + width ||
        box.bottom <= top ||
        box.top >= top + height
      )
        continue;
      const style = getComputedStyle(parent);
      if (style.visibility !== 'visible' || style.opacity === '0') continue;
      range.selectNodeContents(text);
      if (
        [...range.getClientRects()].some(
          (r) =>
            r.right > left &&
            r.left < left + width &&
            r.bottom > top &&
            r.top < top + height
        )
      )
        return true;
    }
    return false;
  }

  const lastMedia = new WeakMap();

  function rememberMask(node, anchor, rect, kind, mask) {
    const image =
      kind === 'background' ? backgroundImageBounds(anchor, rect, mask.bitmapSize) : rect;
    const box = anchor.getBoundingClientRect();
    const left = Math.max(box.left, image.left + mask.x * image.width);
    const top = Math.max(box.top, image.top + mask.y * image.height);
    const right = Math.min(box.right, image.left + (mask.x + mask.width) * image.width);
    const bottom = Math.min(
      box.bottom,
      image.top + (mask.y + mask.height) * image.height
    );
    if (right > left && bottom > top) {
      lastMedia.set(node, {
        x: left + scrollX,
        y: top + scrollY,
        width: right - left,
        height: bottom - top,
      });
    } else lastMedia.delete(node);
  }

  function holdMask(node) {
    const last = lastMedia.get(node);
    const delay = Math.max(0, Math.min(10000, Number(settings.lingerMs) || 0));
    if (!last || !delay) return;
    if (last.missingSince === undefined) {
      last.missingSince = performance.now();
      setTimeout(queueLayout, delay);
    }
    if (performance.now() - last.missingSince >= delay) {
      lastMedia.delete(node);
      return;
    }
    const left = last.x - scrollX;
    const top = last.y - scrollY;
    if (textIntersects(left, top, last.width, last.height)) return;
    node.hidden = false;
    node.style.left = left + 'px';
    node.style.top = top + 'px';
    node.style.width = last.width + 'px';
    node.style.height = last.height + 'px';
    clipMask(node, null, left, top, last.width, last.height, false);
  }

  function layout() {
    frame = 0;
    if (currentPage !== pageKey()) render();
    needsScrollLayout = false;
    const native = new Map();
    const backgrounds = new Map();
    for (const { node, mask } of rendered.values()) {
      if (mask.pageRegion) {
        needsScrollLayout = true;
        const { left, top, width, height } = highlightBounds(mask);
        node.hidden = false;
        needsScrollLayout = true;
        node.style.left = left + 'px';
        node.style.top = top + 'px';
        node.style.width = width + 'px';
        node.style.height = height + 'px';
        clipMask(node, null, left, top, width, height, false);
        continue;
      }
      const anchor = mask.source
        ? imageAnchor(mask)
        : mask.anchor
        ? document.querySelector(mask.anchor)
        : null;
      const kind =
        mask.source?.kind === 'resource' && anchor
          ? resourceKind(anchor, mask.source.url)
          : mask.source?.kind;
      const rect =
        anchor &&
        (mask.source ? imageBounds(anchor, kind) : anchor.getBoundingClientRect());
      const media = anchor?.matches('img, svg, video, canvas') || kind === 'background';
      node.hidden = !media || !rect?.width || !rect.height || !imageVisible(anchor);
      if (node.hidden) {
        if (lastMedia.has(node)) needsScrollLayout = true;
        holdMask(node);
        continue;
      }
      const delay = Number(settings.lingerMs) || 0;
      if (delay > 0 && mask.mode === 'blur') rememberMask(node, anchor, rect, kind, mask);
      else lastMedia.delete(node);
      const conceal = mask.mode === 'blur' || mask.mode === 'solid';
      const videoOverlay = anchor?.matches('video');
      if (anchor?.matches('img, svg') && conceal) {
        const region = imageRegion(anchor, rect, mask);
        if (region) {
          if (!native.has(anchor)) native.set(anchor, []);
          native.get(anchor).push(region);
          node.hidden = true;
          continue;
        }
      }
      if (
        kind === 'background' &&
        anchor instanceof HTMLElement &&
        anchor !== document.body &&
        conceal
      ) {
        const imageRect = backgroundImageBounds(anchor, rect, mask.bitmapSize);
        const bounds = imageRegion(anchor, imageRect, mask);
        if (bounds) {
          if (!backgrounds.has(anchor)) backgrounds.set(anchor, []);
          backgrounds.get(anchor).push({ mask, bounds });
          node.hidden = true;
          continue;
        }
      }
      const paintRect =
        kind === 'background'
          ? backgroundImageBounds(anchor, rect, mask.bitmapSize)
          : rect;
      const left = paintRect.left + mask.x * paintRect.width;
      const top = paintRect.top + mask.y * paintRect.height;
      const width = mask.width * paintRect.width;
      const height = mask.height * paintRect.height;
      if (conceal && !videoOverlay) {
        lastMedia.delete(node);
        node.hidden = true;
        continue;
      }
      if (videoOverlay && conceal) {
        node.style.background = mask.mode === 'solid' ? coverColor(mask) : 'transparent';
        node.style.backdropFilter =
          mask.mode === 'blur' ? 'blur(' + blurStrength(mask) + 'px)' : 'none';
      }
      needsScrollLayout = true;
      node.style.left = left + 'px';
      node.style.top = top + 'px';
      node.style.width = width + 'px';
      node.style.height = height + 'px';
      clipMask(node, anchor, left, top, width, height, true);
    }
    applyImageFilters(native);
    applyBackgroundBlurs(backgrounds);
    positionHighlight();
  }

  async function drawImage(canvas, data) {
    const [header, payload] = data.split(',');
    const bytes = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: header.slice(5, -7) })
    );
    try {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
    } finally {
      bitmap.close();
    }
  }

  function createMask(mask) {
    const node = document.createElement('div');
    node.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden';
    if (mask.mode === 'image') {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill';
      node.style.background = '#151515';
      node.append(canvas);
      drawImage(canvas, mask.image).catch(console.error);
    } else if (mask.mode === 'solid') {
      node.style.backgroundColor = coverColor(mask);
    } else {
      node.style.backdropFilter = 'blur(' + blurStrength(mask) + 'px)';
      node.style.background = 'rgb(0 0 0 / 5%)';
    }
    maskLayer.append(node);
    return { node, mask };
  }

  function render() {
    currentPage = pageKey();
    const enabled = settings.enabled !== false;
    for (const key of ['bet', 'cases', 'gambling', 'banners']) {
      root.classList.toggle('stopbk-' + key, enabled && settings[key] !== false);
    }
    if (window !== top) return;
    if (!enabled) pickLayer?.remove();
    const matching = enabled
      ? Object.entries(settings).filter(
          ([key, value]) =>
            key.startsWith('mask:') &&
            ((value.source && !value.pageOnly) ||
              value.page === currentPage ||
              (twitchProfile(value.page) &&
                twitchProfile(value.page) === twitchProfile(currentPage)))
        )
      : [];
    const active = new Set(matching.map(([key]) => key));
    for (const [key, { node }] of rendered) {
      if (active.has(key)) continue;
      node.remove();
      rendered.delete(key);
    }
    if (matching.length) attachHost();
    for (const [key, mask] of matching) {
      const previous = rendered.get(key);
      if (previous?.mask === mask) continue;
      previous?.node.remove();
      rendered.set(key, createMask(mask));
    }
    if (matching.length || imageFilters.size || backgroundLayers.size) queueLayout();
  }

  const catalog = new Map();
  let catalogChars = 0;

  function svgIdentity(element) {
    const parts = [
      ...element.querySelectorAll(
        'path, use, image, polygon, rect, circle, ellipse, line, polyline'
      ),
    ];
    const signature =
      element.getAttribute('viewBox') +
      '|' +
      parts
        .map((part) =>
          [...part.attributes]
            .filter(({ name }) =>
              /^(d|href|xlink:href|points|x|y|cx|cy|r|rx|ry|width|height|x1|x2|y1|y2)$/.test(
                name
              )
            )
            .map(({ name, value }) => name + ':' + value)
            .join(',')
        )
        .join('|');
    if (!parts.length) return;
    let hash = 2166136261;
    for (let i = 0; i < signature.length; i++)
      hash = Math.imul(hash ^ signature.charCodeAt(i), 16777619);
    return 'inline-svg:' + signature.length + ':' + (hash >>> 0).toString(16);
  }

  function remember(element, kind) {
    if (generatedBackgrounds.has(element)) return;
    const url = imageSource(element, kind);
    const key = kind + '\n' + url;
    if (!url || catalog.has(key) || catalog.size >= 350) return;
    let preview = url;
    if (kind === 'svg') {
      const copy = element.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.querySelectorAll('script, foreignObject').forEach((node) => node.remove());
      const xml = new XMLSerializer().serializeToString(copy);
      if (xml.length > 150000) return;
      preview = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    }
    if (catalogChars + preview.length > 3500000) return;
    catalogChars += preview.length;
    catalog.set(key, { source: { kind, url }, preview });
  }

  function rememberTree(element, startup) {
    if (element.nodeType !== 1 || element === host) return;
    function collect(node) {
      if (node.matches('img')) remember(node, 'img');
      else if (node.matches('svg')) remember(node, 'svg');
      else if (node.matches('video')) remember(node, 'video');
      if (startup && node.namespaceURI === 'http://www.w3.org/1999/xhtml') {
        for (const kind of ['background', '::before', '::after']) remember(node, kind);
      }
    }
    collect(element);
    const selector = startup
      ? 'img, svg, video, [style], [class*="load" i], [class*="intro" i]'
      : 'img, svg, video';
    for (const node of element.querySelectorAll(selector)) collect(node);
  }

  function networkImages(entries) {
    for (const entry of entries) {
      let url;
      try {
        url = new URL(entry.name);
      } catch {
        continue;
      }
      if (
        !/^https?:$/.test(url.protocol) ||
        !/\.(?:webp|png|jpe?g|svg|avif|gif|bmp|ico)$/i.test(url.pathname)
      )
        continue;
      url.hash = '';
      const key = 'resource\n' + url.href;
      if (
        !catalog.has(key) &&
        (catalog.size < 500 || /preloader|winline/i.test(url.pathname))
      ) {
        catalog.set(key, {
          source: { kind: 'resource', url: url.href },
          preview: url.href,
        });
      }
    }
  }

  function resourceKind(element, url) {
    if (generatedBackgrounds.has(element)) return;
    if (element.matches('img') && imageSource(element, 'img') === url) return 'img';
    for (const kind of ['background', '::before', '::after']) {
      const value = getComputedStyle(
        element,
        kind === 'background' ? null : kind
      ).backgroundImage;
      for (const match of value.matchAll(/url\("([^"]+)"\)/g)) {
        if (match[1].split('#')[0] === url) return kind;
      }
    }
  }

  function startCatalog() {
    networkImages(performance.getEntriesByType('resource'));
    new PerformanceObserver((list) => networkImages(list.getEntries())).observe({
      type: 'resource',
      buffered: true,
    });
    const startupUntil = Date.now() + 12000;
    const record = (element) => rememberTree(element, false);
    record(root);
    document.addEventListener('load', (event) => record(event.target), true);
    document.addEventListener('loadedmetadata', (event) => record(event.target), true);
    new MutationObserver((records) => {
      for (const recordChange of records) {
        if (extensionMutation(recordChange)) continue;
        if (recordChange.type === 'attributes') record(recordChange.target);
        else for (const node of recordChange.addedNodes) record(node);
      }
    }).observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset'],
    });
  }

  function imageSource(element, kind) {
    if (generatedBackgrounds.has(element)) return;
    if (kind === 'svg') return svgIdentity(element);
    if (kind === 'video') {
      const url =
        element.currentSrc || element.src || element.querySelector('source[src]')?.src;
      return /^https?:/i.test(url || '') ? url : undefined;
    }
    const background =
      kind !== 'img' &&
      getComputedStyle(element, kind === 'background' ? null : kind).backgroundImage;
    const value =
      kind === 'img'
        ? element.currentSrc || element.src
        : /^url\("(.+)"\)$/.exec(background)?.[1];
    if (!/^https?:/i.test(value || '')) return;
    const url = new URL(value);
    url.hash = '';
    return url.href;
  }

  function imageBounds(element, kind) {
    const box = element.getBoundingClientRect();
    const naturalWidth =
      kind === 'video' || kind === 'video-player'
        ? element.videoWidth
        : element.naturalWidth;
    const naturalHeight =
      kind === 'video' || kind === 'video-player'
        ? element.videoHeight
        : element.naturalHeight;
    if (!naturalWidth || !naturalHeight) return box;
    const style = getComputedStyle(element);
    const fit = style.objectFit;
    if (fit === 'fill') return box;
    const widthScale = box.width / naturalWidth;
    const heightScale = box.height / naturalHeight;
    const contain = Math.min(widthScale, heightScale);
    const scale = {
      contain,
      cover: Math.max(widthScale, heightScale),
      none: 1,
      'scale-down': Math.min(1, contain),
    }[fit];
    if (scale === undefined) return box;
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    const [x = '50%', y = '50%'] = style.objectPosition.split(' ');
    const offset = (value, space) =>
      value.endsWith('%')
        ? (space * parseFloat(value)) / 100
        : value.endsWith('px')
        ? parseFloat(value)
        : space / 2;
    const left = box.left + offset(x, box.width - width);
    const top = box.top + offset(y, box.height - height);
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function findImage(left, top, width, height) {
    for (const hit of document.elementsFromPoint(left + width / 2, top + height / 2)) {
      for (let el = hit; el && el !== root; el = el.parentElement) {
        const kinds = el.matches('img')
          ? ['img']
          : el.matches('svg')
          ? ['svg']
          : el.matches('video')
          ? ['video-player']
          : ['background'];
        for (const kind of kinds) {
          if (kind === 'background' && el === document.body) continue;
          const url = kind === 'video-player' ? null : imageSource(el, kind);
          if (!url && kind !== 'video-player') continue;
          const rect = imageBounds(el, kind);
          if (
            left < rect.left ||
            top < rect.top ||
            left + width > rect.right ||
            top + height > rect.bottom
          )
            continue;
          return { rect, selector: selectorFor(el), source: { url, kind } };
        }
      }
    }
    for (const player of document.querySelectorAll('video')) {
      if (!imageVisible(player)) continue;
      const rect = imageBounds(player, 'video-player');
      if (
        left < rect.left ||
        top < rect.top ||
        left + width > rect.right ||
        top + height > rect.bottom
      )
        continue;
      return {
        rect,
        selector: selectorFor(player),
        source: { url: null, kind: 'video-player' },
      };
    }
  }

  let sourceCache = new Map();

  function extensionMutation(record) {
    if (
      record.target === host ||
      generatedBackgrounds.has(record.target) ||
      record.target.closest?.('[data-stopdep-owned]')
    )
      return true;
    return (
      record.type === 'childList' &&
      [...record.addedNodes, ...record.removedNodes].every(
        (node) =>
          node === host ||
          generatedBackgrounds.has(node) ||
          node.hasAttribute?.('data-stopdep-owned')
      )
    );
  }
  let sourceRefreshTimer;
  function refreshSources(records) {
    if (!rendered.size) return;
    if (Array.isArray(records) && records.every(extensionMutation)) return;
    if (sourceRefreshTimer) return;
    sourceRefreshTimer = setTimeout(() => {
      sourceRefreshTimer = undefined;
      sourceCache.clear();
      queueLayout();
    }, 120);
  }

  function imageAnchor(mask) {
    const { url, kind } = mask.source;
    if (kind === 'video-player') {
      const player = mask.anchor && document.querySelector(mask.anchor);
      if (player?.matches('video') && player.getBoundingClientRect().width) return player;
      if (isTwitch)
        return (
          [...document.querySelectorAll('video')].find(
            (video) => video.getBoundingClientRect().width && imageVisible(video)
          ) || null
        );
      return null;
    }
    const sourceMatches = (el) =>
      kind === 'resource'
        ? Boolean(resourceKind(el, url))
        : imageSource(el, kind) === url;
    const cached = sourceCache.get(mask);
    if (cached === null) return;
    if (
      cached?.isConnected &&
      sourceMatches(cached) &&
      cached.getBoundingClientRect().width &&
      imageVisible(cached)
    )
      return cached;
    const hinted = mask.anchor && document.querySelector(mask.anchor);
    const matches = (el) =>
      el.getBoundingClientRect().width && sourceMatches(el) && imageVisible(el);
    const candidates =
      kind === 'img'
        ? document.images
        : document.querySelectorAll(
            kind === 'svg' || kind === 'video' ? kind : 'body, body *'
          );
    const element =
      hinted && matches(hinted) ? hinted : Array.prototype.find.call(candidates, matches);
    sourceCache.set(mask, element || null);
    return element;
  }

  function selectorFor(element) {
    const parts = [];
    for (let node = element; node && node !== root; node = node.parentElement) {
      if (node.id) {
        const id = '#' + CSS.escape(node.id);
        if (document.querySelectorAll(id).length === 1) {
          parts.unshift(id);
          break;
        }
      }
      const index = Array.prototype.indexOf.call(node.parentElement.children, node) + 1;
      parts.unshift(CSS.escape(node.localName) + ':nth-child(' + index + ')');
    }
    return parts.join(' > ');
  }

  function clipMask(node, anchor, left, top, width, height, clipToAnchor) {
    let visibleLeft = 0;
    let visibleTop = 0;
    let visibleRight = innerWidth;
    let visibleBottom = innerHeight;
    if (clipToAnchor && anchor) {
      const box = anchor.getBoundingClientRect();
      visibleLeft = Math.max(visibleLeft, box.left);
      visibleTop = Math.max(visibleTop, box.top);
      visibleRight = Math.min(visibleRight, box.right);
      visibleBottom = Math.min(visibleBottom, box.bottom);
    }
    for (
      let parent = anchor?.parentElement;
      parent && parent !== root;
      parent = parent.parentElement
    ) {
      const { overflowX, overflowY } = getComputedStyle(parent);
      if (overflowX === 'visible' && overflowY === 'visible') continue;
      const rect = parent.getBoundingClientRect();
      if (overflowX !== 'visible') {
        visibleLeft = Math.max(visibleLeft, rect.left + parent.clientLeft);
        visibleRight = Math.min(
          visibleRight,
          rect.left + parent.clientLeft + parent.clientWidth
        );
      }
      if (overflowY !== 'visible') {
        visibleTop = Math.max(visibleTop, rect.top + parent.clientTop);
        visibleBottom = Math.min(
          visibleBottom,
          rect.top + parent.clientTop + parent.clientHeight
        );
      }
    }
    const insets = [
      visibleTop - top,
      left + width - visibleRight,
      top + height - visibleBottom,
      visibleLeft - left,
    ];
    node.style.clipPath =
      'inset(' + insets.map((value) => Math.max(0, value) + 'px').join(' ') + ')';
  }

  function selectRegion(options) {
    pickLayer?.remove();
    attachHost();
    const layer = document.createElement('div');
    pickLayer = layer;
    layer.tabIndex = 0;
    layer.style.cssText =
      'position:fixed;inset:0;pointer-events:auto;cursor:crosshair;touch-action:none;outline:none;background:#0003';
    const tip = document.createElement('div');
    tip.textContent =
      options.language === 'en'
        ? options.pageRegion
          ? 'Select an area on the page · Esc to cancel'
          : 'Select an area on an image or video · Esc to cancel'
        : options.pageRegion
        ? 'Обведи участок страницы · Esc — отмена'
        : 'Обведи участок на фото или видео · Esc — отмена';
    tip.style.cssText =
      'position:absolute;top:12px;left:50%;transform:translateX(-50%);background:#101012;color:white;padding:10px 14px;border:1px solid #ff2929;border-radius:8px;pointer-events:none;font:14px system-ui';
    const box = document.createElement('div');
    box.hidden = true;
    box.style.cssText =
      'position:absolute;pointer-events:none;border:2px solid #ff2222;background:#ff22222e;box-sizing:border-box';
    layer.append(tip, box);
    shadow.append(layer);
    layer.focus({ preventScroll: true });
    let start;
    function clear() {
      layer.remove();
      if (pickLayer === layer) pickLayer = null;
    }
    function bounds(event) {
      return {
        left: Math.min(start.x, event.clientX),
        top: Math.min(start.y, event.clientY),
        width: Math.abs(start.x - event.clientX),
        height: Math.abs(start.y - event.clientY),
      };
    }
    layer.onkeydown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      clear();
    };
    layer.onpointerdown = (event) => {
      if (event.button !== 0 || start) return;
      start = { x: event.clientX, y: event.clientY };
      layer.setPointerCapture(event.pointerId);
    };
    layer.onpointermove = (event) => {
      if (!start) return;
      box.hidden = false;
      for (const [property, value] of Object.entries(bounds(event)))
        box.style[property] = value + 'px';
    };
    layer.onpointercancel = clear;
    layer.onwheel = (event) => {
      if (start) event.preventDefault();
    };
    layer.onpointerup = async (event) => {
      if (!start || event.button !== 0) return;
      const { left, top, width, height } = bounds(event);
      start = null;
      if (width < 8 || height < 8) {
        box.hidden = true;
        return;
      }
      if (options.page !== pageKey()) {
        clear();
        return;
      }
      layer.style.pointerEvents = 'none';
      const anchor = options.pageRegion ? null : findImage(left, top, width, height);
      layer.style.pointerEvents = 'auto';
      if (!anchor && !options.pageRegion) {
        box.hidden = true;
        tip.textContent =
          options.language === 'en'
            ? 'Select an area fully inside the image or video'
            : 'Выдели участок целиком внутри фото или видео';
        return;
      }
      clear();
      const rect = anchor?.rect;
      const mask = {
        createdAt: Date.now(),
        page: options.page,
        pageOnly: true,
        mode: options.mode,
        image: options.image,
        color: options.color,
        strength: options.strength,
      };
      if (anchor) {
        Object.assign(mask, {
          anchor: anchor.selector,
          source: anchor.source,
          x: (left - rect.left) / rect.width,
          y: (top - rect.top) / rect.height,
          width: width / rect.width,
          height: height / rect.height,
        });
      } else {
        Object.assign(mask, {
          pageRegion: true,
          x: left + scrollX,
          y: top + scrollY,
          width,
          height,
        });
      }
      try {
        const key = 'mask:' + crypto.randomUUID();
        await chrome.storage.local.set({
          [key]: mask,
          lastMaskAction: { key, before: null },
        });
      } catch (error) {
        alert(
          (options.language === 'en'
            ? 'Could not save the area: '
            : 'Не удалось сохранить область: ') + error.message
        );
      }
    };
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (newValue === undefined) {
        delete settings[key];
        if (highlighted?.key === key) {
          highlighted.node.remove();
          highlighted = null;
        }
      } else settings[key] = newValue;
    }
    render();
  });
  chrome.storage.local
    .get(null)
    .then((data) => {
      settings = { ...data, ...settings };
      render();
    })
    .catch(console.error);

  if (window === top) {
    addEventListener('scroll', handleScroll, { capture: true, passive: true });
    addEventListener('resize', queueLayout);
    if (isTwitch) {
      let playerFrame = 0;
      const tracked = new Map();
      function trackPlayers() {
        playerFrame = 0;
        let changed = false;
        for (const [key, { mask }] of rendered) {
          if (mask.source?.kind !== 'video-player') continue;
          const video = imageAnchor(mask);
          const rect = video?.getBoundingClientRect();
          const geometry = rect
            ? [rect.left, rect.top, rect.width, rect.height].join(',')
            : '';
          if (tracked.get(key) !== geometry) {
            tracked.set(key, geometry);
            changed = true;
          }
        }
        if (changed) queueLayout();
        if (
          [...rendered.values()].some(({ mask }) => mask.source?.kind === 'video-player')
        )
          playerFrame = requestAnimationFrame(trackPlayers);
      }
      function startTracking() {
        if (!playerFrame) playerFrame = requestAnimationFrame(trackPlayers);
      }
      chrome.storage.onChanged.addListener(startTracking);
      startTracking();
    }
    addEventListener('load', refreshSources, true);
    if (!isTwitch)
      new MutationObserver(refreshSources).observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'media'],
      });
    setInterval(() => {
      if (currentPage !== pageKey()) render();
      else if (isTwitch && rendered.size) {
        const videos = document.querySelectorAll('video');
        if (videos.length && !pickLayer) queueLayout();
      }
    }, 1000);
    if (!isTwitch) startCatalog();
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
      if (message.type === 'stopdep-diagnostics') {
        respond({ masks: rendered.size });
        return;
      }
      if (message.type === 'highlight-status') {
        respond({ key: highlighted?.key || null });
        return;
      }
      if (message.type === 'hide-highlight') {
        highlighted?.node.remove();
        highlighted = null;
        respond({ ok: true });
        return;
      }
      if (message.type === 'show-mask') {
        const mask = settings[message.key];
        const available =
          mask && (mask.page === pageKey() || (mask.source && !mask.pageOnly));
        respond({ ok: Boolean(available && revealMask(message.key, mask)) });
        return;
      }
      if (message.type === 'image-catalog') {
        networkImages(performance.getEntriesByType('resource'));
        rememberTree(root, !isTwitch);
        const byUrl = new Map();
        for (const entry of catalog.values()) {
          const existing = byUrl.get(entry.source.url);
          if (!existing || existing.source.kind === 'resource')
            byUrl.set(entry.source.url, entry);
        }
        const priority = (entry) => (/preloader|winline/i.test(entry.source.url) ? 0 : 1);
        respond([...byUrl.values()].sort((a, b) => priority(a) - priority(b)));
        return;
      }
      if (settings.enabled === false || message.page !== pageKey()) return;
      if (message.type === 'pick-mask-page') {
        selectRegion({ ...message, pageRegion: true });
        respond({ target: 'page' });
      } else if (message.type === 'pick-mask-media') {
        selectRegion({ ...message, pageRegion: false });
        respond({ target: 'media' });
      }
    });
  }
}

function launchContent() {
  if (document.documentElement) start(document.documentElement);
  else {
    const observer = new MutationObserver(() => {
      if (!document.documentElement) return;
      observer.disconnect();
      start(document.documentElement);
    });
    observer.observe(document, { childList: true });
  }
}

if (/(^|.)twitch.tv$/.test(location.hostname)) {
  let started = false;
  const ready = chrome.storage.local.get('twitchProcessing').then((data) => {
    if (data.twitchProcessing !== false) {
      started = true;
      launchContent();
    }
  });
  function wakePicker(message, sender, respond) {
    if (!['pick-mask-page', 'pick-mask-media'].includes(message.type)) return;
    if (started) return;
    ready
      .then(async () => {
        if (!started) {
          await chrome.storage.local.set({ twitchProcessing: true });
          started = true;
          launchContent();
        }
        chrome.runtime.onMessage.removeListener(wakePicker);
        respond({ retry: true });
      })
      .catch((error) => respond({ error: error.message }));
    return true;
  }
  chrome.runtime.onMessage.addListener(wakePicker);
} else launchContent();
