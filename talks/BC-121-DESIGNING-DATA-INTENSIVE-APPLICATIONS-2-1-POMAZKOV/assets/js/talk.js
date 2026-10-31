// talk.js — поведение контентных слайдов: одна всплывающая подсказка на весь дек.
// Подсказка живёт в body, а не на сцене: её размер не зависит от масштаба
// слайда, и она не обрезается краем схемы. Элементы с data-tip доступны с клавиатуры.
(function () {
  const tip = document.createElement('div');
  tip.className = 'tip-float';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  const stage = document.getElementById('deckStage');
  const place = (el) => {
    const k = stage ? stage.getBoundingClientRect().width / 1920 : 1;
    tip.style.fontSize = `${Math.max(13, 23 * k)}px`;
    tip.style.maxWidth = `${Math.max(280, 560 * k)}px`;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 10;
    let top = r.top - t.height - gap;
    if (top < 8) top = r.bottom + gap;
    if (top + t.height > innerHeight - 8) top = Math.max(8, innerHeight - t.height - 8);
    const left = Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  };
  const show = (el) => {
    tip.textContent = el.dataset.tip;
    place(el);
    tip.classList.add('is-on');
  };
  const hide = () => tip.classList.remove('is-on');

  document.querySelectorAll('[data-tip]').forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', hide);
  });
  document.addEventListener('keydown', hide);
})();
