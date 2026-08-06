// talk.js — поведение контентных слайдов ЭТОГО доклада («Серверный рендеринг»).
// Общий движок (клавиши, масштаб, кликабельные строки кода → панель пояснения)
// живёт в deck.js и правится только в шаблоне. Здесь то, чего в нём нет:
// выдвижные ящики с цитатами автора и примеры к ветке функции.

(function () {
  // ---------- Цитата автора: ящик выезжает снизу слайда ----------
  // Ящиков несколько (по одному на слайд с цитатой), поэтому пары
  // «аватарка → ящик» ищем внутри каждого слайда отдельно.
  const drawers = [...document.querySelectorAll('.quote-drawer')];
  const closeDrawers = () => drawers.forEach((d) => d.classList.remove('open'));

  document.querySelectorAll('.slide').forEach((slide) => {
    const caller = slide.querySelector('.quote-caller');
    const drawer = slide.querySelector('.quote-drawer');
    if (!caller || !drawer) return;

    caller.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = drawer.classList.contains('open');
      closeDrawers();
      if (!wasOpen) drawer.classList.add('open');
    });
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('.quote-close')) closeDrawers();
      e.stopPropagation();
    });
  });

  // Уходим со слайда или жмём Esc — ящик не должен оставаться открытым.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') closeDrawers();
  });

  // ---------- Ветка функции: пример в два прохода рекурсии ----------
  // Тексты примеров лежат на самой строке кода (data-pass1 / data-pass2):
  // содержание слайда правится в HTML, а не в скрипте.
  document.querySelectorAll('.branch-side').forEach((side) => {
    const box = side.querySelector('.pass-box');
    const tag = side.querySelector('[data-pass-tag]');
    const code = side.querySelector('[data-pass-code]');
    const toggle = side.querySelector('[data-pass-toggle]');
    const slide = side.closest('.slide');
    if (!box || !slide || !tag || !code || !toggle) return;

    let line = null;
    let second = false;

    function render() {
      const text = line && (second ? line.dataset.pass2 : line.dataset.pass1);
      box.hidden = !text;
      if (!text) return;
      tag.textContent = second ? 'проход 2 · { children: "Hi!" }' : 'проход 1 · <div>Hi!</div>';
      code.textContent = text;
      toggle.hidden = second || !line.dataset.pass2;
    }

    slide.querySelectorAll('.code-line').forEach((el) => {
      el.addEventListener('click', () => {
        line = el;
        second = false;
        render();
      });
    });
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      second = true;
      render();
    });
  });

  // ---------- Сериализация: разбор внутри renderToString ----------
  document.querySelectorAll('[data-ser-toggle]').forEach((btn) => {
    const lab = btn.closest('.content-slide')?.querySelector('.ser-lab');
    if (!lab) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      lab.hidden = !lab.hidden;
      btn.querySelector('.ser-engine-sub').textContent = lab.hidden
        ? 'нажмите, чтобы заглянуть внутрь'
        : 'нажмите, чтобы свернуть';
    });
  });

  // ---------- Навигация: два перехода со счётчиком времени ----------
  // Счётчик считает реальное время анимации до заявленного значения: у полной
  // перезагрузки оно на порядок больше, и это видно рядом, кадр в кадр.
  document.querySelectorAll('[data-nav-demo]').forEach((demo) => {
    const run = demo.querySelector('[data-nav-run]');
    const out = demo.querySelector('[data-nav-ms]');
    const state = demo.querySelector('[data-nav-state]');
    const target = Number(demo.dataset.ms || 500);
    const isOld = demo.classList.contains('is-old');
    if (!run || !out) return;

    let playing = false
    run.addEventListener('click', (e) => {
      e.stopPropagation();
      if (playing) return;
      playing = true;
      demo.classList.add('is-running');
      demo.classList.remove('is-done');
      if (isOld && state) state.textContent = 'поле очищено';

      // Длительность показа привязана к анимации: 1.2s у перезагрузки, 0.55s у RSC.
      const duration = isOld ? 1200 : 550;
      const started = performance.now();
      const tick = (now) => {
        const done = Math.min(1, (now - started) / duration);
        out.textContent = `${Math.round(target * done)} мс`;
        if (done < 1) return requestAnimationFrame(tick);
        demo.classList.remove('is-running');
        demo.classList.add('is-done');
        if (isOld && state) state.textContent = 'состояние сброшено';
        else if (state) state.textContent = 'в поле: «привет»';
        playing = false;
      };
      requestAnimationFrame(tick);
    });
  });

  // ---------- Термин в коде: пояснение показывает панель справа ----------
  // Отдельного всплывающего окна у термина нет: под курсором он занимает ту же
  // панель, что и клик по строке кода, а прежнее её содержимое возвращается,
  // когда курсор уходит. Клик по термину до строки кода не доходит — иначе
  // панель тут же перебило бы пояснение строки.
  document.querySelectorAll('.code-term').forEach((term) => {
    const block = term.closest('.interactive-block');
    const panel = block && document.getElementById(block.dataset.target);
    if (!panel) return;

    let saved = null;

    term.addEventListener('mouseenter', () => {
      if (saved === null) saved = panel.innerHTML;
      panel.innerHTML = `<h3>${term.dataset.title}</h3><p>${term.dataset.desc}</p>`;
    });
    term.addEventListener('mouseleave', () => {
      if (saved === null) return;
      panel.innerHTML = saved;
      saved = null;
    });
    term.addEventListener('click', (e) => e.stopPropagation());
  });
})();
