// talk.js — поведение контентных слайдов: одна всплывающая подсказка на весь дек.
// Подсказка живёт в body, а не на сцене: её размер не зависит от масштаба
// слайда, и она не обрезается краем схемы. Элементы с data-tip доступны с клавиатуры.
(function () {
  const tip = document.createElement('div');
  tip.className = 'tip-float';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  const stage = document.getElementById('deckStage');
  const place = (el) => {
    const k = stage ? stage.getBoundingClientRect().width / 1920 : 1;
    tip.style.fontSize = `${Math.max(13, 23 * k)}px`;
    tip.style.maxWidth = `${Math.max(280, 560 * k)}px`;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 10;
    let top = r.top - t.height - gap;
    if (top < 8) top = r.bottom + gap;
    if (top + t.height > innerHeight - 8) top = Math.max(8, innerHeight - t.height - 8);
    const left = Math.min(innerWidth - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  };
  const show = (el) => {
    tip.textContent = el.dataset.tip;
    place(el);
    tip.classList.add('is-on');
  };
  const hide = () => tip.classList.remove('is-on');

  document.querySelectorAll('[data-tip]').forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', hide);
  });
  document.addEventListener('keydown', hide);
})();

// Шаги, подсветка по наведению и карточки по клику.
// data-step="1" — блок спрятан, пока слайд не дошёл до шага: клик по слайду
// или «вперёд» (→, пробел, PageDown) сначала открывают шаги, потом листают.
// data-hl="ключ" — при наведении слайд получает data-hl, CSS подсвечивает
// своё; с data-hl-keep подсветка остаётся до наведения на соседа.
// data-modal="id" — открывает карточку .mdl-c внутри слайда; закрывают
// Esc, стрелки, клик мимо карточки и крестик. Вход на слайд всё сбрасывает.
(function () {
  const slides = [...document.querySelectorAll('.slide')];
  const forward = ['ArrowRight', ' ', 'PageDown'];

  const total = (s) => Math.max(0, ...[...s.querySelectorAll('[data-step]')].map((el) => +el.dataset.step || 1));
  const setAt = (s, n) => {
    s.dataset.at = n;
    s.querySelectorAll('[data-step]').forEach((el) => el.classList.toggle('is-shown', (+el.dataset.step || 1) <= n));
  };
  const advance = (s) => {
    const at = +s.dataset.at || 0;
    if (at >= total(s)) return false;
    setAt(s, at + 1);
    return true;
  };

  // Внутри шага блоки появляются заново, когда шаг открыт, — задержки
  // считаем от начала шага, а не слайда.
  document.querySelectorAll('[data-step]').forEach((box) => {
    box.querySelectorAll('[data-rv]').forEach((el, i) => el.style.setProperty('--d', `${120 + i * 110}ms`));
  });

  const clearHl = (s) => {
    delete s.dataset.hl;
    s.querySelectorAll('[data-hl].is-on').forEach((el) => el.classList.remove('is-on'));
  };
  document.querySelectorAll('[data-hl]').forEach((el) => {
    const s = el.closest('.slide');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    const on = () => {
      s.dataset.hl = el.dataset.hl;
      s.querySelectorAll('[data-hl]').forEach((x) => x.classList.toggle('is-on', x === el));
    };
    const off = () => { if (!el.hasAttribute('data-hl-keep')) clearHl(s); };
    el.addEventListener('mouseenter', on);
    el.addEventListener('focus', on);
    el.addEventListener('mouseleave', off);
    el.addEventListener('blur', off);
  });

  const closeModals = () => document.querySelectorAll('.mdl.is-on').forEach((m) => m.classList.remove('is-on'));
  document.querySelectorAll('[data-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.slide').querySelector(`#${btn.dataset.modal}`);
      if (!card) return;
      const layer = card.closest('.mdl');
      layer.querySelectorAll('.mdl-c').forEach((c) => c.classList.toggle('is-on', c === card));
      layer.classList.add('is-on');
    });
  });
  document.querySelectorAll('.mdl').forEach((layer) => {
    layer.addEventListener('click', (e) => {
      if (e.target === layer || e.target.closest('[data-close]')) closeModals();
    });
  });

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('.mdl.is-on')) {
      if (e.key === 'Escape' || e.key.startsWith('Arrow') || forward.includes(e.key) || e.key === 'PageUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeModals();
      }
      return;
    }
    if (!forward.includes(e.key)) return;
    const s = document.querySelector('.slide.active');
    if (s && advance(s)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  slides.forEach((s) => {
    const stepped = total(s) > 0;
    if (stepped) {
      setAt(s, 0);
      s.addEventListener('click', (e) => {
        if (!s.classList.contains('active') || e.target.closest('a, .notes')) return;
        advance(s);
      });
    }
    let was = s.classList.contains('active');
    new MutationObserver(() => {
      const now = s.classList.contains('active');
      if (now && !was) {
        if (stepped) setAt(s, 0);
        clearHl(s);
      }
      if (!now && was) closeModals();
      was = now;
    }).observe(s, { attributes: true, attributeFilter: ['class'] });
  });
})();

