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

  // ---------- Карточки авторов: вклад в алгоритмы по клику ----------
  // Открыта всегда одна карточка: четыре развёрнутых колонки текста зал не
  // читает. Клик по ссылке внутри карточки её не сворачивает.
  const authorCards = [...document.querySelectorAll('.au.is-expandable')];

  function setAuthorOpen(card, open) {
    card.classList.toggle('is-open', open);
    const toggle = card.querySelector('.au-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      const label = toggle.querySelector('.au-toggle-label');
      if (label) label.textContent = open ? 'Свернуть' : 'Вклад в алгоритмы';
    }
    // Свёрнутый вид соседей включает контейнер: карточка не знает, раскрыт ли
    // кто-то другой, а ряду это нужно, чтобы сжать всех, кроме раскрытого.
    const row = card.closest('.authors4');
    if (row) row.classList.toggle('has-open', !!row.querySelector('.au.is-open'));
  }

  authorCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      e.stopPropagation();
      const open = !card.classList.contains('is-open');
      authorCards.forEach((other) => setAuthorOpen(other, other === card && open));
    });
  });

  // ---------- Код с разбором по наведению ----------
  // Слева от листинга висят карточки «вход / алгоритм / выход» с прошлого
  // слайда; какую показать, решает data-echo на общем контейнере. Ставим его
  // из JS, а не селектором :has(), чтобы поведение не зависело от поддержки.
  document.querySelectorAll('.echo-split').forEach((split) => {
    const reset = () => split.setAttribute('data-echo', 'none');
    split.querySelectorAll('.code-region').forEach((region) => {
      region.addEventListener('mouseenter', () =>
        split.setAttribute('data-echo', region.getAttribute('data-region')));
      region.addEventListener('mouseleave', reset);
    });
    split.addEventListener('mouseleave', reset);
  });

  // ---------- Переход на слайд по клику ----------
  // Своего API у deck.js нет, поэтому «перематываем» дек теми же стрелками,
  // которые он слушает: прогресс и заметки остаются в согласии с движком.
  const allSlides = [...document.querySelectorAll('.slide')];

  function gotoSlide(index) {
    const from = allSlides.findIndex((s) => s.classList.contains('active'));
    const step = index > from ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < Math.abs(index - from); i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: step }));
    }
  }

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = document.getElementById(`slide-${btn.getAttribute('data-goto')}`);
      const index = allSlides.indexOf(target);
      if (index >= 0) gotoSlide(index);
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
    slide.querySelectorAll('.echo-split').forEach((s) => s.setAttribute('data-echo', 'none'));
    slide.querySelectorAll('.au.is-open').forEach((card) => setAuthorOpen(card, false));
  }

  const slides = allSlides;

  // ---------- Заметки докладчика ----------
  // Текст лежит в самом слайде (<aside class="notes">), панель собирается тут:
  // она вне масштабируемой сцены, поэтому читается при любом размере окна.
  // Кнопки-подсказки на экране нет намеренно: она висела поверх каждого слайда
  // и попадала в запись. Панель открывается и закрывается клавишей N.
  const panel = document.createElement('div');
  panel.className = 'notes-panel';
  panel.innerHTML =
    '<div class="notes-panel-head"><span>Заметки докладчика</span>' +
    '<span class="notes-panel-slide"></span><span>N — скрыть</span></div>' +
    '<div class="notes-panel-body"></div>';
  document.body.appendChild(panel);

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
