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
  // Два окна кода живут в модальном окне: на слайде остаётся только схема,
  // а разбор открывается кликом по движку и закрывается фоном, крестиком,
  // Esc или уходом со слайда.
  document.querySelectorAll('[data-ser-open]').forEach((btn) => {
    const slide = btn.closest('.slide');
    const modal = slide?.querySelector('.ser-modal');
    if (!modal) return;

    const close = () => {
      modal.hidden = true;
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.hidden = false;
    });
    modal.querySelectorAll('[data-ser-close]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') close();
    });
    new MutationObserver(() => {
      if (!slide.classList.contains('active')) close();
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
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

  // ---------- Обмен клиент ↔ сервер: запрос, ответ, режим jsx-only ----------
  // Галочка меняет не картинку, а содержимое ответа: с ней сервер отдаёт
  // дерево, без неё — HTML-страницу. Тексты обеих веток лежат в разметке
  // (.wire-variant), скрипт гоняет пакеты и переключает текущую ветку.
  document.querySelectorAll('[data-wire]').forEach((wire) => {
    const track = wire.querySelector('.wire-track');
    const req = wire.querySelector('[data-wire-req]');
    const res = wire.querySelector('[data-wire-res]');
    const server = wire.querySelector('[data-wire-server]');
    const flag = wire.querySelector('[data-wire-flag]');
    const run = wire.querySelector('[data-wire-run]');
    const variants = [...wire.querySelectorAll('[data-wire-variant]')];
    const slide = wire.closest('.slide');
    if (!track || !req || !res || !server || !flag || !run || !slide) return;

    let timers = [];
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const after = (ms, fn) => timers.push(setTimeout(fn, ms));

    const mode = () => (flag.checked ? 'jsx' : 'html');

    function sync() {
      wire.classList.toggle('is-jsx', flag.checked);
      res.textContent = flag.checked ? 'дерево JSX · строка' : 'HTML-страница';
      variants.forEach((v) => v.classList.toggle('is-on', v.dataset.wireVariant === mode()));
    }

    function reset() {
      clear();
      wire.classList.remove('is-req', 'is-res', 'is-done');
      server.classList.remove('is-busy');
      run.disabled = false;
    }

    function play() {
      clear();
      wire.classList.remove('is-req', 'is-res', 'is-done');
      server.classList.remove('is-busy');
      run.disabled = true;

      // Пакет летит на всю дорожку за вычетом собственной ширины: обе величины
      // известны только после раскладки, поэтому дистанция считается здесь.
      wire.style.setProperty('--wire-dist', `${track.clientWidth - req.offsetWidth}px`);

      // Перезапуск анимации после снятия класса требует нового кадра.
      requestAnimationFrame(() => wire.classList.add('is-req'));

      after(900, () => {
        wire.classList.remove('is-req');
        server.classList.add('is-busy');
      });
      after(1400, () => {
        server.classList.remove('is-busy');
        wire.classList.add('is-res');
      });
      after(2300, () => {
        wire.classList.remove('is-res');
        wire.classList.add('is-done');
        run.disabled = false;
      });
    }

    flag.addEventListener('change', () => {
      sync();
      reset();
    });
    run.addEventListener('click', (e) => {
      e.stopPropagation();
      play();
    });

    // Ушли со слайда — обмен начинается сначала.
    new MutationObserver(() => {
      if (!slide.classList.contains('active')) reset();
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });

    sync();
  });

  // ---------- «Может ли компонент быть серверным?»: разбор в два клика ----------
  // Клик по коду открывает следующую причину: строка краснеет, справа выезжает
  // карточка. Причин две, третий клик начинает сначала — на выступлении разбор
  // часто показывают дважды. Тексты причин лежат в разметке (.ask-card).
  document.querySelectorAll('[data-ask]').forEach((ask) => {
    const code = ask.querySelector('[data-ask-code]');
    const hint = ask.querySelector('[data-ask-hint]');
    const lines = [...ask.querySelectorAll('[data-ask-line]')];
    const cards = [...ask.querySelectorAll('[data-ask-card]')];
    const slide = ask.closest('.slide');
    if (!code || !lines.length || !slide) return;

    const hints = [
      'Нажмите на код — разберём по причинам',
      'Причина не одна: нажмите ещё раз',
      'Ответ: нет, только клиентским. Нажмите, чтобы начать сначала',
    ];

    let step = 0;

    function render() {
      lines.forEach((line) => {
        const n = Number(line.dataset.askLine);
        line.classList.toggle('is-bad', n <= step);
        line.classList.toggle('is-current', n === step);
      });
      cards.forEach((card) => {
        card.classList.toggle('is-on', Number(card.dataset.askCard) <= step);
      });
      ask.classList.toggle('is-done', step === lines.length);
      if (hint) hint.textContent = hints[Math.min(step, hints.length - 1)];
    }

    function go(delta) {
      const target = step + delta;
      if (target < 0 || target > lines.length) return false;
      step = target;
      render();
      return true;
    }

    code.addEventListener('click', (e) => {
      e.stopPropagation();
      step = step >= lines.length ? 0 : step + 1;
      render();
    });

    // Стрелки открывают причины и только потом листают слайды: с пульта
    // докладчику доступны именно они. Перехват — по той же причине, что
    // и в разборе рекурсии: обработчик дека висит на document.
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
      if (!slide.classList.contains('active') && step !== 0) {
        step = 0;
        render();
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });

    render();
  });

  // ---------- Разделение компонента: код уезжает влево, части встают справа ----------
  // Слайд открывается кодом с предыдущего слайда — разговор продолжается с того
  // же места. Клик разводит его на серверную и клиентскую части; повторный клик
  // собирает обратно, чтобы показать разделение ещё раз.
  document.querySelectorAll('[data-split]').forEach((split) => {
    const hint = split.querySelector('[data-split-hint]');
    const slide = split.closest('.slide');
    if (!slide) return;

    const hints = ['Нажмите — разделим компонент на части', 'Наведите на клиентскую часть'];

    function render(on) {
      split.classList.toggle('is-split', on);
      if (hint) hint.textContent = hints[on ? 1 : 0];
    }

    split.addEventListener('click', (e) => {
      e.stopPropagation();
      render(!split.classList.contains('is-split'));
    });

    // Стрелка вправо сначала разделяет код и только потом листает слайд.
    document.addEventListener(
      'keydown',
      (e) => {
        if (!slide.classList.contains('active')) return;
        const on = split.classList.contains('is-split');
        if (e.key === 'ArrowRight' && !on) render(true);
        else if (e.key === 'ArrowLeft' && on) render(false);
        else return;
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    // Ушли со слайда — код снова целый.
    new MutationObserver(() => {
      if (!slide.classList.contains('active')) render(false);
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
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
