// talk.js — поведение контентных слайдов ЭТОГО доклада
// («Что такое алгоритмы», глава 1).
// Общий движок (клавиши, масштаб, прогресс) живёт в deck.js и правится только
// в шаблоне. Здесь то, чего в нём нет: переключатели демонстраций, раскрытие
// решений упражнений и панель заметок докладчика.

(function () {
  // ---------- Переключатели демонстраций ----------
  // Вся смена картинки — на CSS: кнопка лишь пишет data-state в блок-цель,
  // а стили в talk.css решают, что показать (маршрут, резинку, ядра).
  // Так демонстрации не зависят друг от друга и не копят состояние в JS.
  const segs = [...document.querySelectorAll('[data-seg]')];

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
    // Исходное состояние запоминаем разметкой: к нему возвращаемся при уходе
    // со слайда, чтобы докладчик всегда начинал показ с чистой картинки.
    seg.dataset.initial = target ? target.getAttribute('data-state') || '' : '';
    seg.querySelectorAll('button[data-value]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyState(seg, btn.getAttribute('data-value'));
      });
    });
  });

  // Кнопка-тумблер: один клик включает демонстрацию, второй — сбрасывает.
  const toggles = [...document.querySelectorAll('[data-demo-toggle]')];

  function applyToggle(btn, on) {
    const target = document.getElementById(btn.getAttribute('data-target'));
    if (!target) return;
    target.setAttribute('data-state', on ? 'on' : 'off');
    btn.classList.toggle('is-on', on);
    const label = btn.querySelector('.btn-label');
    if (label) label.textContent = on ? btn.dataset.labelOn : btn.dataset.labelOff;
  }

  toggles.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = document.getElementById(btn.getAttribute('data-target'));
      applyToggle(btn, target.getAttribute('data-state') !== 'on');
    });
  });

  // ---------- Упражнения: решение скрыто до клика ----------
  document.querySelectorAll('.ex-toggle').forEach((btn) => {
    const ex = btn.closest('.ex');
    if (!ex) return;
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !ex.classList.contains('is-open');
      ex.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      const label = btn.querySelector('.btn-label');
      if (label) label.textContent = open ? 'Скрыть решение' : 'Показать решение';
    });
  });

  // ---------- Возврат слайда в исходный вид ----------
  // Уход со слайда — общий повод всё свернуть: возвращаясь, докладчик должен
  // видеть слайд таким же, каким увидит его зал в первый раз.
  function resetSlide(slide) {
    slide.querySelectorAll('.ex.is-open').forEach((ex) => {
      ex.classList.remove('is-open');
      const btn = ex.querySelector('.ex-toggle');
      if (!btn) return;
      btn.setAttribute('aria-expanded', 'false');
      const label = btn.querySelector('.btn-label');
      if (label) label.textContent = 'Показать решение';
    });
    slide.querySelectorAll('[data-seg]').forEach((seg) => applyState(seg, seg.dataset.initial));
    slide.querySelectorAll('[data-demo-toggle]').forEach((btn) => applyToggle(btn, false));
  }

  const slides = [...document.querySelectorAll('.slide')];

  // ---------- Заметки докладчика ----------
  // Текст лежит в самом слайде (<aside class="notes">), панель собирается тут:
  // она вне масштабируемой сцены, поэтому читается при любом размере окна.
  const panel = document.createElement('div');
  panel.className = 'notes-panel';
  panel.innerHTML =
    '<div class="notes-panel-head"><span>Заметки докладчика</span>' +
    '<span class="notes-panel-slide"></span><span>N — скрыть</span></div>' +
    '<div class="notes-panel-body"></div>';
  document.body.appendChild(panel);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'notes-toggle';
  toggle.textContent = 'N — заметки';
  document.body.appendChild(toggle);

  const body = panel.querySelector('.notes-panel-body');
  const counter = panel.querySelector('.notes-panel-slide');

  function activeSlide() {
    return slides.find((s) => s.classList.contains('active'));
  }

  function renderNotes() {
    const slide = activeSlide();
    if (!slide) return;
    const notes = slide.querySelector('.notes');
    body.innerHTML = notes
      ? notes.innerHTML
      : '<p>К этому слайду заметок нет.</p>';
    counter.textContent = `Слайд ${slides.indexOf(slide) + 1} из ${slides.length}`;
  }

  function setNotesOpen(open) {
    panel.classList.toggle('is-open', open);
    toggle.textContent = open ? 'N — скрыть заметки' : 'N — заметки';
    if (open) renderNotes();
  }

  toggle.addEventListener('click', () => setNotesOpen(!panel.classList.contains('is-open')));

  document.addEventListener('keydown', (e) => {
    // Латинская N и русская Т — одна и та же клавиша при любой раскладке.
    if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
      e.preventDefault();
      setNotesOpen(!panel.classList.contains('is-open'));
    }
    if (e.key === 'Escape') setNotesOpen(false);
  });

  // Слайд меняет deck.js — ловим это по классу active: одним наблюдателем
  // и сбрасываем демонстрации ушедшего слайда, и обновляем заметки пришедшего.
  slides.forEach((slide) => {
    new MutationObserver(() => {
      if (slide.classList.contains('active')) {
        if (panel.classList.contains('is-open')) renderNotes();
      } else {
        resetSlide(slide);
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  });
})();
