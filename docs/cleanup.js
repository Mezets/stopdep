(() => {
  const compare = document.getElementById('compareDemo');
  const blocks = document.getElementById('blocksDemo');
  const range = document.getElementById('compareRange');
  const buttons = [...document.querySelectorAll('.removable-ad')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  for (const [id, showCompare] of [
    ['compareTab', true],
    ['blocksTab', false],
  ]) {
    document.getElementById(id).onclick = () => {
      compare.hidden = !showCompare;
      blocks.hidden = showCompare;
      document
        .getElementById('compareTab')
        .setAttribute('aria-pressed', String(showCompare));
      document
        .getElementById('blocksTab')
        .setAttribute('aria-pressed', String(!showCompare));
    };
  }
  range.oninput = () => {
    document.querySelector('.comparison').style.setProperty('--split', range.value + '%');
    document.getElementById('compareValue').textContent =
      100 - Number(range.value) + '% без рекламы';
  };
  function update() {
    const removed = buttons.filter((button) => button.hidden).length;
    document.getElementById('cleanupStatus').textContent =
      removed === buttons.length
        ? 'Чисто. Кот одобряет.'
        : removed
        ? 'Одним баннером меньше.'
        : 'Здесь решаешь ты.';
    document
      .querySelector('.sandbox-aside')
      .classList.toggle('is-celebrating', removed === buttons.length);
    document.getElementById('restoreDemoBlocks').disabled = !removed;
  }
  for (const button of buttons)
    button.onclick = async () => {
      button.disabled = true;
      if (!reduced.matches)
        await button.animate(
          [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(.96)' },
          ],
          { duration: 180, easing: 'ease-out' }
        ).finished;
      button.hidden = true;
      document.querySelector('.sandbox-post:last-of-type').focus?.();
      document.getElementById('restoreDemoBlocks').focus({ preventScroll: true });
      update();
    };
  document.getElementById('restoreDemoBlocks').onclick = () => {
    for (const button of buttons) {
      button.hidden = false;
      button.disabled = false;
    }
    update();
    buttons[0].focus({ preventScroll: true });
  };
  update();
})();