// Курсор обхода: запускается при входе на слайд, замирает при выходе.
// При сокращении движения остаётся только статическая схема.
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('svg[data-cursor-route]').forEach((svg) => {
    const slide = svg.closest('.slide');
    const sync = () => {
      svg.pauseAnimations();
      svg.setCurrentTime(0);
      svg.querySelectorAll('circle').forEach((dot) => {
        dot.style.visibility = reduced.matches ? 'hidden' : '';
      });
      if (slide.classList.contains('active') && !reduced.matches) svg.unpauseAnimations();
    };
    new MutationObserver(sync).observe(slide, { attributes: true, attributeFilter: ['class'] });
    reduced.addEventListener('change', sync);
    sync();
  });
})();

// Вкладки .tbs: клик по номеру показывает свою панель, а слайд получает
// data-tab — по нему CSS меняет метки на резюме («куда ляжет раздел»).
// Вход на слайд возвращает первую вкладку.
(function () {
  document.querySelectorAll('.tbs').forEach((box) => {
    const s = box.closest('.slide');
    const btns = [...box.querySelectorAll('[data-tab]')];
    const panes = [...box.querySelectorAll('[data-pane]')];
    const show = (n) => {
      s.dataset.tab = n;
      btns.forEach((b) => {
        const on = b.dataset.tab === n;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
        if (box.classList.contains('codasyl-cost-tabs')) b.tabIndex = on ? 0 : -1;
      });
      panes.forEach((p) => p.classList.toggle('is-on', p.dataset.pane === n));
      s.querySelectorAll('.cv-to').forEach((el) => {
        el.classList.remove('is-new');
        void el.offsetWidth;
        el.classList.add('is-new');
      });
    };
    btns.forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      show(b.dataset.tab);
    }));
    if (box.classList.contains('codasyl-cost-tabs')) {
      btns.forEach((b, i) => b.addEventListener('keydown', (e) => {
        let next;
        if (e.key === 'ArrowRight') next = (i + 1) % btns.length;
        else if (e.key === 'ArrowLeft') next = (i + btns.length - 1) % btns.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = btns.length - 1;
        else return;
        e.preventDefault();
        e.stopPropagation();
        btns[next].click();
        btns[next].focus();
      }));
    }
    show('1');
    let was = s.classList.contains('active');
    new MutationObserver(() => {
      const now = s.classList.contains('active');
      if (now && !was) show('1');
      was = now;
    }).observe(s, { attributes: true, attributeFilter: ['class'] });
  });
})();

