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
  // Два состояния: категории врозь (в каждом круге — свои инструменты
  // со ссылками) и сведённая диаграмма Венна, где в зонах пересечений
  // проявляются версии, которыми инструмент зашёл на соседнюю территорию.
  // Координаты считает скрипт: круги двигаются, а метки стоят в центрах
  // зон — в CSS такие точки не выразить.
  document.querySelectorAll('[data-venn]').forEach((venn) => {
    const stage = venn.querySelector('[data-venn-stage]');
    const slide = venn.closest('.slide');
    if (!stage || !slide) return;

    const R = 210;
    // Врозь — три круга по ширине сцены; сведённые — равносторонний
    // треугольник со стороной 280 (меньше 2R, поэтому круги пересекаются).
    const APART = { db: [330, 330], cache: [860, 330], queue: [1390, 330] };
    const TIGHT = { db: [860, 228], cache: [720, 471], queue: [1000, 471] };
    // Центры зон: середина пары, отодвинутая от третьего круга, — иначе
    // метки пар и метка тройного пересечения налезали бы друг на друга.
    const ZONES = {
      db: [860, 104],
      cache: [608, 536],
      queue: [1112, 536],
      'cache-db': [729, 315],
      'db-queue': [991, 315],
      'cache-queue': [860, 541],
      all: [860, 390],
    };

    const circles = {};
    Object.keys(APART).forEach((key) => {
      circles[key] = venn.querySelector(`[data-circle="${key}"]`);
    });
    if (Object.values(circles).some((c) => !c)) return;

    const hint = venn.querySelector('[data-venn-hint]');
    venn.querySelectorAll('[data-zone]').forEach((zone) => {
      const p = ZONES[zone.dataset.zone];
      if (!p) return;
      zone.style.left = `${p[0]}px`;
      zone.style.top = `${p[1]}px`;
    });

    let tight = false;

    function render() {
      const p = tight ? TIGHT : APART;
      Object.keys(circles).forEach((k) => {
        circles[k].style.left = `${p[k][0] - R}px`;
        circles[k].style.top = `${p[k][1] - R}px`;
      });
      stage.classList.toggle('is-tight', tight);
      if (hint) {
        hint.textContent = tight
          ? 'наведите на знак — почему инструмент оказался в этой зоне · клик по слайду — развести категории'
          : 'наведите на инструмент — что он делает · клик по слайду — свести категории';
      }
    }

    // Клик по слайду переключает состояние; ссылки, кнопки и подпись
    // спикера при этом должны работать сами по себе.
    slide.addEventListener('click', (e) => {
      if (e.target.closest('a, button, .me, .quote-drawer')) return;
      tight = !tight;
      render();
    });

    // Стрелки сначала сводят и разводят круги и только потом листают слайды:
    // обработчик дека висит на document, поэтому слушаем на фазе перехвата.
    document.addEventListener(
      'keydown',
      (e) => {
        if (!slide.classList.contains('active')) return;
        const moved =
          (e.key === 'ArrowRight' && !tight) || (e.key === 'ArrowLeft' && tight);
        if (!moved) return;
        tight = !tight;
        render();
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    // Ушли со слайда — круги снова расходятся.
    onLeave(slide, () => {
      if (!tight) return;
      tight = false;
      render();
    });

    render();
  });

  // ---------- Цепочка рассуждения: звено за звеном по клику ----------
  // Кнопки нет: следующее звено открывает клик по слайду (и стрелки).
  // Описание текущего звена всегда видно — панель под линией, уголок
  // панели скрипт ставит под активный узел.
  document.querySelectorAll('[data-road]').forEach((road) => {
    const nodes = [...road.querySelectorAll('[data-road-node]')];
    const line = road.querySelector('.road-line');
    const fill = road.querySelector('[data-road-fill]');
    const note = road.querySelector('[data-road-note]');
    const hint = road.querySelector('[data-road-hint]');
    const slide = road.closest('.slide');
    if (!nodes.length || !line || !note || !slide) return;

    let step = 1;

    function render() {
      nodes.forEach((n, i) => {
        n.classList.toggle('is-on', i < step);
        n.classList.toggle('is-now', i === step - 1);
      });
      const active = nodes[step - 1];
      note.innerHTML = active.dataset.note || '';
      if (fill) fill.style.width = `${((step - 1) / (nodes.length - 1)) * 100}%`;
      const lineBox = line.getBoundingClientRect();
      const nodeBox = active.getBoundingClientRect();
      if (lineBox.width) {
        const x = ((nodeBox.left + nodeBox.width / 2 - lineBox.left) / lineBox.width) * 100;
        note.style.setProperty('--x', `${x}%`);
      }
      if (hint) {
        hint.textContent =
          step === nodes.length
            ? `звено ${step} из ${nodes.length} · клик по слайду — показать сначала`
            : `звено ${step} из ${nodes.length} · клик по слайду — следующее`;
      }
    }

    slide.addEventListener('click', (e) => {
      if (e.target.closest('a, button, .me, .quote-drawer')) return;
      step = step === nodes.length ? 1 : step + 1;
      render();
    });

    // Стрелки сначала проходят цепочку и только потом листают слайды.
    document.addEventListener(
      'keydown',
      (e) => {
        if (!slide.classList.contains('active')) return;
        const next = e.key === 'ArrowRight' ? step + 1 : e.key === 'ArrowLeft' ? step - 1 : step;
        if (next === step || next < 1 || next > nodes.length) return;
        step = next;
        render();
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    onLeave(slide, () => {
      if (step === 1) return;
      step = 1;
      render();
    });

    render();
  });
})();
