// talk.js — поведение контентных слайдов ЭТОГО доклада.
// Общий движок (клавиши, масштаб, аккордеон pillar-card) живёт в deck.js
// и правится только в шаблоне. Здесь то, чего в нём нет: раскрытие
// преимущества на весь слайд и переключение этапов «Как работает RSC».

(function () {
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
  // и блоки кода), поэтому скрипт только переключает активный этап.
  const steps = [...document.querySelectorAll('.chain-step')];
  const panels = [...document.querySelectorAll('.chain-panel')];

  steps.forEach((step, index) => {
    step.addEventListener('click', (e) => {
      e.stopPropagation();
      steps.forEach((s, i) => s.classList.toggle('is-active', i === index));
      panels.forEach((p, i) => p.classList.toggle('is-active', i === index));
    });
  });

  // Esc и стрелки: уходя со слайда, не оставляем открытых панелей.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') closeOverlays();
  });
})();
