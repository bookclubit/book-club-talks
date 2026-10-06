// talk.js — поведение контентных слайдов ЭТОГО доклада
// («Распределённые системы», глава 1).
// Общий движок (клавиши, масштаб, прогресс) живёт в deck.js и правится только
// в шаблоне. Здесь то, чего в нём нет: порядок появления блоков на слайде,
// шаги примера «два узла и оборванный провод», переход по карточкам плана
// и панель заметок докладчика.

(function () {
  const slides = [...document.querySelectorAll('.slide')];

  // ---------- Появление блоков ----------
  // Сама анимация — в talk.css и привязана к .slide.active, поэтому
  // проигрывается при каждом входе на слайд. Блоки помечены в разметке
  // (data-rv), здесь раздаются только задержки в порядке чтения: --d — когда
  // появиться самому блоку, --s — когда начинать собираться схеме внутри него
  // (узлы, каналы, подписи). Без этого скрипта слайд показывается сразу целиком.
  slides.forEach((slide) => {
    const items = [...slide.querySelectorAll('.content-slide [data-rv]')];
    const step = Math.max(70, Math.min(150, 1500 / Math.max(items.length, 1)));
    items.forEach((el, i) => {
      const d = Math.round(180 + i * step);
      el.style.setProperty('--d', `${d}ms`);
      el.style.setProperty('--s', `${d + 350}ms`);
    });
  });

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

  // ---------- Шаги демонстрации ----------
  // Вся смена картинки — на CSS: кнопка лишь пишет data-state в блок-цель,
  // а стили решают, что показать. Исходное состояние запоминаем из разметки:
  // к нему возвращаемся при уходе со слайда, чтобы докладчик всегда начинал
  // показ с первого шага.
  const stepBars = [...document.querySelectorAll('.steps[data-target]')];

  function applyState(bar, value) {
    const target = document.getElementById(bar.getAttribute('data-target'));
    if (!target) return;
    target.setAttribute('data-state', value);
    bar.querySelectorAll('button[data-value]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-value') === value);
    });
  }

  stepBars.forEach((bar) => {
    const target = document.getElementById(bar.getAttribute('data-target'));
    bar.dataset.initial = target ? target.getAttribute('data-state') || '' : '';
    bar.querySelectorAll('button[data-value]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyState(bar, btn.getAttribute('data-value'));
        btn.blur();
      });
    });
  });

  function resetSlide(slide) {
    slide.querySelectorAll('.steps[data-target]').forEach((bar) => applyState(bar, bar.dataset.initial));
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
