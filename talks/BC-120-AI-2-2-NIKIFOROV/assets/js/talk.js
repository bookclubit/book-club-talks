// talk.js — поведение контентных слайдов ЭТОГО доклада
// (глава 2 «AI-инженерии»; один файл на «Создание модели» и «Сэмплирование»).
// Общий движок (клавиши, масштаб, появление блоков, заметки по N) живёт
// в шаблонном deck.js. Здесь то, чего в нём нет: переключатели схем,
// ползунки калькулятора и сэмплера.
// Каждый блок включается, только если его разметка есть на странице.

(function () {
  const slides = [...document.querySelectorAll('.slide')];

  // Стрелки и пробел листают слайды (deck.js слушает document). Пока фокус
  // на ползунке или кнопке слайда, клавиши должны достаться им.
  document.querySelectorAll('.content-slide input, .content-slide button').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown'].includes(e.key)) e.stopPropagation();
    });
  });

  const fmt = (n, digits = 0) => n.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits });

  function paintRange(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
  }

  // ---------- Внимание: веса линий ----------
  // У линий, процентов и слов оригинала data-w — веса для состояний t1, t2, t3
  // через запятую. Линии чужих слов перевода не показываем вовсе: иначе схема
  // превращается в паутину и не видно, чьи это проценты.
  function paintAttention(box) {
    const idx = ['t1', 't2', 't3'].indexOf(box.getAttribute('data-state'));
    const weight = (el) => Number(el.getAttribute('data-w').split(',')[idx]) || 0;
    box.querySelectorAll('.aw').forEach((line) => {
      const w = weight(line);
      line.style.strokeWidth = `${2 + w * 22}px`;
      line.style.opacity = w > 0 ? String(0.35 + w * 0.65) : '0';
    });
    box.querySelectorAll('.aw-l').forEach((label) => {
      label.textContent = `${Math.round(weight(label) * 100)}%`;
    });
    box.querySelectorAll('.aw-cap').forEach((cap) => {
      cap.textContent = cap.getAttribute('data-caps').split('|')[idx] || '';
    });
    const inputs = [...box.querySelectorAll('.it')];
    const top = Math.max(...inputs.map(weight));
    inputs.forEach((t) => t.classList.toggle('is-top', weight(t) === top));
    // Слова ответа, которых ещё нет, — бледнее: модель пишет слева направо.
    box.querySelectorAll('.ot').forEach((t) => {
      t.classList.toggle('is-future', ['t1', 't2', 't3'].indexOf(t.getAttribute('data-t')) > idx);
    });
  }

  // ---------- Шаги демонстрации ----------
  // Кнопка лишь пишет data-state в блок-цель, а стили решают, что показать.
  // Исходное состояние запоминаем из разметки: к нему возвращаемся при уходе
  // со слайда, чтобы показ всегда начинался с первого шага.
  const stepBars = [...document.querySelectorAll('.steps[data-target]')];

  function applyState(bar, value) {
    const target = document.getElementById(bar.getAttribute('data-target'));
    if (!target) return;
    target.setAttribute('data-state', value);
    bar.querySelectorAll('button[data-value]').forEach((b) => {
      b.classList.toggle('is-active', b.getAttribute('data-value') === value);
    });
    if (target.classList.contains('attn')) paintAttention(target);
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
    applyState(bar, bar.dataset.initial);
  });

  // Слово ответа на схеме внимания тоже кликабельно — как кнопка над ней.
  document.querySelectorAll('.attn').forEach((box) => {
    const bar = document.querySelector(`.steps[data-target="${box.id}"]`);
    box.querySelectorAll('.ot').forEach((t) => {
      t.addEventListener('click', (e) => {
        e.stopPropagation();
        if (bar) applyState(bar, t.getAttribute('data-t'));
      });
    });
  });

  // ---------- Калькулятор стоимости обучения ----------
  // Считает как в книге: FLOPs задачи / (число GPU × FLOPs одной GPU в день ×
  // загрузка), а цена — часы аренды всех GPU. При 256 GPU и 70 % — 4,1 млн $.
  document.querySelectorAll('.calc').forEach((calc) => {
    const flops = Number(calc.getAttribute('data-flops'));
    const perDay = Number(calc.getAttribute('data-gpu-day'));
    const gpuSteps = calc.getAttribute('data-gpus').split(',').map(Number);
    const inputs = {
      gpus: calc.querySelector('[data-in="gpus"]'),
      util: calc.querySelector('[data-in="util"]'),
      price: calc.querySelector('[data-in="price"]'),
    };
    const out = (name) => calc.querySelector(`[data-out="${name}"]`);

    function render() {
      const gpus = gpuSteps[Number(inputs.gpus.value)];
      const util = Number(inputs.util.value) / 100;
      const price = Number(inputs.price.value);
      const days = flops / (gpus * perDay * util);
      const cost = price * gpus * 24 * days;
      out('gpus').textContent = fmt(gpus);
      out('util').textContent = `${fmt(util * 100)} %`;
      out('price').textContent = `${fmt(price, 1)} $`;
      out('days').textContent = days >= 2 ? fmt(days) : fmt(days, 1);
      out('months').textContent = days >= 60 ? `≈ ${fmt(days / 30.4, 1)} мес.` : `≈ ${fmt(days * 24)} ч`;
      out('cost').textContent = cost >= 1e6 ? fmt(cost / 1e6, 2) : fmt(cost / 1e3, 0);
      out('cost-unit').textContent = cost >= 1e6 ? 'млн $' : 'тыс. $';
      Object.values(inputs).forEach(paintRange);
    }

    Object.values(inputs).forEach((input) => {
      input.dataset.initial = input.value;
      input.addEventListener('input', render);
    });
    calc.reset = () => {
      Object.values(inputs).forEach((input) => { input.value = input.dataset.initial; });
      render();
    };
    render();
  });

  // ---------- Сэмплер ----------
  // data-tokens — пары [токен, логит]. Порядок как у модели: логиты / T →
  // softmax → отсечение top-k и top-p → перенормировка → случайный выбор.
  // T = 0 — жадный выбор: вся вероятность у токена с наибольшим логитом.
  function distribution(logits, t, k, p) {
    const n = logits.length;
    let probs;
    if (t === 0) {
      const best = logits.indexOf(Math.max(...logits));
      probs = logits.map((_, i) => (i === best ? 1 : 0));
    } else {
      const scaled = logits.map((x) => x / t);
      const m = Math.max(...scaled);
      const ex = scaled.map((x) => Math.exp(x - m));
      const sum = ex.reduce((a, b) => a + b, 0);
      probs = ex.map((x) => x / sum);
    }
    const order = [...probs.keys()].sort((a, b) => probs[b] - probs[a]);
    const keep = new Set();
    let acc = 0;
    for (const i of order) {
      if (keep.size >= Math.min(k, n)) break;
      if (keep.size > 0 && acc >= p) break;
      keep.add(i);
      acc += probs[i];
    }
    const kept = probs.map((x, i) => (keep.has(i) ? x : 0));
    const total = kept.reduce((a, b) => a + b, 0);
    return { raw: probs, final: kept.map((x) => x / total), keep };
  }

  function pick(final) {
    let r = Math.random();
    for (let i = 0; i < final.length; i++) {
      r -= final[i];
      if (r <= 0 && final[i] > 0) return i;
    }
    return final.findIndex((x) => x > 0);
  }

  document.querySelectorAll('.smp').forEach((smp) => {
    const tokens = JSON.parse(smp.getAttribute('data-tokens'));
    const logits = tokens.map((t) => t[1]);
    const rowsBox = smp.querySelector('.smp-rows');
    const ctl = (name) => smp.querySelector(`[data-ctl="${name}"]`);
    const val = (name) => smp.querySelector(`[data-val="${name}"]`);
    const word = smp.querySelector('.smp-word');
    const tally = smp.querySelector('.smp-tally');
    const counts = new Array(tokens.length).fill(0);
    let lastHit = -1;
    let current = null;

    rowsBox.innerHTML = tokens.map(([w]) =>
      `<div class="smp-row"><span>${w}</span><div class="smp-track"><i></i></div><em></em><small></small></div>`).join('');
    const rows = [...rowsBox.querySelectorAll('.smp-row')];

    function settings() {
      return {
        t: ctl('t') ? Number(ctl('t').value) : 1,
        k: ctl('k') ? Number(ctl('k').value) : tokens.length,
        p: ctl('p') ? Number(ctl('p').value) : 1,
      };
    }

    function render() {
      const s = settings();
      current = distribution(logits, s.t, s.k, s.p);
      if (val('t')) val('t').textContent = s.t === 0 ? '0 · жадно' : fmt(s.t, 2);
      if (val('k')) val('k').textContent = s.k >= tokens.length ? `${s.k} · все` : String(s.k);
      if (val('p')) val('p').textContent = s.p >= 1 ? '1 · все' : fmt(s.p, 2);
      rows.forEach((row, i) => {
        const cut = !current.keep.has(i);
        row.classList.toggle('is-cut', cut);
        row.classList.toggle('is-hit', i === lastHit);
        row.querySelector('i').style.setProperty('--p', String(current.final[i]));
        const share = current.final[i];
        row.querySelector('em').textContent = cut ? '—' : share < 0.001 ? '<0,1%' : `${fmt(share * 100, share < 0.1 ? 1 : 0)}%`;
        row.querySelector('small').textContent = `${fmt(logits[i], 1)}`;
      });
      smp.querySelectorAll('.rng').forEach(paintRange);
    }

    function renderTally() {
      const total = counts.reduce((a, b) => a + b, 0);
      if (!total) { tally.textContent = ''; return; }
      const parts = counts
        .map((c, i) => [tokens[i][0], c])
        .filter(([, c]) => c > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([w, c]) => `${w} ×${c}`);
      tally.textContent = `${total} попыток: ${parts.join(' · ')}`;
    }

    function sample(times) {
      for (let n = 0; n < times; n++) {
        lastHit = pick(current.final);
        counts[lastHit]++;
      }
      word.textContent = tokens[lastHit][0];
      word.classList.remove('is-empty');
      render();
      renderTally();
    }

    smp.querySelectorAll('.rng').forEach((input) => {
      input.dataset.initial = input.value;
      input.addEventListener('input', () => {
        counts.fill(0);
        lastHit = -1;
        renderTally();
        render();
      });
    });
    smp.querySelectorAll('[data-sample]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sample(Number(btn.getAttribute('data-sample')));
        btn.blur();
      });
    });

    smp.reset = () => {
      smp.querySelectorAll('.rng').forEach((input) => { input.value = input.dataset.initial; });
      counts.fill(0);
      lastHit = -1;
      word.textContent = word.getAttribute('data-empty');
      word.classList.add('is-empty');
      renderTally();
      render();
    };
    smp.reset();
  });

  function resetSlide(slide) {
    slide.querySelectorAll('.steps[data-target]').forEach((bar) => applyState(bar, bar.dataset.initial));
    slide.querySelectorAll('.calc, .smp').forEach((box) => box.reset && box.reset());
  }

  // Слайд меняет deck.js — ловим это по классу active:
  // ушедший слайд возвращаем в исходный вид.
  slides.forEach((slide) => {
    let wasActive = slide.classList.contains('active');
    new MutationObserver(() => {
      const isActive = slide.classList.contains('active');
      if (isActive === wasActive) return;
      wasActive = isActive;
      if (!isActive) resetSlide(slide);
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  });
})();
