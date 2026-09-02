// talk.js — поведение контентных слайдов ЭТОГО доклада («Масштабируемость»).
// Общий движок (клавиши, масштаб) живёт в deck.js и правится только в шаблоне.
// Здесь то, чего в нём нет: подпись спикера, цепочка рассуждения, выбор
// подхода к ленте Twitter, гистограмма процентилей и усиление хвоста.

(function () {
  // Уход со слайда — общий повод всё свернуть: возвращаясь, докладчик должен
  // видеть слайд в исходном виде, а не с чужими открытыми панелями.
  function onLeave(slide, fn) {
    new MutationObserver(() => {
      if (!slide.classList.contains('active')) fn();
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  }

  // Стрелки сначала прокручивают шаги демонстрации на активном слайде и только
  // потом листают слайды: обработчик дека висит на document, поэтому слушаем
  // на фазе перехвата.
  function bindArrows(slide, go) {
    document.addEventListener(
      'keydown',
      (e) => {
        if (!slide.classList.contains('active')) return;
        const moved = (e.key === 'ArrowRight' && go(1)) || (e.key === 'ArrowLeft' && go(-1));
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );
  }

  // ---------- Подпись спикера ----------
  // Аватарка с именем в правом верхнем углу; по клику под ней раскрывается
  // устное пояснение к слайду.
  const mes = [...document.querySelectorAll('.me')];
  const closeMes = () => mes.forEach((m) => m.classList.remove('is-open'));
  mes.forEach((me) => {
    const btn = me.querySelector('.me-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = me.classList.contains('is-open');
      closeMes();
      if (!wasOpen) me.classList.add('is-open');
    });
  });
  document.addEventListener('click', () => closeMes());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') closeMes();
  });

  // ---------- Неправильный вопрос, который меняется на два правильных ----------
  // Слайд начинается с «Эта система масштабируемая?» — по клику вопрос
  // подменяется двумя корректными формулировками из книги.
  document.querySelectorAll('[data-ask]').forEach((ask) => {
    const btn = ask.querySelector('[data-ask-btn]');
    const pair = ask.querySelector('[data-ask-pair]');
    const slide = ask.closest('.slide');
    if (!btn || !pair || !slide) return;

    function set(open) {
      ask.classList.toggle('is-open', open);
      btn.hidden = open;
      pair.hidden = !open;
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      set(true);
    });

    bindArrows(slide, (delta) => {
      const open = ask.classList.contains('is-open');
      if (delta > 0 && !open) {
        set(true);
        return true;
      }
      if (delta < 0 && open) {
        set(false);
        return true;
      }
      return false;
    });

    onLeave(slide, () => set(false));
    set(false);
  });

  // ---------- Порядок рассуждения: звено за звеном по клику ----------
  // Кнопки нет: звено открывает клик по слайду (и стрелки). Описание видно
  // сразу вместе со звеном — на проекторе наводить мышью неудобно.
  document.querySelectorAll('[data-path]').forEach((path) => {
    const steps = [...path.querySelectorAll('.path-step')];
    const slide = path.closest('.slide');
    if (!steps.length || !slide) return;
    const hint = slide.querySelector('[data-path-hint]');

    let step = 1;

    function render() {
      steps.forEach((li, i) => li.classList.toggle('is-on', i < step));
      if (hint) {
        hint.textContent =
          step === steps.length
            ? `все звенья открыты · клик по слайду — показать сначала`
            : `звено ${step} из ${steps.length} · клик по слайду — следующее`;
      }
    }

    function go(delta) {
      const target = step + delta;
      if (target < 1 || target > steps.length) return false;
      step = target;
      render();
      return true;
    }

    slide.addEventListener('click', (e) => {
      if (e.target.closest('.me')) return;
      step = step === steps.length ? 1 : step + 1;
      render();
    });

    bindArrows(slide, go);
    onLeave(slide, () => {
      if (step === 1) return;
      step = 1;
      render();
    });

    render();
  });

  // ---------- Два подхода к ленте: кто платит за какое действие ----------
  // Подсветка идёт по всему блоку сразу: смысл слайда в том, что одно и то же
  // действие в двух архитектурах стоит по-разному, поэтому обе колонки
  // реагируют на одну кнопку.
  document.querySelectorAll('[data-ways]').forEach((ways) => {
    const buttons = [...ways.querySelectorAll('[data-way-act]')];
    const hint = ways.querySelector('[data-way-hint]');
    const slide = ways.closest('.slide');
    if (!buttons.length || !hint || !slide) return;

    const idle = hint.innerHTML;
    const texts = {
      write: 'При <b>публикации твита</b> первый подход почти ничего не делает, второй — раскладывает твит по лентам всех подписчиков.',
      read: 'При <b>открытии ленты</b> первый подход собирает её заново из твитов всех подписок, у второго она уже готова.',
    };

    function set(act) {
      ways.classList.remove('is-write', 'is-read');
      buttons.forEach((b) => b.classList.toggle('is-on', b.dataset.wayAct === act));
      if (act) {
        ways.classList.add(`is-${act}`);
        hint.innerHTML = texts[act];
      } else {
        hint.innerHTML = idle;
      }
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        set(btn.classList.contains('is-on') ? null : btn.dataset.wayAct);
      });
    });

    onLeave(slide, () => set(null));
  });

  // ---------- Времена отклика: от кучи запросов к процентилям ----------
  // Данные фиксированные: сотня времён отклика с длинным хвостом. Порядок
  // поступления — детерминированная перестановка (шаг 37 по кругу), чтобы
  // при каждом показе слайд выглядел одинаково.
  const TIMES = [
    88, 92, 95, 97, 99, 101, 103, 105, 106, 108, 110, 111, 113, 114, 116, 117, 119, 120, 122, 123,
    125, 126, 128, 129, 131, 132, 134, 135, 137, 138, 140, 141, 143, 145, 146, 148, 150, 151, 153,
    155, 157, 158, 160, 162, 164, 166, 168, 170, 172, 174, 176, 178, 180, 182, 185, 187, 190, 192,
    195, 197, 200, 202, 205, 207, 210, 212, 215, 218, 220, 224, 228, 235, 242, 250, 258, 266, 275,
    285, 295, 306, 318, 330, 344, 358, 374, 392, 412, 434, 458, 486, 520, 570, 640, 720, 810, 930,
    1200, 1700, 2600, 10000,
  ];

  function fmtMs(v) {
    if (v < 1000) return `${Math.round(v)} мс`;
    return `${(v / 1000).toFixed(1).replace('.', ',')} с`;
  }

  document.querySelectorAll('[data-perc]').forEach((perc) => {
    const barsBox = perc.querySelector('[data-perc-bars]');
    const marks = {
      p50: perc.querySelector('[data-perc-mark="p50"]'),
      p95: perc.querySelector('[data-perc-mark="p95"]'),
      p99: perc.querySelector('[data-perc-mark="p99"]'),
    };
    const vals = {
      avg: perc.querySelector('[data-perc-val="avg"]'),
      p50: perc.querySelector('[data-perc-val="p50"]'),
      p95: perc.querySelector('[data-perc-val="p95"]'),
      p99: perc.querySelector('[data-perc-val="p99"]'),
    };
    const axisLeft = perc.querySelector('[data-perc-axis="left"]');
    const axisRight = perc.querySelector('[data-perc-axis="right"]');
    // Кнопка и подсказка живут в общей панели демонстрации под графиком,
    // то есть вне самого блока .perc, — ищем их по слайду.
    const slide = perc.closest('.slide');
    const btn = slide && slide.querySelector('[data-perc-btn]');
    const hint = slide && slide.querySelector('[data-perc-hint]');
    if (!barsBox || !btn || !hint || !slide) return;

    const n = TIMES.length;
    const sorted = TIMES.slice().sort((a, b) => a - b);
    const arrival = sorted.map((_, i) => sorted[(i * 37) % n]);
    const avg = sorted.reduce((s, v) => s + v, 0) / n;
    const at = (p) => sorted[Math.ceil(p * n) - 1];
    const p50 = at(0.5);
    const p95 = at(0.95);
    const p99 = at(0.99);

    // Логарифмическая высота: иначе единственный десятисекундный запрос
    // прижимает остальные девяносто девять к нулю. Верх шкалы — ровно 10 с,
    // чтобы самый медленный запрос упирался в верхнюю линию сетки.
    const LO = Math.log(60);
    const HI = Math.log(10000);
    const scale = (v) => ((Math.log(v) - LO) / (HI - LO)) * 100;
    const height = (v) => `${Math.max(2, scale(v))}%`;

    perc.querySelectorAll('[data-perc-grid]').forEach((line) => {
      line.style.bottom = `${scale(Number(line.dataset.percGrid))}%`;
    });

    const bars = sorted.map(() => {
      const bar = document.createElement('div');
      bar.className = 'perc-bar';
      barsBox.appendChild(bar);
      return bar;
    });

    // Черта процентиля стоит по центру своего столбца.
    const markLeft = (value) => `${((sorted.indexOf(value) + 0.5) / n) * 100}%`;

    const STEPS = [
      {
        data: arrival,
        axis: ['1-й запрос', '100-й запрос'],
        marks: [],
        vals: ['avg'],
        btn: 'Отсортировать по времени →',
        hint: `Сто запросов подряд, так как они пришли. Средняя за них — <b>${fmtMs(
          avg
        )}</b>, и по этому числу непонятно почти ничего. Высота столбца — логарифмическая шкала.`,
      },
      {
        data: sorted,
        axis: ['самые быстрые', 'самые медленные'],
        marks: [],
        vals: ['avg'],
        btn: 'Показать медиану →',
        hint: 'Те же сто запросов, отсортированные по времени. Теперь видно распределение: слева ровное плато, справа — хвост.',
      },
      {
        data: sorted,
        axis: ['самые быстрые', 'самые медленные'],
        marks: ['p50'],
        vals: ['avg', 'p50'],
        btn: 'Показать p95 →',
        hint: `<b>p50 = ${fmtMs(
          p50
        )}</b> — медиана: половина запросов быстрее, половина медленнее. Это «типичное» время, а не среднее.`,
      },
      {
        data: sorted,
        axis: ['самые быстрые', 'самые медленные'],
        marks: ['p50', 'p95'],
        vals: ['avg', 'p50', 'p95'],
        btn: 'Показать p99 →',
        hint: `<b>p95 = ${fmtMs(
          p95
        )}</b>: девяносто пять запросов из ста уложились в это время, пять — нет. Медиана выросла всего вдвое, а p95 уже в разы больше.`,
      },
      {
        data: sorted,
        axis: ['самые быстрые', 'самые медленные'],
        marks: ['p50', 'p95', 'p99'],
        vals: ['avg', 'p50', 'p95', 'p99'],
        tail: true,
        btn: 'Показать сначала',
        hint: `<b>p99 = ${fmtMs(
          p99
        )}</b> — это тот самый хвост: один запрос из ста. Среднее (${fmtMs(
          avg
        )}) не описывает ни типичного запроса, ни хвоста — а живут пользователи именно в хвосте.`,
      },
    ];

    let step = 0;

    function render() {
      const s = STEPS[step];
      s.data.forEach((v, i) => {
        bars[i].style.height = height(v);
        bars[i].classList.toggle('is-tail', Boolean(s.tail) && v >= p95);
      });
      Object.keys(marks).forEach((key) => {
        if (marks[key]) marks[key].classList.toggle('is-on', s.marks.includes(key));
      });
      Object.keys(vals).forEach((key) => {
        if (vals[key]) vals[key].classList.toggle('is-on', s.vals.includes(key));
      });
      if (axisLeft) axisLeft.textContent = s.axis[0];
      if (axisRight) axisRight.textContent = s.axis[1];
      btn.textContent = s.btn;
      hint.innerHTML = s.hint;
    }

    function go(delta) {
      const target = step + delta;
      if (target < 0 || target > STEPS.length - 1) return false;
      step = target;
      render();
      return true;
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      step = step === STEPS.length - 1 ? 0 : step + 1;
      render();
    });

    bindArrows(slide, go);
    onLeave(slide, () => {
      if (step === 0) return;
      step = 0;
      render();
    });

    // Значения в боковой панели считаются по тем же данным, что и столбцы.
    if (vals.avg) vals.avg.querySelector('b').textContent = fmtMs(avg);
    if (vals.p50) vals.p50.querySelector('b').textContent = fmtMs(p50);
    if (vals.p95) vals.p95.querySelector('b').textContent = fmtMs(p95);
    if (vals.p99) vals.p99.querySelector('b').textContent = fmtMs(p99);
    if (marks.p50) marks.p50.style.left = markLeft(p50);
    if (marks.p95) marks.p95.style.left = markLeft(p95);
    if (marks.p99) marks.p99.style.left = markLeft(p99);
    render();
  });

  // ---------- Усиление хвоста: чем больше вызовов, тем вероятнее медленный ----
  // Считаем прямо на слайде: вероятность 1 − 0,99^n. Число вызовов растёт
  // по шагам, чтобы было видно, как быстро «всего один процент» съедает всё.
  document.querySelectorAll('[data-amp]').forEach((amp) => {
    const fill = amp.querySelector('[data-amp-fill]');
    const val = amp.querySelector('[data-amp-val]');
    const cells = [...amp.querySelectorAll('[data-amp-call]')];
    const btn = amp.querySelector('[data-amp-btn]');
    const hint = amp.querySelector('[data-amp-hint]');
    const slide = amp.closest('.slide');
    if (!fill || !val || !cells.length || !btn || !hint || !slide) return;

    const calls = cells.map((c) => Number(c.dataset.ampCall));
    let step = 0;

    function render() {
      const n = calls[step];
      const p = 1 - Math.pow(0.99, n);
      fill.style.width = `${Math.max(1, p * 100)}%`;
      val.textContent = `${(p * 100).toFixed(1).replace('.', ',')} %`;
      cells.forEach((cell, i) => {
        cell.classList.toggle('is-on', i < step);
        cell.classList.toggle('is-now', i === step);
      });
      btn.textContent = step === calls.length - 1 ? 'Показать сначала' : 'Больше вызовов →';
      hint.innerHTML =
        n === 1
          ? 'Один внутренний вызов, у него медленный ответ в <b>1 %</b> случаев. Кажется, беспокоиться не о чем.'
          : `<b>${n}</b> независимых вызовов на один запрос пользователя: вероятность, что хотя бы один попадёт в хвост, — <b>1 − 0,99<sup>${n}</sup></b>.`;
    }

    function go(delta) {
      const target = step + delta;
      if (target < 0 || target > calls.length - 1) return false;
      step = target;
      render();
      return true;
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      step = step === calls.length - 1 ? 0 : step + 1;
      render();
    });

    bindArrows(slide, go);
    onLeave(slide, () => {
      if (step === 0) return;
      step = 0;
      render();
    });

    render();
  });
})();
