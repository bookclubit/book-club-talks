// talk.js — поведение контентных слайдов ЭТОГО доклада
// («Развитие блокчейна», глава 1).
// Общий движок (клавиши, масштаб, прогресс) живёт в deck.js и правится только
// в шаблоне. Здесь то, чего в нём нет: порядок появления блоков на слайде,
// переход на слайд по клику (точки таймлайна, «рельса» вверху, карточки
// технологий, название этапа в шапке), раскрытие блока «Как это работает»,
// счётчики и панель заметок докладчика.
// Подсказки таймлайна — чистый CSS (:hover / :focus-visible), скрипт им не нужен.

(function () {
  const slides = [...document.querySelectorAll('.slide')];

  // ---------- Появление блоков ----------
  // Сама анимация — в talk.css и привязана к .slide.active, поэтому
  // проигрывается при каждом входе на слайд. Блоки помечены в разметке
  // (data-rv = вид появления), здесь раздаются только задержки (--d) в порядке
  // чтения. Шаг сжимается, если блоков много, чтобы слайд собирался примерно
  // за полторы секунды. Без этого скрипта блоки появляются одновременно.
  slides.forEach((slide) => {
    const items = [...slide.querySelectorAll('.content-slide [data-rv]')];
    const step = Math.max(60, Math.min(130, 1500 / Math.max(items.length, 1)));
    items.forEach((el, i) => el.style.setProperty('--d', `${Math.round(200 + i * step)}ms`));
  });

  // ---------- Счётчики ----------
  // Число «набегает» от нуля до значения, когда слайд открыт. Итоговый текст
  // лежит в разметке — к нему возвращаемся при уходе со слайда, и он же
  // остаётся на экране, если анимации отключены.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = new WeakMap();
  const finals = new WeakMap();

  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const holder = el.closest('[data-rv]') || el;
    const delay = parseFloat(getComputedStyle(holder).getPropertyValue('--d')) || 300;
    const duration = 1300;
    el.textContent = '0';
    const startAt = performance.now() + delay;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - startAt) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) timers.set(el, requestAnimationFrame(tick));
      else el.textContent = el.dataset.final;
    };
    timers.set(el, requestAnimationFrame(tick));
    // Кадры анимации браузер выдаёт только видимой вкладке. Если слайд открыли
    // в фоне, число не должно застрять на нуле — ставим итог по таймеру.
    finals.set(el, setTimeout(() => { el.textContent = el.dataset.final; }, delay + duration + 400));
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
      clearTimeout(finals.get(el));
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
      // Иначе фокус остался бы на кнопке, а с ним — открытая подсказка.
      el.blur();
    });
  });

  // ---------- «Как это работает» ----------
  // Необязательный блок слайда технологии: на слайде от него только кнопка
  // с пунктирной рамкой, схема раскрывается поверх слайда. Закрывается той же
  // кнопкой, «свернуть», Esc и при уходе со слайда.
  const hows = [...document.querySelectorAll('.how')];
  const howBtns = [...document.querySelectorAll('[data-how]')];

  function closeHows() {
    hows.forEach((h) => h.classList.remove('is-open'));
    howBtns.forEach((b) => b.setAttribute('aria-expanded', 'false'));
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

  // Слайд меняет deck.js — ловим это по классу active: на входе запускаем
  // счётчики, на выходе возвращаем их к итоговым значениям.
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
        stopCounters(slide);
        closeHows();
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  });
})();
