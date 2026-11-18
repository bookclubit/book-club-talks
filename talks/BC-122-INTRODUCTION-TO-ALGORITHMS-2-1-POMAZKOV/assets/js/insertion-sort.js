/* Один журнал операций управляет массивом, переменными и всеми языками. */
(() => {
  'use strict';
  const initial = [5, 2, 4, 6, 1, 3];
  const demo = document.getElementById('insertionDemo');
  if (!demo) return;
  const slide = demo.closest('.slide');
  const $ = (id) => document.getElementById(id);
  const languages = {
    pseudo: {
      lines: ['INSERTION-SORT(A)', 'for j = 2 to A.length', '    key = A[j]', '    // Вставка в A[1..j − 1]', '    i = j − 1', '    while i > 0 и A[i] > key', '        A[i + 1] = A[i]', '        i = i − 1', '    A[i + 1] = key'],
      map: { start: 0, outer: 1, key: 2, init: 4, check: 5, shift: 6, dec: 7, insert: 8, done: 1 },
      note: 'Индексы от 1 · граница for включительна · подсвечена текущая операция.',
      offset: 1,
    },
    python: {
      lines: ['def insertion_sort(a):', '    for j in range(1, len(a)):', '        key = a[j]', '        i = j - 1', '        while i >= 0 and a[i] > key:', '            a[i + 1] = a[i]', '            i -= 1', '        a[i + 1] = key'],
      map: { start: 0, outer: 1, key: 2, init: 3, check: 4, shift: 5, dec: 6, insert: 7, done: 1 },
      note: 'Индексы от 0 · правая граница range не включается · список меняется на месте.',
      offset: 0,
    },
    js: {
      lines: ['function insertionSort(a) {', '  for (let j = 1; j < a.length; j++) {', '    const key = a[j];', '    let i = j - 1;', '    while (i >= 0 && a[i] > key) {', '      a[i + 1] = a[i];', '      i--;', '    }', '    a[i + 1] = key;', '  }', '}'],
      map: { start: 0, outer: 1, key: 2, init: 3, check: 4, shift: 5, dec: 6, insert: 8, done: 9 },
      note: 'Индексы от 0 · исходный массив меняется на месте · && проверяет границу первым.',
      offset: 0,
    },
    cpp: {
      lines: ['void insertionSort(std::vector<int>& a) {', '  const int n = static_cast<int>(a.size());', '  for (int j = 1; j < n; ++j) {', '    const int key = a[j];', '    int i = j - 1;', '    while (i >= 0 && a[i] > key) {', '      a[i + 1] = a[i];', '      --i;', '    }', '    a[i + 1] = key;', '  }', '}'],
      map: { start: 0, outer: 2, key: 3, init: 4, check: 5, shift: 6, dec: 7, insert: 9, done: 10 },
      note: 'Индексы от 0 · нужен #include <vector> · & передаёт вектор по ссылке.',
      offset: 0,
    },
  };

  // Снимок хранит реальный массив после операции: сдвиг копирует значение,
  // временные дубликаты не скрываются, key сохраняет вытесняемый элемент.
  function buildTrace(input) {
    const a = [...input];
    const events = [];
    let j = null, i = null, key = null, prefix = Math.min(1, a.length);
    const emit = (kind, extra = {}) => events.push({ kind, a: [...a], j, i, key, prefix, ...extra });
    emit('start');
    for (j = 1; j < a.length; j++) {
      i = null;
      emit('outer');
      key = a[j];
      emit('key', { source: j });
      i = j - 1;
      emit('init');
      while (true) {
        const passes = i >= 0 && a[i] > key;
        emit('check', { passes });
        if (!passes) break;
        a[i + 1] = a[i];
        emit('shift', { source: i, destination: i + 1, moved: a[i] });
        i--;
        emit('dec');
      }
      a[i + 1] = key;
      prefix = j + 1;
      emit('insert', { destination: i + 1, moved: key });
    }
    prefix = a.length;
    emit('done');
    return events;
  }

  const trace = buildTrace(initial);
  let step = 0, language = 'pseudo', timer = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tabs = [...demo.querySelectorAll('[role="tab"]')];
  const array = $('demoArray');
  initial.forEach(() => {
    const cell = document.createElement('span');
    cell.className = 'is-cell';
    array.append(cell);
  });
  const cells = [...array.children];
  $('stepRange').max = String(trace.length - 1);

  function describe(event) {
    const offset = languages[language].offset;
    const index = (value) => value + offset;
    switch (event.kind) {
      case 'start': return 'Слева один элемент уже отсортирован. Начнём со следующего.';
      case 'outer': return `Новая итерация: выбираем элемент A[${index(event.j)}].`;
      case 'key': return `Сохраняем ${event.key} в key, чтобы сдвиги не потеряли ключ.`;
      case 'init': return `Начинаем сравнение с соседом слева: i = ${index(event.i)}.`;
      case 'check':
        if (event.i < 0) return `i = ${index(event.i)}: вышли за левую границу. A[i] не читаем.`;
        return `${event.a[event.i]} > ${event.key}? ${event.passes ? 'Да. Нужно сдвинуть элемент вправо.' : 'Нет. Место для ключа найдено.'}`;
      case 'shift': return `Копируем ${event.moved} из A[${index(event.source)}] в A[${index(event.destination)}]. Ключ ${event.key} хранится отдельно.`;
      case 'dec': return `Уменьшаем i до ${index(event.i)}. Проверим следующего соседа слева.`;
      case 'insert': return `Записываем key = ${event.key} в A[${index(event.destination)}]. Теперь отсортированы ${event.prefix} элементов.`;
      case 'done': return 'Цикл завершён: весь массив отсортирован, исходные элементы сохранены.';
      default: return '';
    }
  }

  function paintCode() {
    const code = $('algorithmCode');
    code.replaceChildren();
    languages[language].lines.forEach((line, number) => {
      const row = document.createElement('span');
      row.className = 'is-code-line';
      const num = document.createElement('span');
      num.className = 'line-number';
      num.textContent = String(number + 1).padStart(2, '0');
      num.setAttribute('aria-hidden', 'true');
      row.append(num);
      // Подсветка только ключевых слов, без внешней библиотеки.
      line.split(/(\b(?:for|while|if|and|in|range|def|function|const|let|void|int|static_cast|to)\b|\/\/.*)/g).forEach((token) => {
        const part = document.createElement('span');
        part.textContent = token;
        if (token.startsWith('//')) part.className = 'comment';
        else if (/^(for|while|if|and|in|range|def|function|const|let|void|int|static_cast|to)$/.test(token)) part.className = 'keyword';
        row.append(part);
      });
      code.append(row);
    });
    $('codeNote').textContent = languages[language].note;
    $('arrayIndexes').replaceChildren(...initial.map((_, n) => {
      const label = document.createElement('span');
      label.textContent = n + languages[language].offset;
      return label;
    }));
  }

  function animateOperation(event) {
    const layer = demo.querySelector('.is-motion-layer');
    layer.replaceChildren();
    if (reducedMotion.matches || !['key', 'shift', 'insert'].includes(event.kind)) return;
    const token = document.createElement('span');
    token.className = 'is-motion-token';
    token.textContent = event.moved ?? event.key;
    const from = (event.source ?? event.destination) * 116;
    const to = (event.destination ?? event.source) * 116;
    layer.append(token);
    const isKey = event.kind === 'key';
    const animation = token.animate([
      { transform: `translate(${from}px, ${event.kind === 'insert' ? 50 : 0}px)`, opacity: event.kind === 'insert' ? 0 : 1 },
      { transform: `translate(${to}px, ${isKey ? 50 : 0}px)`, opacity: isKey ? 0 : 1 },
    ], { duration: 420, easing: 'cubic-bezier(.65,0,.35,1)' });
    animation.onfinish = () => token.remove();
  }

  function render(animate = false) {
    const event = trace[step];
    const offset = languages[language].offset;
    cells.forEach((cell, index) => {
      cell.textContent = event.a[index];
      cell.classList.toggle('is-sorted', index < event.prefix);
      cell.classList.toggle('is-key', (event.kind === 'key' && index === event.j) || (event.kind === 'insert' && index === event.destination));
      cell.classList.toggle('is-compare', event.kind === 'check' && event.i >= 0 && index === event.i);
      cell.setAttribute('aria-label', `A[${index + offset}] = ${event.a[index]}`);
    });
    const scopedExit = event.kind === 'done' && ['js', 'cpp'].includes(language);
    const jDisplay = event.kind === 'done' && language === 'python' ? initial.length - 1 : event.j === null ? '—' : event.j + offset;
    $('keyValue').textContent = scopedExit ? '—' : event.key ?? '—';
    $('jValue').textContent = `j = ${scopedExit ? '—' : jDisplay}`;
    $('iValue').textContent = `i = ${scopedExit || event.i === null ? '—' : event.i + offset}`;
    $('iterationLabel').textContent = event.kind === 'done' ? 'Готово' : event.j === null ? 'До первой итерации' : `Проход ${event.j} / ${initial.length - 1}`;
    $('stepDescription').textContent = describe(event);
    $('stepRange').value = step;
    $('stepCounter').textContent = `${step} / ${trace.length - 1}`;
    $('stepBack').disabled = step === 0;
    $('stepForward').disabled = step === trace.length - 1;
    [...$('algorithmCode').children].forEach((row, number) => {
      const active = number === languages[language].map[event.kind];
      row.classList.toggle('is-current', active);
      if (active) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
    });
    if (animate) animateOperation(event);
    else demo.querySelector('.is-motion-layer').replaceChildren();
  }

  function pause() {
    clearInterval(timer);
    timer = null;
    $('playDemo').textContent = '▶ Запустить';
    $('playDemo').setAttribute('aria-pressed', 'false');
  }
  function goTo(next, animate = true) {
    step = Math.max(0, Math.min(next, trace.length - 1));
    render(animate);
    if (step === trace.length - 1) pause();
  }
  function togglePlay() {
    if (timer !== null) return pause();
    if (step === trace.length - 1) goTo(0, false);
    $('playDemo').textContent = 'Ⅱ Пауза';
    $('playDemo').setAttribute('aria-pressed', 'true');
    timer = setInterval(() => goTo(step + 1), 1250);
  }
  function chooseLanguage(next) {
    language = next;
    tabs.forEach((tab) => {
      const selected = tab.dataset.language === language;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $('codePanel').setAttribute('aria-labelledby', `tab-${language}`);
    paintCode();
    render();
  }
  tabs.forEach((tab) => tab.addEventListener('click', (event) => {
    chooseLanguage(tab.dataset.language);
    // После клика стрелки снова листают слайды. При активации с клавиатуры
    // фокус остаётся на вкладке, чтобы стрелками можно было выбирать язык.
    if (event.detail > 0) tab.blur();
  }));
  $('stepBack').addEventListener('click', () => { pause(); goTo(step - 1); });
  $('stepForward').addEventListener('click', () => { pause(); goTo(step + 1); });
  $('playDemo').addEventListener('click', togglePlay);
  $('resetDemo').addEventListener('click', () => { pause(); goTo(0, false); });
  $('nextSlide').addEventListener('click', (event) => {
    event.currentTarget.blur();
    window.deck.next();
  });
  $('stepRange').addEventListener('input', (event) => { pause(); goTo(Number(event.target.value), false); });
  // Сохраняем клавиши для вкладок и ползунка в фокусе. Остальные события
  // доходят до движка презентации и листают слайды как обычно.
  demo.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target.closest('[role="tablist"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const current = tabs.findIndex((tab) => tab.dataset.language === language);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      chooseLanguage(tabs[next].dataset.language); tabs[next].focus();
      return;
    }
    const activatesControl = event.key === ' ' && event.target.closest('button, input');
    const movesSlider = event.target === $('stepRange') && ['ArrowLeft', 'ArrowRight'].includes(event.key);
    if (activatesControl || movesSlider) event.stopPropagation();
  });
  new MutationObserver(() => { if (!slide.classList.contains('active')) pause(); }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  reducedMotion.addEventListener('change', () => render());
  paintCode();
  render();
})();
