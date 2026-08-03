// talk.js — поведение контентных слайдов ЭТОГО доклада («Серверный рендеринг»).
// Общий движок (клавиши, масштаб, кликабельные строки кода → панель пояснения)
// живёт в deck.js и правится только в шаблоне. Здесь то, чего в нём нет:
// выдвижной ящик с цитатой автора и пошаговый прогон примера.

(function () {
  // ---------- Цитата автора: ящик выезжает снизу слайда ----------
  const caller = document.querySelector('.quote-caller');
  const drawer = document.querySelector('.quote-drawer');

  if (caller && drawer) {
    const close = () => drawer.classList.remove('open');

    caller.addEventListener('click', (e) => {
      e.stopPropagation();
      drawer.classList.toggle('open');
    });
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('.quote-close')) close();
      e.stopPropagation();
    });
    // Уходим со слайда или жмём Esc — ящик не должен оставаться открытым.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') close();
    });
  }

  // ---------- Пошаговый прогон примера ----------
  // Шаги описаны в разметке (<template data-step>), чтобы текст жил в HTML,
  // а не в скрипте: править содержание слайда проще там же, где он собран.
  document.querySelectorAll('.stepper').forEach((stepper) => {
    const steps = [...stepper.querySelectorAll('template[data-step]')];
    if (steps.length === 0) return;

    const body = stepper.querySelector('.stepper-body');
    const dots = stepper.querySelector('.stepper-dots');
    const counter = stepper.querySelector('.stepper-counter');
    const prev = stepper.querySelector('[data-step-prev]');
    const next = stepper.querySelector('[data-step-next]');
    let current = 0;

    dots.innerHTML = steps.map(() => '<i></i>').join('');
    const marks = [...dots.querySelectorAll('i')];

    function show(index) {
      current = Math.max(0, Math.min(index, steps.length - 1));
      body.innerHTML = steps[current].innerHTML;
      marks.forEach((m, i) => m.classList.toggle('is-on', i === current));
      counter.textContent = `шаг ${current + 1} из ${steps.length}`;
      prev.disabled = current === 0;
      next.disabled = current === steps.length - 1;
      // Мягкое появление: шаг меняется заметно, но без рывка.
      body.style.opacity = '0';
      requestAnimationFrame(() => {
        body.style.transition = 'opacity 0.25s ease';
        body.style.opacity = '1';
      });
    }

    prev.addEventListener('click', (e) => {
      e.stopPropagation();
      show(current - 1);
    });
    next.addEventListener('click', (e) => {
      e.stopPropagation();
      show(current + 1);
    });
    show(0);
  });
})();
