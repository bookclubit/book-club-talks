// talk.js — поведение контентных слайдов ЭТОГО доклада
// («Распределённые системы», глава 1).
// Общий движок (клавиши, масштаб, прогресс) живёт в deck.js и правится только
// в шаблоне. Здесь то, чего в нём нет: порядок появления блоков на слайде,
// переход на слайд по клику (плитки, карта доклада, «рельса» вверху, кнопки
// примеров), раскрытие блока «Как это работает», переключатели демонстраций
// (сеть из шести узлов, византийские генералы, диаграмма CAP, пример с двумя
// узлами) и панель заметок докладчика.

(function () {
  const slides = [...document.querySelectorAll('.slide')];

  // ---------- Появление блоков ----------
  // Сама анимация — в talk.css и привязана к .slide.active, поэтому
  // проигрывается при каждом входе на слайд. Здесь только разметка: какие
  // блоки участвуют (data-rv = вид появления) и в каком порядке (--d).
  // Порядок — порядок чтения в разметке; шаг сжимается, если блоков много,
  // чтобы слайд собирался примерно за две секунды. Без этого скрипта слайды
  // просто показываются сразу целиком.
  const REVEAL = [
    ['.quad-cell, .kind, .letter, .fact, .chain > .cn, .role, .mp, .prop', 'pop'],
    ['.tbl-r', 'left'],
    ['.card, .wide-accent, .sp, .chart-box, .section-label, .fig, .seg, .two-row, .formula', 'up'],
  ];
  const ALL = REVEAL.map(([sel]) => sel).join(', ') + ', [data-rv]';

  slides.forEach((slide) => {
    const root = slide.querySelector('.content-slide');
    if (!root) return;
    // Подписи демонстраций (.cap) появляются своим правилом при смене состояния.
    const all = [...root.querySelectorAll(ALL)].filter((el) => !el.closest('svg, .cap'));
    // Блоки внутри «Как это работает» появляются при его раскрытии, поэтому
    // у каждого такого блока свой отсчёт задержек — не с начала слайда.
    const hows = [...root.querySelectorAll('.how')];
    const groups = [all.filter((el) => !el.closest('.how')), ...hows.map((how) => all.filter((el) => how.contains(el)))];
    groups.forEach((items, g) => {
      const step = Math.max(45, Math.min(110, 1900 / Math.max(items.length, 1)));
      items.forEach((el, i) => {
        el.style.setProperty('--d', `${Math.round((g ? 150 : 250) + i * step)}ms`);
        if (el.hasAttribute('data-rv')) return;
        const rule = REVEAL.find(([sel]) => el.matches(sel));
        el.setAttribute('data-rv', rule ? rule[1] : 'up');
      });
    });
    // Номер в ряду — для бегущих точек на стрелках (они идут волной).
    root.querySelectorAll('.chain, .steps4').forEach((row) => {
      [...row.children].forEach((child, k) => child.style.setProperty('--k', k));
    });
  });

  // ---------- Переход на слайд по клику ----------
  // Своего API у deck.js нет, поэтому «перематываем» дек теми же стрелками,
  // которые он слушает: прогресс и заметки остаются в согласии с движком.
  function gotoSlide(index) {
    const from = slides.findIndex((sl) => sl.classList.contains('active'));
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
      // Иначе фокус остался бы на кнопке, а с ним — открытая подсказка.
      el.blur();
    });
  });

  // ---------- «Как это работает» ----------
  // Необязательный блок слайда: на слайде от него только кнопка с пунктирной
  // рамкой, схема или демонстрация раскрывается поверх слайда. Закрывается
  // той же кнопкой, «свернуть», Esc и при уходе со слайда.
  const hows = [...document.querySelectorAll('.how')];
  const howBtns = [...document.querySelectorAll('[data-how]')];

  function closeHows() {
    hows.forEach((h) => h.classList.remove('is-open'));
    howBtns.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
  }

  howBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = document.getElementById('how-' + btn.dataset.how);
      const open = !target.classList.contains('is-open');
      closeHows();
      target.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.blur();
    });
  });

  document.querySelectorAll('.how-close').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeHows();
    });
  });

  // ---------- Переключатели демонстраций ----------
  // Вся смена картинки — на CSS: кнопка лишь пишет data-state в блок-цель,
  // а стили решают, что показать. Исходное состояние запоминаем из разметки:
  // к нему возвращаемся при уходе со слайда, чтобы докладчик всегда начинал
  // показ с чистой картинки.
  const segs = [...document.querySelectorAll('.seg[data-target]')];

  function applyState(seg, value) {
    const target = document.getElementById(seg.getAttribute('data-target'));
    if (!target) return;
    target.setAttribute('data-state', value);
    seg.querySelectorAll('button[data-value]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-value') === value);
    });
  }

  segs.forEach((seg) => {
    const target = document.getElementById(seg.getAttribute('data-target'));
    seg.dataset.initial = target ? target.getAttribute('data-state') || '' : '';
    seg.querySelectorAll('button[data-value]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyState(seg, btn.getAttribute('data-value'));
        btn.blur();
      });
    });
  });

  function resetSlide(slide) {
    slide.querySelectorAll('.seg[data-target]').forEach((seg) => applyState(seg, seg.dataset.initial));
    closeHows();
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
    if (e.key === 'Escape') {
      setNotesOpen(false);
      closeHows();
    }
  });

  // Слайд меняет deck.js — ловим это по классу active: обновляем заметки,
  // а ушедший слайд возвращаем в исходный вид.
  slides.forEach((slide) => {
    let wasActive = slide.classList.contains('active');
    new MutationObserver(() => {
      const isActive = slide.classList.contains('active');
      if (isActive === wasActive) return;
      wasActive = isActive;
      if (isActive) {
        if (panel.classList.contains('is-open')) renderNotes();
      } else {
        resetSlide(slide);
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  });
})();
