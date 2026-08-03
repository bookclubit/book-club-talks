// talk.js — поведение контентных слайдов ЭТОГО доклада.
// Общий движок (клавиши, масштаб, аккордеон pillar-card, интерактивные шаги)
// живёт в deck.js и правится только в шаблоне. Здесь — то, чего в нём нет:
// раскрытие преимущества на весь слайд.

(function () {
  const cards = document.querySelectorAll('.adv-card');
  const overlays = document.querySelectorAll('.adv-overlay');
  if (cards.length === 0) return;

  function closeAll() {
    overlays.forEach((o) => o.classList.remove('active'));
  }

  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = document.getElementById(card.dataset.adv);
      if (!target) return;
      const wasOpen = target.classList.contains('active');
      closeAll();
      if (!wasOpen) target.classList.add('active');
    });
  });

  overlays.forEach((overlay) => {
    // Клик по фону панели закрывает её, клик по тексту — нет: с текстом работают.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.adv-close')) closeAll();
      e.stopPropagation();
    });
  });

  // Esc и стрелки: панель не должна оставаться открытой, когда ушли со слайда.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') closeAll();
  });
})();
