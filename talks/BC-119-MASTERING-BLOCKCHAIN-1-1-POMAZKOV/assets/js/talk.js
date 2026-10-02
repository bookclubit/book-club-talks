// talk.js — поведение контентных слайдов ЭТОГО доклада
// («Развитие блокчейна», глава 1).
// Общий движок (клавиши, масштаб, прогресс) живёт в deck.js и правится только
// в шаблоне. Здесь то, чего в нём нет: порядок появления блоков на слайде,
// счётчики, переход на слайд по клику (карта 2008 → 2026), фильтр по статусу
// «произошло / сейчас / план» и панель заметок докладчика.

(function () {
  const slides = [...document.querySelectorAll('.slide')];

  // ---------- Появление блоков ----------
  // Сама анимация — в talk.css и привязана к .slide.active, поэтому
  // проигрывается при каждом входе на слайд. Здесь только разметка: какие
  // блоки участвуют (data-rv = вид появления) и в каком порядке (--d).
  // Порядок — порядок чтения в разметке; шаг сжимается, если блоков много,
  // чтобы слайд собирался примерно за две секунды, а не за десять.
  // Без этого скрипта слайды просто показываются сразу целиком.
  const REVEAL = [
    ['.vs-rev, .au2-id, .bk-cover, .q-old, .cmp-col:not(.is-eth)', 'left'],
    ['.vs-evo, .q-new, .cmp-col.is-eth', 'right'],
    ['.vs-mid, .q-arrow, .cmp-plus', 'pop'],
    ['.fact, .chain > .cn, .fl, .blk, .bk-chip, .cmp-item, .en, .legend > .st, .legend > .filter', 'pop'],
    ['.tbl-r', 'left'],
    [
      '.idea, .th, .sp, .card, .vs-fact, .wide-accent, .layer, .bar, .nb, .chart-box, .ev, .pb, .evo-r, ' +
        '.codebox, .nodes, .eco-legend, .srcs > div, .bk-ed, .section-label, .arch, .isl-card, .isl-fig, ' +
        '.rl-fig, .bc-frame, .bc-inner, .legend-t',
      'up',
    ],
  ];
  const ALL = REVEAL.map(([sel]) => sel).join(', ') + ', [data-seq]';

  slides.forEach((slide) => {
    const root = slide.querySelector('.content-slide');
    if (!root) return;
    // Карта 2008 → 2026 и графики анимируются своими правилами.
    const items = [...root.querySelectorAll(ALL)].filter((el) => !el.closest('.map, svg'));
    const step = Math.max(45, Math.min(110, 1900 / Math.max(items.length, 1)));
    items.forEach((el, i) => {
      el.style.setProperty('--d', `${Math.round(250 + i * step)}ms`);
      if (el.hasAttribute('data-seq') || el.hasAttribute('data-rv')) return;
      const rule = REVEAL.find(([sel]) => el.matches(sel));
      el.setAttribute('data-rv', rule ? rule[1] : 'up');
    });
    // Номер в ряду — для бегущих точек на стрелках (они идут волной).
    root.querySelectorAll('.chain, .thread, .steps4, .flow6').forEach((row) => {
      [...row.children].forEach((child, k) => child.style.setProperty('--k', k));
    });
  });

  // ---------- Счётчики ----------
  // Число «набегает» от нуля до значения, когда слайд открыт. Итоговый текст
  // лежит в разметке — к нему возвращаемся при уходе со слайда, и он же
  // остаётся на экране, если анимации отключены.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = new WeakMap();

  function formatNumber(value, decimals) {
    const [int, frac] = value.toFixed(decimals).split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return frac ? `${grouped},${frac}` : grouped;
  }

  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = Number(el.dataset.dec || 0);
    const pre = el.dataset.pre || '';
    const suf = el.dataset.suf || '';
    const holder = el.closest('[data-rv]') || el;
    const delay = parseFloat(getComputedStyle(holder).getPropertyValue('--d')) || 300;
    const duration = 1500;
    el.textContent = `${pre}${formatNumber(0, decimals)}${suf}`;
    const startAt = performance.now() + delay;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - startAt) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = `${pre}${formatNumber(target * eased, decimals)}${suf}`;
      if (p < 1) timers.set(el, requestAnimationFrame(tick));
      else el.textContent = el.dataset.final;
    };
    timers.set(el, requestAnimationFrame(tick));
  }

  document.querySelectorAll('[data-count]').forEach((el) => {
    el.dataset.final = el.textContent;
  });

  function startCounters(slide) {
    if (reduceMotion) return;
    slide.querySelectorAll('[data-count]').forEach(runCounter);
  }

  function stopCounters(slide) {
    slide.querySelectorAll('[data-count]').forEach((el) => {
      cancelAnimationFrame(timers.get(el));
      el.textContent = el.dataset.final;
    });
  }

  // ---------- Переход на слайд по клику ----------
  // Своего API у deck.js нет, поэтому «перематываем» дек теми же стрелками,
  // которые он слушает: прогресс и заметки остаются в согласии с движком.
  function gotoSlide(index) {
    const from = slides.findIndex((s) => s.classList.contains('active'));
    if (from < 0 || index < 0) return;
    const step = index > from ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < Math.abs(index - from); i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: step }));
    }
  }

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = document.getElementById(`slide-${el.getAttribute('data-goto')}`);
      gotoSlide(slides.indexOf(target));
      el.blur();
    });
  });

  // ---------- Фильтр по статусу ----------
  // Кнопка пишет data-filter в контейнер-цель, остальное решает CSS: так
  // слайд не копит состояние в JS, а уход со слайда сбрасывает фильтр.
  document.querySelectorAll('.filter').forEach((box) => {
    const target = document.getElementById(box.getAttribute('data-target'));
    if (!target) return;
    box.querySelectorAll('button[data-f]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = btn.getAttribute('data-f');
        const next = target.getAttribute('data-filter') === value ? 'all' : value;
        target.setAttribute('data-filter', next);
        box.querySelectorAll('button[data-f]').forEach((b) => {
          b.classList.toggle('is-on', next !== 'all' && b.getAttribute('data-f') === next);
        });
        btn.blur();
      });
    });
  });

  function resetSlide(slide) {
    slide.querySelectorAll('[data-filter]').forEach((el) => el.setAttribute('data-filter', 'all'));
    slide.querySelectorAll('.filter button').forEach((b) => b.classList.remove('is-on'));
    stopCounters(slide);
  }

  // ---------- Заметки докладчика ----------
  // Текст лежит в самом слайде (<aside class="notes">), панель собирается тут:
  // она вне масштабируемой сцены, поэтому читается при любом размере окна.
  // Кнопки-подсказки на экране нет намеренно: она висела бы поверх каждого
  // слайда и попадала в запись. Панель открывается и закрывается клавишей N.
  const panel = document.createElement('div');
  panel.className = 'notes-panel';
  panel.innerHTML =
    '<div class="notes-panel-head"><span>Заметки докладчика</span>' +
    '<span class="notes-panel-slide"></span><span>N — скрыть</span></div>' +
    '<div class="notes-panel-body"></div>';
  document.body.appendChild(panel);

  const body = panel.querySelector('.notes-panel-body');
  const counter = panel.querySelector('.notes-panel-slide');

  function renderNotes() {
    const slide = slides.find((s) => s.classList.contains('active'));
    if (!slide) return;
    const notes = slide.querySelector('.notes');
    body.innerHTML = notes ? notes.innerHTML : '<p>К этому слайду заметок нет.</p>';
    counter.textContent = `Слайд ${slides.indexOf(slide) + 1} из ${slides.length}`;
    panel.scrollTop = 0;
  }

  function setNotesOpen(open) {
    panel.classList.toggle('is-open', open);
    if (open) renderNotes();
  }

  document.addEventListener('keydown', (e) => {
    // Латинская N и русская Т — одна и та же клавиша при любой раскладке.
    if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
      e.preventDefault();
      setNotesOpen(!panel.classList.contains('is-open'));
    }
    if (e.key === 'Escape') setNotesOpen(false);
  });

  // Слайд меняет deck.js — ловим это по классу active: на входе запускаем
  // счётчики, на выходе возвращаем слайд в исходный вид.
  slides.forEach((slide) => {
    let wasActive = slide.classList.contains('active');
    new MutationObserver(() => {
      const isActive = slide.classList.contains('active');
      if (isActive === wasActive) return;
      wasActive = isActive;
      if (isActive) {
        if (panel.classList.contains('is-open')) renderNotes();
        startCounters(slide);
      } else {
        resetSlide(slide);
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  });
})();