// Обходы CODASYL: один курсор, текущая строка и видимое состояние вложенных циклов.
(function () {
  const slide = document.getElementById('slide-codasyl-code-cost');
  const data = document.getElementById('cost-walk-data');
  if (!slide || !data) return;
  const walks = JSON.parse(data.textContent);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const play = slide.querySelector('[data-walk-play]');
  const next = slide.querySelector('[data-walk-next]');
  const reset = slide.querySelector('[data-walk-reset]');
  let pane = null;
  let steps = [];
  let index = 0;
  let elapsed = 0;
  let lastTime = null;
  let frame = 0;
  let paused = false;
  let complete = false;
  let wasActive = false;
  let path = null;
  let pathLength = 0;
  let dot = null;

  const controls = () => {
    play.hidden = reduced.matches;
    play.textContent = complete ? 'Повторить' : paused ? 'Продолжить' : 'Пауза';
    next.disabled = complete;
    if (pane) pane.dataset.walkRunning = String(Boolean(frame));
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    controls();
  };
  const positionDot = (progress) => {
    if (!path || !dot || reduced.matches) return;
    const point = path.getPointAtLength(pathLength * progress);
    dot.setAttribute('cx', point.x);
    dot.setAttribute('cy', point.y);
  };
  const render = () => {
    const step = steps[index];
    pane.dataset.walkStep = index;
    pane.dataset.walkKind = step.skip ? 'skip' : step.restore ? 'restore' : step.save ? 'save' : 'read';
    pane.querySelectorAll('.is-current').forEach((el) => el.classList.remove('is-current'));
    pane.querySelector('[data-walk-count]').textContent = `${index + 1} / ${steps.length}`;
    pane.querySelector('[data-walk-message]').textContent = step.text;
    const result = steps.slice(0, index + 1).reduce((value, s) => s.result ?? value, '—');
    pane.querySelector('[data-walk-result]').textContent = result;
    if (pane.querySelector('[data-walk-outer]')) {
      pane.querySelector('[data-walk-outer]').textContent = step.outer;
      pane.querySelector('[data-walk-inner]').textContent = step.inner;
    }
    step.lines.forEach((line) => pane.querySelector(`[data-walk-line="${line}"]`)?.classList.add('is-current'));
    if (step.node) pane.querySelector(`[data-walk-node="${step.node}"]`)?.classList.add('is-current');
    path = step.edge ? pane.querySelector(`[data-walk-edge="${step.edge}"]`) : null;
    if (path) path.classList.add('is-current', 'is-visited');
    pathLength = path ? path.getTotalLength() : 0;
    dot = pane.querySelector('[data-walk-dot]');
    dot.setAttribute('visibility', path && !reduced.matches ? 'visible' : 'hidden');
    positionDot(paused ? 1 : 0);
    controls();
  };
  const allowed = () => slide.classList.contains('active') && !document.hidden && !reduced.matches && !paused && !complete;
  const tick = (time) => {
    if (!allowed()) { stop(); return; }
    if (lastTime !== null) elapsed += Math.min(time - lastTime, 100);
    lastTime = time;
    positionDot(Math.min(elapsed / 1100, 1));
    if (elapsed >= (steps[index].duration || 1900)) {
      elapsed = 0;
      if (index === steps.length - 1) {
        complete = true;
        stop();
        return;
      }
      index += 1;
      render();
    }
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (allowed() && !frame) {
      lastTime = null;
      frame = requestAnimationFrame(tick);
    }
    controls();
  };
  const begin = () => {
    stop();
    index = 0;
    elapsed = 0;
    complete = false;
    pane.querySelectorAll('.is-visited').forEach((el) => el.classList.remove('is-visited'));
    render();
    start();
  };
  const sync = () => {
    const active = slide.classList.contains('active');
    const selected = slide.querySelector('.codasyl-cost-tabs .tbs-p.is-on');
    if (selected && (selected !== pane || (active && !wasActive))) {
      pane = selected;
      steps = walks[pane.dataset.pane];
      begin();
    }
    wasActive = active;
    if (active) start();
    else stop();
  };
  play.addEventListener('click', (event) => {
    event.stopPropagation();
    if (complete) { paused = false; begin(); return; }
    paused = !paused;
    if (paused) stop();
    else start();
  });
  next.addEventListener('click', (event) => {
    event.stopPropagation();
    paused = true;
    stop();
    if (index < steps.length - 1) index += 1;
    elapsed = 0;
    complete = index === steps.length - 1;
    render();
  });
  reset.addEventListener('click', (event) => {
    event.stopPropagation();
    paused = reduced.matches;
    begin();
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { paused = true; stop(); }
    if (pane) render();
    start();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  new MutationObserver(sync).observe(slide, { attributes: true, attributeFilter: ['class', 'data-tab'] });
  sync();
})();
