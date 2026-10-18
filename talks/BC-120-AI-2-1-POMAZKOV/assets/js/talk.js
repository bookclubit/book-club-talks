// talk.js — поведение контентных слайдов доклада (глава 2 «AI-инженерии»).
// Общий движок (клавиши, масштаб, прогресс, тема) — в deck.js, он правится
// только в шаблоне. Здесь то, чего в нём нет: порядок появления блоков,
// счётчики, «токены» и частицы, которые проще собрать скриптом, чем
// выписывать руками, HUD-строка внизу слайда и панель заметок докладчика.
// Без этого скрипта слайды показываются целиком, просто без задержек.

(function () {
  const slides = [...document.querySelectorAll('.slide')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Ячейки: токены, точки, частицы ----------
  // data-cells="72" — строка из 72 «токенов»; у каждого свой --i, чтобы
  // CSS выкладывал их по одному.
  document.querySelectorAll('[data-cells]').forEach((box) => {
    const n = parseInt(box.dataset.cells, 10) || 0;
    box.innerHTML = Array.from({ length: n }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  });
  // Номер по порядку для любых повторяющихся элементов (точки, токены).
  document.querySelectorAll('[data-seq]').forEach((box) => {
    [...box.children].forEach((el, i) => el.style.setProperty('--i', i));
  });

  // Облако частиц «Шоггота»: детерминированный генератор, чтобы картинка
  // не менялась от загрузки к загрузке.
  document.querySelectorAll('[data-particles]').forEach((g) => {
    const [cx, cy, r, count] = g.dataset.particles.split(',').map(Number);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * r;
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('class', 'p');
      c.setAttribute('cx', (cx + Math.cos(a) * d * 1.08).toFixed(1));
      c.setAttribute('cy', (cy + Math.sin(a) * d * 0.92).toFixed(1));
      c.setAttribute('r', (1.5 + rnd() * 3.5).toFixed(1));
      c.style.setProperty('--i', i);
      c.style.setProperty('--dx', `${(rnd() * 16 - 8).toFixed(1)}px`);
      c.style.setProperty('--dy', `${(rnd() * 16 - 8).toFixed(1)}px`);
      c.style.setProperty('--t', `${(3.5 + rnd() * 4).toFixed(1)}s`);
      c.style.opacity = (0.25 + rnd() * 0.6).toFixed(2);
      g.appendChild(c);
    }
  });

  // Длина линий для «прорисовки» SVG-путей.
  document.querySelectorAll('svg [data-draw]').forEach((p, k) => {
    const len = Math.ceil(p.getTotalLength ? p.getTotalLength() : 400);
    p.style.setProperty('--len', len);
    p.style.strokeDasharray = len;
    p.style.setProperty('--k', k);
  });

  // ---------- Появление блоков ----------
  // Анимация — в talk.css (привязана к .slide.active). Здесь только задержки
  // в порядке чтения; шаг сжимается, если блоков много, чтобы слайд
  // собирался примерно за полторы секунды.
  slides.forEach((slide) => {
    const items = [...slide.querySelectorAll('[data-rv]')];
    const step = Math.max(60, Math.min(140, 1500 / Math.max(items.length, 1)));
    items.forEach((el, i) => el.style.setProperty('--d', `${Math.round(180 + i * step)}ms`));
  });

  // ---------- HUD-строка ----------
  // Внизу каждого контентного слайда: книга и тема слева, номер справа.
  const [topic, book] = document.title.split(' — ');
  slides.forEach((slide, i) => {
    if (!slide.classList.contains('fx')) return;
    const hud = document.createElement('div');
    hud.className = 'fx-hud';
    hud.setAttribute('aria-hidden', 'true');
    const pad = (n) => String(n).padStart(2, '0');
    hud.innerHTML = `<span>${book || ''} · Глава 2 · ${topic || ''}</span>` +
      `<span class="pg"><b>${pad(i + 1)}</b> / ${pad(slides.length)}</span>`;
    slide.appendChild(hud);
  });

  // ---------- Счётчики ----------
  // Число «набегает» от нуля, когда слайд открыт. Итоговый текст лежит
  // в разметке — к нему возвращаемся при уходе со слайда, и он же остаётся,
  // если анимации отключены. data-count — значение, data-dec — знаков после
  // запятой; тысячи разделяются узким пробелом, как в итоговом тексте.
  const timers = new WeakMap();
  const finals = new WeakMap();
  const fmt = (v, dec) => {
    const s = v.toFixed(dec).replace('.', ',');
    const [int, frac] = s.split(',');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return frac ? `${grouped},${frac}` : grouped;
  };

  document.querySelectorAll('[data-count]').forEach((el) => {
    el.dataset.final = el.innerHTML;
  });

  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || '0', 10);
    const holder = el.closest('[data-rv]') || el;
    const delay = (parseFloat(getComputedStyle(holder).getPropertyValue('--d')) || 300) + 150;
    const duration = 1400;
    const suffix = el.dataset.suffix || '';
    el.textContent = fmt(0, dec) + suffix;
    const startAt = performance.now() + delay;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - startAt) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased, dec) + suffix;
      if (p < 1) timers.set(el, requestAnimationFrame(tick));
      else el.innerHTML = el.dataset.final;
    };
    timers.set(el, requestAnimationFrame(tick));
    // Кадры браузер выдаёт только видимой вкладке — если слайд открыли
    // в фоне, число не должно застрять на нуле.
    finals.set(el, setTimeout(() => { el.innerHTML = el.dataset.final; }, delay + duration + 400));
  }

  function startCounters(slide) {
    if (reduceMotion) return;
    slide.querySelectorAll('[data-count]').forEach(runCounter);
  }

  function stopCounters(slide) {
    slide.querySelectorAll('[data-count]').forEach((el) => {
      cancelAnimationFrame(timers.get(el));
      clearTimeout(finals.get(el));
      el.innerHTML = el.dataset.final;
    });
  }

  // ---------- Заметки докладчика ----------
  // Текст доклада лежит в самом слайде (<aside class="notes">), панель
  // собирается здесь и открывается клавишей N. Кнопки на экране нет
  // намеренно: она попадала бы в запись.
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
    // Латинская N и русская Т — одна клавиша при любой раскладке.
    if (e.code === 'KeyN' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setNotesOpen(!panel.classList.contains('is-open'));
    }
    if (e.key === 'Escape') setNotesOpen(false);
  });

  // Слайд меняет deck.js — ловим это по классу active.
  slides.forEach((slide) => {
    let wasActive = slide.classList.contains('active');
    if (wasActive) startCounters(slide);
    new MutationObserver(() => {
      const isActive = slide.classList.contains('active');
      if (isActive === wasActive) return;
      wasActive = isActive;
      if (isActive) {
        if (panel.classList.contains('is-open')) renderNotes();
        startCounters(slide);
      } else {
        stopCounters(slide);
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  });
})();
