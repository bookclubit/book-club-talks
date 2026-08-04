// talk.js — поведение контентных слайдов ЭТОГО доклада.
// Общий движок (клавиши, масштаб, аккордеон pillar-card) живёт в deck.js
// и правится только в шаблоне. Здесь то, чего в нём нет: раскрытие
// преимущества на весь слайд и переключение этапов «Как работает RSC».

(function () {
  // ---------- Лента фреймворков: бесконечный ход ----------
  // Анимация сдвигает трек на половину его ширины, поэтому в разметке лежит
  // один набор логотипов, а скрипт клонирует его до чётного числа наборов,
  // при котором половина трека шире слайда. Иначе в конце цикла оставалась бы
  // пустота: набора из десяти знаков (около 1100px) на 1920px не хватает.
  const track = document.querySelector('[data-marquee]');
  if (track) {
    const set = [...track.children].map((node) => node.cloneNode(true));
    const setWidth = track.scrollWidth;
    const viewport = track.parentElement.clientWidth || 1720;
    const copies = Math.max(1, Math.ceil(viewport / setWidth));
    for (let i = 1; i < copies; i++) set.forEach((node) => track.appendChild(node.cloneNode(true)));
    // Вторая половина трека — то, что заходит справа, пока уезжает первая.
    [...track.children].forEach((node) => track.appendChild(node.cloneNode(true)));
    // Темп не зависит от числа наборов: около 90 пикселей в секунду.
    track.style.setProperty('--marquee-time', `${Math.round(track.scrollWidth / 2 / 90)}s`);
  }

  // ---------- Преимущества: панель на весь слайд ----------
  const cards = document.querySelectorAll('.adv-card');
  const overlays = document.querySelectorAll('.adv-overlay');

  function closeOverlays() {
    overlays.forEach((o) => o.classList.remove('active'));
  }

  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = document.getElementById(card.dataset.adv);
      if (!target) return;
      const wasOpen = target.classList.contains('active');
      closeOverlays();
      if (!wasOpen) target.classList.add('active');
    });
  });

  overlays.forEach((overlay) => {
    // Клик по фону панели закрывает её, клик по тексту — нет: с текстом работают.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.adv-close')) closeOverlays();
      e.stopPropagation();
    });
  });

  // ---------- Как работает RSC: этап → пояснение ----------
  // Пояснения лежат готовой разметкой в HTML (там есть и подсказки терминов,
  // и блоки кода), поэтому скрипт только переключает активный этап и дотягивает
  // белую часть линии таймлайна до активной точки.
  const timeline = document.querySelector('[data-timeline]');
  const steps = [...document.querySelectorAll('.tl-step')];
  const panels = [...document.querySelectorAll('.chain-panel')];

  function selectStep(index) {
    steps.forEach((s, i) => {
      s.classList.toggle('is-active', i === index);
      s.classList.toggle('is-done', i < index);
    });
    panels.forEach((p, i) => p.classList.toggle('is-active', i === index));
    if (!timeline) return;
    // Высота заливки — от первой точки до активной. Считаем по факту, а не по
    // номеру этапа: заголовки этапов разной длины и переносятся по-разному.
    const dots = steps.map((s) => s.querySelector('.tl-dot'));
    const top = dots[0]?.getBoundingClientRect().top ?? 0;
    const active = dots[index]?.getBoundingClientRect().top ?? top;
    const scale = timeline.getBoundingClientRect().height / timeline.offsetHeight || 1;
    timeline.style.setProperty('--tl-fill', `${(active - top) / scale}px`);
  }

  steps.forEach((step, index) => {
    step.addEventListener('click', (e) => {
      e.stopPropagation();
      selectStep(index);
    });
  });
  if (steps.length) selectStep(0);

  // Esc и стрелки: уходя со слайда, не оставляем открытых панелей.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') closeOverlays();
  });
})();
