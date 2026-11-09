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
    show('1');
    let was = s.classList.contains('active');
    new MutationObserver(() => {
      const now = s.classList.contains('active');
      if (now && !was) show('1');
      was = now;
    }).observe(s, { attributes: true, attributeFilter: ['class'] });
  });
})();

// Живое меню (.demo): data-demo="css" — подсветку держит правило CSS,
// data-demo="dom" — стиль ставит императивный код из книги, и он «залипает».
(function () {
  document.querySelectorAll('.demo').forEach((box) => {
    const out = box.querySelector('[data-out]');
    const items = [...box.querySelectorAll('.menu > li')];
    const say = (text, bad) => {
      if (!out) return;
      out.textContent = text;
      out.classList.toggle('is-bad', !!bad);
    };
    const pick = (m) => items.forEach((li) => {
      li.className = li.dataset.m === m ? 'selected' : '';
    });
    const run = () => {
      // тот же алгоритм, что в книге, только внутри демо
      const lis = box.getElementsByTagName('li');
      for (let i = 0; i < lis.length; i++) {
        if (lis[i].className === 'selected') {
          const children = lis[i].childNodes;
          for (let j = 0; j < children.length; j++) {
            const child = children[j];
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'P') child.classList.add('is-js');
          }
        }
      }
    };
    const reset = () => {
      pick('sh');
      box.querySelectorAll('.is-js').forEach((p) => p.classList.remove('is-js'));
      say(box.dataset.demo === 'dom' ? 'Нажмите «Запустить код»' : 'Класс переехал — подсветка переехала за ним');
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.hasAttribute('data-reset')) return reset();
      if (b.hasAttribute('data-run')) {
        run();
        const stuck = items.some((li) => li.className !== 'selected' && li.querySelector('p.is-js'));
        return say(stuck ? 'Подсвечены оба: старый фон никто не снял' : 'Подсветили Sharks', stuck);
      }
      pick(b.dataset.pick);
      if (box.dataset.demo === 'dom') {
        const stuck = items.some((li) => li.className !== 'selected' && li.querySelector('p.is-js'));
        say(stuck ? 'Класс переехал, а фон остался на старом пункте' : 'Класс переехал, но код ещё не запускали', stuck);
      }
    });
    const s = box.closest('.slide');
    let was = s.classList.contains('active');
    new MutationObserver(() => {
      const now = s.classList.contains('active');
      if (now && !was) reset();
      was = now;
    }).observe(s, { attributes: true, attributeFilter: ['class'] });
  });
})();
