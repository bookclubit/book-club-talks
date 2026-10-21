// talk.js — интерактив доклада BC-120-AI-2-3: вкладки с примерами
// демонстраций (табл. 2.6) и подсветка доли на кольцевой диаграмме.
// Без этого файла слайды работают: видна первая вкладка, диаграмма без подсветки.
(function () {
  document.querySelectorAll('.ex26').forEach((box) => {
    const tabs = [...box.querySelectorAll('[data-tab]')];
    const panels = [...box.querySelectorAll('[data-panel]')];
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('is-on', t === tab));
      panels.forEach((p) => p.classList.toggle('is-on', p.dataset.panel === tab.dataset.tab));
      // Фокус на кнопке перехватывал бы пробел — им листают слайды.
      tab.blur();
    }));
  });

  document.querySelectorAll('.donut').forEach((box) => {
    const items = [...box.querySelectorAll('[data-i]')];
    const focus = (i) => {
      box.classList.toggle('is-focus', i !== null);
      items.forEach((el) => el.classList.toggle('is-on', el.dataset.i === i));
    };
    items.forEach((el) => {
      el.addEventListener('mouseenter', () => focus(el.dataset.i));
      el.addEventListener('mouseleave', () => focus(null));
    });
  });
})();
