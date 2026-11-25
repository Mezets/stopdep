(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const lines = [...document.querySelectorAll('.replace-line')];
  function playReplacements() {
    for (const [index, line] of lines.entries()) {
      line.querySelector('strong').hidden = false;
      if (motion.matches) continue;
      line.querySelector('strong').animate(
        [
          { opacity: 0, transform: 'translateY(12px)', clipPath: 'inset(0 100% 0 0)' },
          { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
        ],
        {
          duration: 560,
          delay: 240 + index * 160,
          easing: 'cubic-bezier(.16,1,.3,1)',
          fill: 'backwards',
        }
      );
      const old = line.querySelector('s');
      old.animate([{ opacity: 1 }, { opacity: 0.5 }], {
        duration: 400,
        delay: index * 160,
        fill: 'forwards',
      });
    }
  }
  const features = document.querySelector('.features');
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          if (entry.target === features) playReplacements();
          else if (!motion.matches)
            entry.target.animate(
              [
                { opacity: 0, transform: 'translateY(14px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              {
                duration: 500,
                delay: Number(entry.target.dataset.enterDelay) || 0,
                easing: 'cubic-bezier(.16,1,.3,1)',
                fill: 'backwards',
              }
            );
          observer.unobserve(entry.target);
        }
    },
    { threshold: 0.2 }
  );
  observer.observe(features);
  document
    .querySelectorAll('h1,h2,.actions a,.play-tabs button,.mask-panel>*')
    .forEach((element, index) => {
      element.dataset.enterDelay = String((index % 3) * 65);
      observer.observe(element);
    });
  document.getElementById('wordToggle').addEventListener('change', (event) => {
    if (event.target.checked) playReplacements();
  });
})();
