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

  // ---------- Разбор вызова по шагам ----------
  // Шаг за шагом проходим вызов функции: слева подсвечивается выполняемый
  // участок кода, справа — что он дал и почему. Содержание шагов лежит
  // в разметке (.rec-step), скрипт только переключает текущий.
  document.querySelectorAll('[data-rec]').forEach((rec) => {
    const steps = [...rec.querySelectorAll('.rec-step')];
    const codeSteps = [...rec.querySelectorAll('.code-step')];
    const frames = [...rec.querySelectorAll('.rec-frame')];
    const body = rec.querySelector('[data-rec-body]');
    const tag = rec.querySelector('[data-rec-tag]');
    const count = rec.querySelector('[data-rec-count]');
    const prev = rec.querySelector('[data-rec-prev]');
    const next = rec.querySelector('[data-rec-next]');
    const slide = rec.closest('.slide');
    if (!steps.length || !body || !tag || !count || !prev || !next || !slide) return;

    let index = 0;

    function render() {
      const step = steps[index];
      const marks = (step.dataset.hl || '').split(',').filter(Boolean);
      const depth = Number(step.dataset.depth || 0);

      body.replaceChildren(step.cloneNode(true));
      tag.textContent = step.dataset.tag || '';
      count.textContent = `шаг ${index + 1} / ${steps.length}`;

      codeSteps.forEach((el) => el.classList.toggle('is-on', marks.includes(el.dataset.step)));
      // Листинг длиннее окна, поэтому подсвеченный участок подтягиваем в вид.
      const first = codeSteps.find((el) => marks.includes(el.dataset.step));
      if (first) first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      frames.forEach((frame) => {
        const level = Number(frame.dataset.frame);
        frame.classList.toggle('is-active', level === depth);
        frame.classList.toggle('is-open', level < depth);
      });

      prev.disabled = index === 0;
      next.disabled = index === steps.length - 1;
      next.textContent = index === steps.length - 1 ? 'Разбор окончен' : 'Следующий шаг →';
    }

    function go(delta) {
      const target = index + delta;
      if (target < 0 || target >= steps.length) return false;
      index = target;
      render();
      return true;
    }

    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));

    // Стрелки листают шаги, и только когда шаги кончились — слайды. Слушатель
    // на фазе перехвата: обработчик дека висит на document и иначе сменил бы
    // слайд тем же нажатием.
    document.addEventListener(
      'keydown',
      (e) => {
        if (!slide.classList.contains('active')) return;
        const moved =
          (e.key === 'ArrowRight' && go(1)) || (e.key === 'ArrowLeft' && go(-1));
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    // Ушли со слайда — разбор начинается сначала.
    new MutationObserver(() => {
      if (!slide.classList.contains('active') && index !== 0) {
        index = 0;
        render();
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });

    render();
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
