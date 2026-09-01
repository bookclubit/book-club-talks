// talk.js — поведение контентных слайдов ЭТОГО доклада
// («Подходы к работе над информационными системами»).
// Общий движок (клавиши, масштаб) живёт в deck.js и правится только
// в шаблоне. Здесь то, чего в нём нет: аккордеоны, выдвижная цитата
// и демонстрация рассинхрона кэша с основным хранилищем.

(function () {
  // Уход со слайда — общий повод всё свернуть: возвращаясь, докладчик должен
  // видеть слайд в исходном виде, а не с чужими открытыми панелями.
  function onLeave(slide, fn) {
    new MutationObserver(() => {
      if (!slide.classList.contains('active')) fn();
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  }

  // ---------- Аккордеоны ----------
  // Внутри одного блока .acc открыт максимум один пункт: раскрытые разом
  // они не помещаются в высоту слайда.
  document.querySelectorAll('.acc').forEach((acc) => {
    const items = [...acc.querySelectorAll('.acc-item')];
    const closeAll = () =>
      items.forEach((i) => i.classList.remove('is-open', 'is-done'));

    items.forEach((item) => {
      const head = item.querySelector('.acc-head');
      const body = item.querySelector('.acc-body');
      if (!head || !body) return;
      head.setAttribute('aria-expanded', 'false');

      body.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'grid-template-rows') return;
        item.classList.toggle('is-done', item.classList.contains('is-open'));
      });
      head.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = item.classList.contains('is-open');
        closeAll();
        items.forEach((i) => i.querySelector('.acc-head').setAttribute('aria-expanded', 'false'));
        if (!wasOpen) {
          item.classList.add('is-open');
          head.setAttribute('aria-expanded', 'true');
        }
      });
    });

    const slide = acc.closest('.slide');
    if (slide) onLeave(slide, closeAll);
  });

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

  // ---------- Цитата: ящик выезжает снизу слайда ----------
  // Ящиков может быть несколько (по одному на слайд), поэтому пары
  // «аватарка → ящик» ищем внутри каждого слайда отдельно.
  const drawers = [...document.querySelectorAll('.quote-drawer')];
  const closeDrawers = () => drawers.forEach((d) => d.classList.remove('open'));

  document.querySelectorAll('.slide').forEach((slide) => {
    const caller = slide.querySelector('.quote-caller');
    const drawer = slide.querySelector('.quote-drawer');
    if (!caller || !drawer) return;

    caller.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = drawer.classList.contains('open');
      closeDrawers();
      if (!wasOpen) drawer.classList.add('open');
    });
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('.quote-close')) closeDrawers();
      e.stopPropagation();
    });
  });

  // Листаем слайды или жмём Esc — открытых панелей остаться не должно.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      closeDrawers();
      closeMes();
    }
  });
  document.addEventListener('click', () => closeMes());

  // ---------- Рассинхрон: PostgreSQL обновился, Redis остался старым ----------
  // Три состояния: согласие → запись мимо кэша → инвалидация кэша кодом
  // приложения. Значения и подписи лежат в разметке, скрипт только
  // переключает шаг: на слайде важна последовательность, а не числа.
  document.querySelectorAll('[data-sync]').forEach((sync) => {
    const db = sync.querySelector('[data-sync-db]');
    const cache = sync.querySelector('[data-sync-cache]');
    const client = sync.querySelector('[data-sync-client]');
    const btn = sync.querySelector('[data-sync-btn]');
    const hint = sync.querySelector('[data-sync-hint]');
    const slide = sync.closest('.slide');
    if (!db || !cache || !client || !btn || !hint || !slide) return;

    const steps = [
      {
        db: 'Аня',
        cache: 'Аня',
        client: 'Аня',
        state: ['', '', ''],
        btn: 'Пользователь меняет имя на «Анна»',
        hint: 'Пока данные согласованы: в хранилище и в кэше одно и то же имя, клиент видит его же.',
      },
      {
        db: 'Анна',
        cache: 'Аня',
        client: 'Аня',
        state: ['is-fresh', 'is-stale', 'is-stale'],
        btn: 'Код приложения делает кэш недействительным',
        hint: '<b>Данные разошлись.</b> Redis не знает про запись в PostgreSQL, и клиент через кэш видит неактуальное имя.',
      },
      {
        db: 'Анна',
        cache: 'Анна',
        client: 'Анна',
        state: ['is-fresh', 'is-fresh', 'is-fresh'],
        btn: 'Показать сначала',
        hint: 'Синхронизация — обязанность кода приложения: инструменты друг о друге не знают.',
      },
    ];

    let step = 0;

    function render() {
      const s = steps[step];
      const cells = [db, cache, client];
      [s.db, s.cache, s.client].forEach((value, i) => {
        cells[i].textContent = value;
        cells[i].classList.remove('is-fresh', 'is-stale');
        if (s.state[i]) cells[i].classList.add(s.state[i]);
      });
      btn.textContent = s.btn;
      hint.innerHTML = s.hint;
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      step = (step + 1) % steps.length;
      render();
    });

    onLeave(slide, () => {
      if (step === 0) return;
      step = 0;
      render();
    });

    render();
  });

  // ---------- Круги категорий и их пересечения ----------
  // Круги стоят на сцене фиксированных 940×680 и в начале не пересекаются.
  // Каждый шаг таймлайна стягивает одну пару навстречу друг другу, а метка
  // с версией встаёт ровно в середину этой пары — поэтому позиции считает
  // скрипт, а не CSS: после второго шага круги уже сдвинуты, и «серединой»
  // была бы не та точка.
  document.querySelectorAll('[data-venn]').forEach((venn) => {
    const START = { db: [470, 169], cache: [270, 516], queue: [670, 516] };
    const STEPS = [
      { a: 'cache', b: 'db', pull: 70 },
      { a: 'queue', b: 'db', pull: 55 },
      { a: 'cache', b: 'queue', pull: 35 },
    ];
    const R = 150;

    const circles = {};
    Object.keys(START).forEach((key) => {
      circles[key] = venn.querySelector(`[data-circle="${key}"]`);
    });
    const lenses = [...venn.querySelectorAll('[data-lens]')];
    const rows = [...venn.querySelectorAll('[data-vt]')];
    const btn = venn.querySelector('[data-venn-btn]');
    const hint = venn.querySelector('[data-venn-hint]');
    const sum = venn.querySelector('[data-venn-sum]');
    const slide = venn.closest('.slide');
    if (Object.values(circles).some((c) => !c) || !btn || !slide) return;

    let step = 0;

    // Позиции центров после первых `n` шагов: пары стягиваются по очереди.
    function centers(n) {
      const p = {};
      Object.keys(START).forEach((k) => (p[k] = START[k].slice()));
      for (let i = 0; i < n; i++) {
        const { a, b, pull } = STEPS[i];
        const dx = p[b][0] - p[a][0];
        const dy = p[b][1] - p[a][1];
        const d = Math.hypot(dx, dy) || 1;
        p[a][0] += (dx / d) * pull;
        p[a][1] += (dy / d) * pull;
        p[b][0] -= (dx / d) * pull;
        p[b][1] -= (dy / d) * pull;
      }
      return p;
    }

    function render() {
      const p = centers(step);
      Object.keys(circles).forEach((k) => {
        circles[k].style.left = `${p[k][0] - R}px`;
        circles[k].style.top = `${p[k][1] - R}px`;
      });
      lenses.forEach((lens, i) => {
        const { a, b } = STEPS[i];
        lens.style.left = `${(p[a][0] + p[b][0]) / 2}px`;
        lens.style.top = `${(p[a][1] + p[b][1]) / 2}px`;
        lens.classList.toggle('is-on', i < step);
      });
      rows.forEach((row, i) => row.classList.toggle('is-on', i < step));
      if (sum) sum.classList.toggle('is-on', step === STEPS.length);
      btn.textContent = step === STEPS.length ? 'Показать сначала' : 'Следующий шаг →';
      if (hint) {
        hint.textContent =
          step === 0
            ? 'Пока категории не пересекаются'
            : 'Наведите на метку версии — покажу, что изменилось';
      }
    }

    function go(delta) {
      const target = step + delta;
      if (target < 0 || target > STEPS.length) return false;
      step = target;
      render();
      return true;
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      step = step === STEPS.length ? 0 : step + 1;
      render();
    });

    // Стрелки сначала проходят таймлайн и только потом листают слайды:
    // обработчик дека висит на document, поэтому слушаем на фазе перехвата.
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

    // Ушли со слайда — круги снова расходятся.
    onLeave(slide, () => {
      if (step === 0) return;
      step = 0;
      render();
    });

    render();
  });
})();
