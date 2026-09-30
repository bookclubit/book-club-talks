// talk.js — интерактив контентных слайдов доклада «Алгоритмы как технология».
// Движок дека (deck.js) не трогаем: здесь только поведение своих слайдов.

(() => {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const lg = Math.log2;

    const fmt = (x, digits = 1) => x.toLocaleString('ru-RU', { maximumFractionDigits: digits });
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const sup = (k) => String(k).split('').map((d) => SUP[+d]).join('');

    function fmtSci(x) {
        if (x < 1e4) return fmt(Math.round(x), 0);
        const e = Math.floor(Math.log10(x));
        const m = x / 10 ** e;
        return `${fmt(m, 1)}·10${sup(e)}`;
    }

    function fmtCount(n) {
        if (n < 1e3) return fmt(Math.round(n), 0);
        if (n < 1e6) return `${fmt(n / 1e3, n < 1e4 ? 1 : 0)} тыс.`;
        if (n < 1e9) return `${fmt(n / 1e6, n < 1e7 ? 1 : 0)} млн`;
        return `${fmt(n / 1e9, 1)} млрд`;
    }

    function fmtTime(s) {
        if (s < 1e-3) return `${fmt(s * 1e6, 0)} мкс`;
        if (s < 1) return `${fmt(s * 1e3, s < 1e-2 ? 1 : 0)} мс`;
        if (s < 60) return `${fmt(s, 1)} с`;
        if (s < 3600) return `${fmt(s / 60, 1)} мин`;
        if (s < 86400) return `${fmt(s / 3600, 1)} ч`;
        if (s < 86400 * 365) return `${fmt(s / 86400, 1)} дн.`;
        return `${fmt(s / (86400 * 365), 1)} г.`;
    }

    // «в 2 раза», «в 5 раз», «в 17,2 раза»: у дробей всегда родительный единственного.
    function times(x) {
        const r = x >= 100 ? Math.round(x) : Math.round(x * 10) / 10;
        if (!Number.isInteger(r)) return `${fmt(r, 1)} раза`;
        const d = r % 10, dd = r % 100;
        const word = d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'раза' : 'раз';
        return `${fmt(r, 0)} ${word}`;
    }

    function el(name, attrs = {}, parent) {
        const node = document.createElementNS(SVG_NS, name);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        if (parent) parent.appendChild(node);
        return node;
    }

    // Где svg лежит внутри своей карточки, в CSS-пикселях сцены. offsetLeft у SVG
    // нет, а getBoundingClientRect отдаёт экранные пиксели — делим на масштаб сцены.
    function svgOrigin(svg) {
        const card = svg.parentElement;
        const cr = card.getBoundingClientRect(), sr = svg.getBoundingClientRect();
        const k = cr.width / card.offsetWidth || 1;
        return [(sr.left - cr.left) / k, (sr.top - cr.top) / k];
    }

    // ===== Навигация по адресу =====
    // #8 открывает восьмой слайд, а перезагрузка не сбрасывает дек на титул.
    // deck.js наружу API не отдаёт, поэтому листаем его же клавишами.
    function setupHashNav() {
        const slides = $$('.slide');
        const current = () => slides.findIndex((s) => s.classList.contains('active'));
        const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        const goTo = (num) => {
            const target = Math.min(Math.max(num, 1), slides.length) - 1;
            let cur = current();
            while (cur < target) { press('ArrowRight'); cur++; }
            while (cur > target) { press('ArrowLeft'); cur--; }
        };
        const fromHash = () => parseInt(location.hash.slice(1), 10);

        if (fromHash() > 1) goTo(fromHash());
        window.addEventListener('hashchange', () => { if (fromHash() > 0) goTo(fromHash()); });

        const enterHooks = new Map();
        new MutationObserver((mutations) => {
            const entered = mutations.find((m) => m.target.classList.contains('slide') && m.target.classList.contains('active'));
            if (!entered) return;
            const idx = slides.indexOf(entered.target);
            history.replaceState(null, '', `#${idx + 1}`);
            enterHooks.get(entered.target)?.();
        }).observe($('#deckStage'), { subtree: true, attributes: true, attributeFilter: ['class'] });

        return (slide, fn) => { if (slide) enterHooks.set(slide, fn); };
    }

    // После клика мышью фокус остаётся на кнопке, и пробел для перелистывания
    // нажимал бы её ещё раз. Снимаем фокус — клавиатура снова листает слайды.
    function setupBlurAfterClick() {
        document.addEventListener('click', (e) => {
            const control = e.target.closest('.slide button');
            if (control && e.detail > 0) control.blur();
        });
        document.addEventListener('change', (e) => {
            if (e.target.matches('.slide input[type="range"]')) e.target.blur();
        });
    }

    function setupReveals() {
        $$('[data-reveal]').forEach((btn) => {
            const target = document.getElementById(btn.dataset.reveal);
            if (!target) return;
            btn.addEventListener('click', () => {
                const on = !target.classList.contains('revealed');
                target.classList.toggle('revealed', on);
                btn.classList.toggle('is-active', on);
            });
        });
    }

    // ===== Слайд «Переломный момент»: n² против k · n lg n =====
    function crossoverN(k) {
        // f(n) = n − k·lg n убывает до n₀ = k / ln 2 и растёт после: если в минимуме
        // f ≥ 0, вставки не быстрее ни при каком n, иначе ищем правый корень.
        const f = (n) => n - k * lg(n);
        const n0 = Math.max(2, k / Math.LN2);
        if (f(n0) >= 0) return null;
        let lo = n0, hi = 1e15;
        for (let i = 0; i < 200; i++) {
            const mid = (lo + hi) / 2;
            if (f(mid) < 0) lo = mid; else hi = mid;
        }
        return hi;
    }

    function setupCrossover() {
        const svg = $('#crossChart');
        if (!svg) return;
        const range = $('#crossRange');
        const tip = $('#crossTip');
        const W = 960, H = 560;
        const m = { l: 70, r: 130, t: 34, b: 52 };
        const X0 = Math.log10(2), X1 = 9, Y0 = 0, Y1 = 18;
        const sx = (lx) => m.l + ((lx - X0) / (X1 - X0)) * (W - m.l - m.r);
        const sy = (ly) => H - m.b - ((ly - Y0) / (Y1 - Y0)) * (H - m.t - m.b);
        const invX = (px) => X0 + ((px - m.l) / (W - m.l - m.r)) * (X1 - X0);
        const yA = (lx) => 2 * lx;
        const yB = (lx, k) => Math.log10(k) + lx + Math.log10(lg(10 ** lx));

        // Статичная часть: сетка, оси, подписи.
        const grid = el('g', {}, svg);
        [0, 3, 6, 9, 12, 15, 18].forEach((ly) => {
            el('line', { class: ly === 0 ? 'ax-base' : 'ax-grid', x1: m.l, x2: W - m.r, y1: sy(ly), y2: sy(ly) }, grid);
            // Степень — отдельным tspan: подстрочных цифр в Inter нет, а запасные глифы мелкие.
            const t = el('text', { class: 'ax-tick', x: m.l - 12, y: sy(ly) + 5, 'text-anchor': 'end' }, grid);
            if (ly === 0) t.textContent = '1';
            else {
                el('tspan', {}, t).textContent = '10';
                el('tspan', { class: 'pow', dy: -8 }, t).textContent = ly;
            }
        });
        [[1, '10'], [3, '1 тыс.'], [6, '1 млн'], [9, '1 млрд']].forEach(([lx, label]) => {
            el('line', { class: 'ax-grid', x1: sx(lx), x2: sx(lx), y1: m.t, y2: H - m.b }, grid);
            const t = el('text', { class: 'ax-tick', x: sx(lx), y: H - m.b + 26, 'text-anchor': 'middle' }, grid);
            t.textContent = label;
        });
        el('line', { class: 'ax-base', x1: m.l, x2: m.l, y1: m.t, y2: H - m.b }, grid);
        const yTitle = el('text', { class: 'ax-title', x: m.l - 12, y: 14, 'text-anchor': 'start' }, grid);
        yTitle.textContent = 'операций';
        const xTitle = el('text', { class: 'ax-title', x: W - m.r, y: H - 4, 'text-anchor': 'end' }, grid);
        xTitle.textContent = 'n — сколько чисел сортируем';

        el('clipPath', { id: 'crossClip' }, svg).appendChild(
            el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b })
        );

        // Динамическая часть перерисовывается при каждом движении слайдера.
        const dyn = el('g', {}, svg);
        const hover = el('g', { style: 'display: none' }, svg);
        const hRule = el('line', { class: 'hover-rule', y1: m.t, y2: H - m.b }, hover);
        const hDotA = el('circle', { class: 'hover-dot-a', r: 6 }, hover);
        const hDotB = el('circle', { class: 'hover-dot-b', r: 6 }, hover);
        const hit = el('rect', { class: 'hit', x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svg);

        let k = 50;

        function path(fy) {
            const pts = [];
            for (let i = 0; i <= 240; i++) {
                const lx = X0 + ((X1 - X0) * i) / 240;
                pts.push(`${i ? 'L' : 'M'}${sx(lx).toFixed(1)},${sy(fy(lx)).toFixed(1)}`);
            }
            return pts.join('');
        }

        function draw() {
            dyn.replaceChildren();
            const nStar = crossoverN(k);
            const lxStar = nStar ? Math.log10(nStar) : null;
            const inDomain = lxStar !== null && lxStar <= X1;
            const splitX = inDomain ? sx(Math.max(lxStar, X0)) : (lxStar === null ? m.l : W - m.r);

            el('rect', { class: 'wash-a', x: m.l, y: m.t, width: Math.max(0, splitX - m.l), height: H - m.t - m.b }, dyn);
            el('rect', { class: 'wash-b', x: splitX, y: m.t, width: Math.max(0, W - m.r - splitX), height: H - m.t - m.b }, dyn);
            // Линии идут из левого нижнего угла в правый верхний, поэтому свободны
            // левый верх и правый низ — туда и подписи областей.
            if (splitX - m.l > 190) {
                el('text', { class: 'wash-label', x: m.l + 16, y: m.t + 26 }, dyn).textContent = 'быстрее вставки';
            }
            if (W - m.r - splitX > 190) {
                el('text', { class: 'wash-label', x: W - m.r - 16, y: H - m.b - 16, 'text-anchor': 'end' }, dyn).textContent = 'быстрее слияние';
            }

            const lines = el('g', { 'clip-path': 'url(#crossClip)' }, dyn);
            el('path', { class: 'ln ln-a', d: path(yA) }, lines);
            el('path', { class: 'ln ln-b', d: path((lx) => yB(lx, k)) }, lines);

            const endA = sy(yA(X1)), endB = sy(yB(X1, k));
            el('text', { class: 'end-label', x: W - m.r + 12, y: endA + 6 }, dyn).textContent = 'c₁n²';
            el('text', { class: 'end-label', x: W - m.r + 12, y: endB + 6 }, dyn).textContent = 'c₂n lg n';

            if (inDomain) {
                const cx = sx(lxStar), cy = sy(yA(lxStar));
                el('line', { class: 'cross-rule', x1: cx, x2: cx, y1: m.t, y2: H - m.b }, dyn);
                el('circle', { class: 'cross-dot', cx, cy, r: 7 }, dyn);
                const right = cx < W - m.r - 200;
                const below = cy < H - m.b - 60;
                el('text', {
                    class: 'cross-label', x: cx + (right ? 14 : -14), y: below ? cy + 28 : cy - 16,
                    'text-anchor': right ? 'start' : 'end',
                }, dyn).textContent = `перелом: n ≈ ${fmtCount(nStar)}`;
            }

            $('#crossK').textContent = `×${fmt(k, k < 10 ? 1 : 0)}`;
            $('#crossLabel').textContent = nStar ? 'Слияние обгоняет вставки начиная с' : 'Точки перелома нет';
            $('#crossN').textContent = nStar ? `n ≈ ${fmtCount(nStar)}` : 'слияние быстрее всегда';
            const isBook = Math.abs(Math.log10(k) - Math.log10(25000)) < 0.003;
            $('#crossNote').textContent = isBook
                ? 'Это и есть пример с компьютерами А и Б: железо в 1000 раз медленнее × константа в 25 раз больше. До ≈ 471 тыс. чисел выигрывает А, дальше — Б.'
                : nStar
                    ? 'Левее перелома быстрее вставки, правее — слияние, и дальше разрыв только растёт.'
                    : 'Константы почти равны — вставки не выигрывают даже на малых n.';
            $$('[data-k]').forEach((b) => b.classList.toggle('is-active', Math.abs(+b.dataset.k - k) < 1e-9));
        }

        const setFromRange = () => {
            const raw = 10 ** +range.value;
            k = raw < 10 ? Math.round(raw * 10) / 10 : Math.round(raw);
            draw();
        };
        range.addEventListener('input', setFromRange);
        $$('[data-k]').forEach((b) => b.addEventListener('click', () => {
            range.value = Math.log10(+b.dataset.k);
            k = +b.dataset.k;
            draw();
        }));

        function onMove(e) {
            const p = svg.createSVGPoint();
            p.x = e.clientX; p.y = e.clientY;
            const loc = p.matrixTransform(svg.getScreenCTM().inverse());
            const lx = Math.min(X1, Math.max(X0, invX(loc.x)));
            const x = sx(lx), ya = sy(yA(lx)), yb = sy(yB(lx, k));
            hover.style.display = '';
            hRule.setAttribute('x1', x); hRule.setAttribute('x2', x);
            hDotA.setAttribute('cx', x); hDotA.setAttribute('cy', ya);
            hDotB.setAttribute('cx', x); hDotB.setAttribute('cy', yb);

            const n = 10 ** lx, opsA = n * n, opsB = k * n * lg(n);
            const win = opsA < opsB
                ? `Быстрее вставки — в ${times(opsB / opsA)}`
                : `Быстрее слияние — в ${times(opsA / opsB)}`;
            tip.innerHTML = `<div class="tip-h">n ≈ ${fmtCount(n)}</div>`
                + `<div class="tip-row"><i class="key key-a"></i>вставки: ${fmtSci(opsA)}</div>`
                + `<div class="tip-row"><i class="key key-b"></i>слияние: ${fmtSci(opsB)}</div>`
                + `<div class="tip-win">${win}</div>`;
            // Координаты SVG совпадают с CSS-пикселями сцены: svg нарисован 1:1.
            const [ox, oy] = svgOrigin(svg);
            const flip = x > W - 320;
            tip.style.left = `${ox + x + (flip ? -270 : 18)}px`;
            tip.style.top = `${oy + Math.max(m.t, Math.min(ya, yb) - 20)}px`;
            tip.classList.add('on');
        }
        hit.addEventListener('pointermove', onMove);
        hit.addEventListener('pointerleave', () => { hover.style.display = 'none'; tip.classList.remove('on'); });

        setFromRange();
    }

    // ===== Слайд «Гонка»: компьютер А (вставки) против Б (слияние) =====
    function setupRace() {
        const range = $('#raceRange');
        if (!range) return;
        const TA = (n) => (2 * n * n) / 1e10;
        const TB = (n) => (50 * n * lg(n)) / 1e7;
        const barA = $('#raceBarA'), barB = $('#raceBarB');
        const timeA = $('#raceTimeA'), timeB = $('#raceTimeB');
        const verdict = $('#raceVerdict');
        const runBtn = $('#raceRun');
        let n = 1e7, raf = 0;

        const verdictHtml = (a, b) => (b < a
            ? `Б быстрее в ${times(a / b)}<small>Лучший алгоритм перекрыл железо в 1000 раз быстрее</small>`
            : `А быстрее в ${times(b / a)}<small>На малых n железо и константы ещё решают — перелом при n ≈ 471 тыс.</small>`);

        function renderStatic() {
            cancelAnimationFrame(raf);
            raf = 0;
            runBtn.disabled = false;
            const a = TA(n), b = TB(n), max = Math.max(a, b);
            barA.style.width = `${(a / max) * 100}%`;
            barB.style.width = `${(b / max) * 100}%`;
            timeA.textContent = fmtTime(a);
            timeB.textContent = fmtTime(b);
            verdict.innerHTML = verdictHtml(a, b);
            $('#raceN').textContent = fmtCount(n);
            $$('[data-n]').forEach((btn) => btn.classList.toggle('is-active', Math.abs(Math.log10(+btn.dataset.n) - Math.log10(n)) < 1e-6));
        }

        function run() {
            const a = TA(n), b = TB(n), max = Math.max(a, b);
            const DUR = 4500;
            const start = performance.now();
            runBtn.disabled = true;
            verdict.innerHTML = 'Сортируем…';
            const step = (now) => {
                const elapsed = now - start;
                const pa = Math.min(1, elapsed / (DUR * (a / max)));
                const pb = Math.min(1, elapsed / (DUR * (b / max)));
                barA.style.width = `${pa * (a / max) * 100}%`;
                barB.style.width = `${pb * (b / max) * 100}%`;
                timeA.textContent = fmtTime(Math.max(pa * a, 1e-7));
                timeB.textContent = fmtTime(Math.max(pb * b, 1e-7));
                if (pa < 1 || pb < 1) raf = requestAnimationFrame(step);
                else renderStatic();
            };
            barA.style.width = '0'; barB.style.width = '0';
            raf = requestAnimationFrame(step);
        }

        range.addEventListener('input', () => { n = 10 ** +range.value; renderStatic(); });
        $$('[data-n]').forEach((btn) => btn.addEventListener('click', () => {
            n = +btn.dataset.n;
            range.value = Math.log10(n);
            renderStatic();
        }));
        runBtn.addEventListener('click', run);
        renderStatic();
    }

    // ===== Слайд «Веб-служба»: Дейкстра на графе дорог =====
    function setupRoute() {
        const svg = $('#routeSvg');
        if (!svg) return;
        const nodes = {
            S: [70, 300], a: [230, 140], b: [230, 460], c: [410, 80], d: [410, 300], e: [410, 520],
            f: [590, 170], g: [590, 410], h: [750, 90], i: [750, 300], j: [750, 520], T: [880, 300],
            k: [960, 150], l: [960, 460],
        };
        // Подпись «Клуба» — справа: снизу и сверху к нему подходят дороги от дальних точек.
        const names = { S: ['Дом', 0, 50, 'middle'], T: ['Клуб', 34, 6, 'start'] };
        const edges = [
            ['S', 'a', 4], ['S', 'b', 3], ['S', 'd', 7], ['a', 'c', 3], ['a', 'd', 2], ['b', 'd', 4],
            ['b', 'e', 3], ['c', 'f', 4], ['c', 'h', 9], ['d', 'f', 5], ['d', 'g', 3], ['e', 'g', 4],
            ['e', 'j', 8], ['f', 'h', 3], ['f', 'i', 4], ['g', 'i', 3], ['g', 'j', 4], ['h', 'T', 6],
            ['i', 'T', 3], ['j', 'T', 5], ['h', 'k', 8], ['k', 'T', 7], ['j', 'l', 9], ['l', 'T', 6],
        ];
        const edgeKey = (u, v) => (u < v ? `${u}-${v}` : `${v}-${u}`);
        const adj = {};
        Object.keys(nodes).forEach((id) => { adj[id] = []; });
        edges.forEach(([u, v, w]) => { adj[u].push([v, w]); adj[v].push([u, w]); });

        const edgeEls = {}, nodeEls = {}, distEls = {};
        const gE = el('g', {}, svg), gW = el('g', {}, svg), gN = el('g', {}, svg);
        edges.forEach(([u, v, w]) => {
            const [x1, y1] = nodes[u], [x2, y2] = nodes[v];
            edgeEls[edgeKey(u, v)] = el('line', { class: 'r-edge', x1, y1, x2, y2 }, gE);
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            el('rect', { class: 'r-w-bg', x: mx - 13, y: my - 12, width: 26, height: 22, rx: 5 }, gW);
            el('text', { class: 'r-w', x: mx, y: my + 5, 'text-anchor': 'middle' }, gW).textContent = w;
        });
        Object.entries(nodes).forEach(([id, [x, y]]) => {
            nodeEls[id] = el('circle', { class: `r-node${names[id] ? ' end' : ''}`, cx: x, cy: y, r: 22 }, gN);
            distEls[id] = el('text', { class: 'r-dist', x, y: y + 6, 'text-anchor': 'middle' }, gN);
            if (names[id]) {
                const [label, dx, dy, anchor] = names[id];
                el('text', { class: 'r-name', x: x + dx, y: y + dy, 'text-anchor': anchor }, gN).textContent = label;
            }
        });

        const status = $('#routeStatus');
        const runBtn = $('#routeRun');
        const steps = $$('#routeSteps li');
        const hl = (i) => steps.forEach((li, j) => li.classList.toggle('on', j === i));
        const idleText = status.innerHTML;
        const total = Object.keys(nodes).length;
        let timer = 0;

        function reset() {
            clearTimeout(timer);
            Object.values(edgeEls).forEach((e) => e.setAttribute('class', 'r-edge'));
            Object.entries(nodeEls).forEach(([id, c]) => c.setAttribute('class', `r-node${names[id] ? ' end' : ''}`));
            Object.values(distEls).forEach((t) => { t.textContent = '∞'; t.setAttribute('class', 'r-dist'); });
            distEls.S.textContent = '0';
            status.innerHTML = idleText;
            runBtn.disabled = false;
            hl(-1);
        }

        // Каждая итерация — два такта, чтобы слева успевал подсветиться свой шаг:
        // сначала «берём ближайшую точку», потом «проверяем её соседей».
        function run() {
            reset();
            runBtn.disabled = true;
            const dist = {}, prev = {}, done = new Set();
            Object.keys(nodes).forEach((id) => { dist[id] = Infinity; });
            dist.S = 0;

            const pick = () => {
                Object.values(edgeEls).forEach((e) => e.classList.remove('relax'));
                let u = null;
                for (const id of Object.keys(nodes)) {
                    if (!done.has(id) && (u === null || dist[id] < dist[u])) u = id;
                }
                if (u === null || dist[u] === Infinity) return finish(dist, prev, done);
                Object.values(nodeEls).forEach((c) => c.classList.remove('current'));
                nodeEls[u].classList.add('visited', 'current');
                distEls[u].classList.add('set');
                done.add(u);
                hl(0);
                const who = names[u] ? `«${names[u][0]}»` : 'точку';
                status.innerHTML = `Берём ${who}: до неё <b>${dist[u]} мин</b> — меньше, чем до любой другой необработанной. Обработано ${done.size} из ${total}.`;
                if (u === 'T') return finish(dist, prev, done);
                timer = setTimeout(() => relax(u), 650);
            };

            const relax = (u) => {
                hl(1);
                let better = 0;
                for (const [v, w] of adj[u]) {
                    if (done.has(v)) continue;
                    edgeEls[edgeKey(u, v)].classList.add('relax');
                    if (dist[u] + w < dist[v]) {
                        dist[v] = dist[u] + w;
                        prev[v] = u;
                        distEls[v].textContent = dist[v];
                        better++;
                    }
                }
                status.innerHTML = better
                    ? `Проверили соседей: через эту точку быстрее до <b>${better}</b> из них — записали им новое время.`
                    : 'Проверили соседей: через эту точку ни к кому не быстрее — ничего не меняем.';
                timer = setTimeout(pick, 650);
            };

            timer = setTimeout(pick, 200);
        }

        function finish(dist, prev, done) {
            Object.values(edgeEls).forEach((e) => e.classList.remove('relax'));
            Object.values(nodeEls).forEach((c) => c.classList.remove('current'));
            const path = ['T'];
            for (let p = 'T'; prev[p]; p = prev[p]) {
                edgeEls[edgeKey(p, prev[p])].classList.add('path');
                path.push(prev[p]);
            }
            path.forEach((id) => {
                nodeEls[id].classList.add('path');
                distEls[id].classList.add('on-path');
            });
            hl(2);
            status.innerHTML = `Маршрут найден: <b>${dist.T} мин</b>. Алгоритм остановился, как только дошёл до клуба: обработал <b>${done.size}</b> точек из ${total}, дальние ему не понадобились.`;
            runBtn.disabled = false;
        }

        runBtn.addEventListener('click', run);
        $('#routeReset').addEventListener('click', reset);
        reset();
    }

    // Три пункта слева — вкладки: у каждого своё демо справа и свои контролы.
    function setupRouteTabs() {
        const root = $('#routeDemo');
        if (!root) return;
        const tabs = $$('.route-tab', root);
        tabs.forEach((tab) => tab.addEventListener('click', () => {
            tabs.forEach((t) => {
                t.classList.toggle('on', t === tab);
                t.setAttribute('aria-selected', String(t === tab));
            });
            $$('[data-panel]', root).forEach((p) => p.classList.toggle('on', p.dataset.panel === tab.dataset.mode));
        }));
    }

    // Детерминированный «шум»: картинка одинаковая при каждой загрузке.
    function seeded(seed) {
        let s = seed;
        return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    }

    // ===== Визуализация карт: упрощение линии Рамера — Дугласа — Пекера =====
    function segDist([px, py], [ax, ay], [bx, by]) {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    function simplify(pts, eps) {
        if (eps <= 0 || pts.length < 3) return pts.slice();
        const keep = new Uint8Array(pts.length);
        keep[0] = 1; keep[pts.length - 1] = 1;
        const stack = [[0, pts.length - 1]];
        while (stack.length) {
            const [a, b] = stack.pop();
            let maxD = -1, idx = -1;
            for (let i = a + 1; i < b; i++) {
                const d = segDist(pts[i], pts[a], pts[b]);
                if (d > maxD) { maxD = d; idx = i; }
            }
            if (maxD > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
        }
        return pts.filter((_, i) => keep[i]);
    }

    function setupSimplify() {
        const svg = $('#simpSvg');
        if (!svg) return;
        const range = $('#simpRange');
        const runBtn = $('#simpRun');
        const runLabel = runBtn.innerHTML;
        const status = $('#simpStatus');
        const steps = $$('#simpSteps li');
        const hl = (i) => steps.forEach((li, j) => li.classList.toggle('on', j === i));

        const rnd = seeded(7);
        const road = [];
        for (let i = 0; i < 300; i++) {
            const x = 30 + (950 * i) / 299;
            const y = 310 + 150 * Math.sin(x / 95) + 55 * Math.sin(x / 33 + 1.3) + 14 * Math.sin(x / 9) + (rnd() - 0.5) * 6;
            road.push([x, y]);
        }
        const N = road.length;
        const toD = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');

        const tube = el('polygon', { class: 'simp-tube' }, svg);
        el('path', { class: 'simp-orig', d: toD(road) }, svg);
        const line = el('path', { class: 'simp-line' }, svg);
        const dots = el('g', {}, svg);
        const chord = el('line', { class: 'simp-chord' }, svg);
        const perp = el('line', { class: 'simp-perp' }, svg);
        const far = el('circle', { class: 'simp-far', r: 10 }, svg);
        const farText = el('text', { class: 'simp-step' }, svg);
        const helpers = [tube, chord, perp, far, farText];
        const showHelpers = (on) => helpers.forEach((h) => { h.style.display = on ? '' : 'none'; });
        const caption = el('text', { class: 'simp-caption', x: 30, y: 28 }, svg);
        const epsBar = el('line', { class: 'simp-eps', x1: 30, y1: 580, y2: 580 }, svg);
        const epsText = el('text', { class: 'simp-eps-l', y: 585 }, svg);

        const zoomName = (v) => (v < 10 ? 'улица' : v < 35 ? 'район' : v < 65 ? 'город' : v < 90 ? 'область' : 'страна');
        const epsOf = (v) => 40 * (v / 100) ** 2;
        let timer = 0, running = false;

        function renderKept(idx) {
            const pts = idx.map((i) => road[i]);
            line.setAttribute('d', toD(pts));
            dots.replaceChildren();
            // На 300 точках кружки слились бы в сплошную полосу — рисуем их, только когда их мало.
            if (pts.length <= 80) pts.forEach(([cx, cy]) => el('circle', { class: 'simp-dot', cx, cy, r: 5 }, dots));
            caption.textContent = `тонкая линия — исходная дорога (${N} точек), жирная — что рисуем (${pts.length})`;
        }

        function renderScale() {
            const v = +range.value, eps = epsOf(v);
            $('#simpZoom').textContent = zoomName(v);
            epsBar.setAttribute('x2', 30 + Math.max(eps, 1));
            epsText.setAttribute('x', 30 + Math.max(eps, 1) + 10);
            epsText.textContent = `допуск ε = ${fmt(eps, 0)} px — изгибы меньше него на этом масштабе не видны`;
            return eps;
        }

        function stop() {
            clearTimeout(timer);
            running = false;
            runBtn.innerHTML = runLabel;
            showHelpers(false);
            hl(-1);
        }

        function draw() {
            stop();
            const eps = renderScale();
            const pts = simplify(road, eps);
            renderKept(pts.map((p) => road.indexOf(p)));
            status.innerHTML = eps > 0
                ? `Рисуем <b>${pts.length}</b> точек из ${N} — в ${times(N / pts.length)} меньше работы, а на экране разницы не видно. Так упрощает линии, например, Leaflet.`
                : `Вблизи рисуем все <b>${N}</b> точек. Отдалите карту слайдером или нажмите «Показать по шагам».`;
        }

        // Те же шаги, что в simplify(), но записанные по порядку: левую половину — раньше правой.
        function trace(eps) {
            const out = [];
            const stack = [[0, N - 1]];
            while (stack.length) {
                const [a, b] = stack.pop();
                if (b - a < 2) continue;
                let d = -1, idx = -1;
                for (let i = a + 1; i < b; i++) {
                    const di = segDist(road[i], road[a], road[b]);
                    if (di > d) { d = di; idx = i; }
                }
                const keep = d > eps;
                out.push({ a, b, idx, d, keep });
                if (keep) stack.push([idx, b], [a, idx]);
            }
            return out;
        }

        function run() {
            if (running) return draw();
            if (+range.value < 50) range.value = 70;
            const eps = renderScale();
            const plan = trace(eps);
            const kept = [0, N - 1];
            renderKept(kept);
            running = true;
            runBtn.textContent = 'Сразу к результату';
            showHelpers(true);
            let i = 0;

            // Первые шаги — медленно и по фазам, дальше — быстро, иначе анимация растянулась бы на минуту.
            const step = () => {
                if (i >= plan.length) {
                    draw();
                    const n = simplify(road, eps).length;
                    status.innerHTML = `Готово: из ${N} точек осталось <b>${n}</b>. Рисовать в ${times(N / n)} меньше, а форма дороги сохранилась.`;
                    return;
                }
                const s = plan[i];
                const slow = i < 4;
                const [ax, ay] = road[s.a], [bx, by] = road[s.b], [px, py] = road[s.idx];
                const len = Math.hypot(bx - ax, by - ay) || 1;
                const nx = (-(by - ay) / len) * eps, ny = ((bx - ax) / len) * eps;
                tube.setAttribute('points', `${ax + nx},${ay + ny} ${bx + nx},${by + ny} ${bx - nx},${by - ny} ${ax - nx},${ay - ny}`);
                chord.setAttribute('x1', ax); chord.setAttribute('y1', ay);
                chord.setAttribute('x2', bx); chord.setAttribute('y2', by);
                [perp, far, farText].forEach((h) => { h.style.display = 'none'; });
                hl(0);
                status.innerHTML = `Шаг ${i + 1} из ${plan.length}: соединяем концы участка прямой. Полоса вокруг неё — допуск ε.`;

                timer = setTimeout(() => {
                    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len)));
                    perp.setAttribute('x1', px); perp.setAttribute('y1', py);
                    perp.setAttribute('x2', ax + t * (bx - ax)); perp.setAttribute('y2', ay + t * (by - ay));
                    far.setAttribute('cx', px); far.setAttribute('cy', py);
                    const right = px < 800;
                    farText.setAttribute('x', px + (right ? 16 : -16));
                    farText.setAttribute('y', py - 14);
                    farText.setAttribute('text-anchor', right ? 'start' : 'end');
                    farText.textContent = `${fmt(s.d, 0)} px`;
                    [perp, far, farText].forEach((h) => { h.style.display = ''; });
                    hl(1);
                    status.innerHTML = `Шаг ${i + 1} из ${plan.length}: самая дальняя точка — в <b>${fmt(s.d, 0)} px</b> от прямой, допуск ε = ${fmt(eps, 0)} px.`;

                    timer = setTimeout(() => {
                        hl(2);
                        if (s.keep) {
                            kept.push(s.idx);
                            kept.sort((x, y) => x - y);
                            renderKept(kept);
                        }
                        status.innerHTML = `Шаг ${i + 1} из ${plan.length}: ${fmt(s.d, 0)} px ${s.keep
                            ? '&gt; ε — точка важна для формы: оставляем её и делим участок на два.'
                            : '≤ ε — изгиб не виден: выкидываем все точки между концами участка.'}`;
                        i++;
                        timer = setTimeout(step, slow ? 1100 : 260);
                    }, slow ? 1200 : 200);
                }, slow ? 1000 : 160);
            };
            step();
        }

        range.addEventListener('input', draw);
        runBtn.addEventListener('click', run);
        draw();
    }

    // ===== Интерполяция адресов: точка дома на отрезке улицы =====
    function setupAddress() {
        const svg = $('#addrSvg');
        if (!svg) return;
        const range = $('#addrRange');
        const X0 = 130, X1 = 880, Y = 300, HALF = 40;

        el('line', { class: 'addr-road', x1: 20, x2: 990, y1: Y, y2: Y, style: `stroke-width: ${HALF * 2}` }, svg);
        [X0, X1].forEach((x) => el('line', { class: 'addr-road', x1: x, x2: x, y1: 44, y2: 556 }, svg));
        el('line', { class: 'addr-mark', x1: X0 + 50, x2: X1 - 50, y1: Y, y2: Y }, svg);

        // Дома вдоль отрезка — нарочно разной ширины и с разными промежутками.
        const rnd = seeded(42);
        const houses = (edge, up) => {
            for (let x = X0 + 44; x < X1 - 90;) {
                const w = 38 + rnd() * 46, h = 50 + rnd() * 55;
                el('rect', { class: 'addr-house', x, y: up ? edge - h : edge, width: w, height: h, rx: 4 }, svg);
                x += w + 8 + rnd() * 34;
            }
        };
        houses(Y - HALF - 12, true);
        houses(Y + HALF + 12, false);

        el('text', { class: 'addr-side', x: 505, y: 26, 'text-anchor': 'middle' }, svg).textContent = 'нечётная сторона улицы: дома 1, 3, 5 … 99';
        el('text', { class: 'addr-side', x: 505, y: 590, 'text-anchor': 'middle' }, svg).textContent = 'чётная сторона: дома 2, 4, 6 … 100';
        [X0, X1].forEach((x) => { el('text', { class: 'addr-cross', x, y: 34, 'text-anchor': 'middle' }, svg).textContent = 'перекрёсток'; });

        // Известные точки — дома на концах отрезка (■), вычисленная — метка дома (●).
        const known = [];
        [[X0, true, 'дом 1'], [X1, true, 'дом 99'], [X0, false, 'дом 2'], [X1, false, 'дом 100']].forEach(([x, odd, t]) => {
            const y = odd ? Y - HALF : Y + HALF;
            const sq = el('rect', { class: 'addr-known', x: x - 9, y: y - 9, width: 18, height: 18, rx: 3 }, svg);
            const tx = el('text', { class: 'addr-end', x, y: odd ? 112 : 506, 'text-anchor': 'middle' }, svg);
            tx.textContent = t;
            known.push({ odd, parts: [sq, tx] });
        });

        const dimLine = el('line', { class: 'addr-dim' }, svg);
        const tick0 = el('line', { class: 'addr-dim' }, svg);
        const tick1 = el('line', { class: 'addr-dim' }, svg);
        const dimText = el('text', { class: 'addr-dim-l' }, svg);
        const stem = el('line', { class: 'addr-stem' }, svg);
        const pin = el('circle', { class: 'addr-pin', r: 11 }, svg);
        const label = el('text', { class: 'addr-label', 'text-anchor': 'middle' }, svg);

        function draw() {
            const n = +range.value;
            const odd = n % 2 === 1;
            const [from, to] = odd ? [1, 99] : [2, 100];
            const t = (n - from) / (to - from);
            const pct = fmt(t * 100, 0);
            const x = X0 + t * (X1 - X0);
            const edgeY = odd ? Y - HALF : Y + HALF;

            known.forEach((k) => k.parts.forEach((p) => { p.style.opacity = k.odd === odd ? 1 : 0.3; }));

            // Размерная линия «сколько процентов отрезка» — в полосе своей стороны дороги.
            const dy = odd ? Y - 28 : Y + 28;
            dimLine.setAttribute('x1', X0); dimLine.setAttribute('x2', x);
            dimLine.setAttribute('y1', dy); dimLine.setAttribute('y2', dy);
            [[tick0, X0], [tick1, x]].forEach(([tk, tx]) => {
                tk.setAttribute('x1', tx); tk.setAttribute('x2', tx);
                tk.setAttribute('y1', dy - 7); tk.setAttribute('y2', dy + 7);
            });
            const wide = x - X0 > 190;
            dimText.setAttribute('x', wide ? (X0 + x) / 2 : x + 14);
            dimText.setAttribute('text-anchor', wide ? 'middle' : 'start');
            dimText.setAttribute('y', odd ? Y - 8 : Y + 20);
            dimText.textContent = `${pct} % длины отрезка`;

            const labelY = odd ? 84 : 546;
            stem.setAttribute('x1', x); stem.setAttribute('x2', x);
            stem.setAttribute('y1', edgeY); stem.setAttribute('y2', odd ? labelY + 10 : labelY - 26);
            pin.setAttribute('cx', x); pin.setAttribute('cy', edgeY);
            label.setAttribute('x', Math.min(Math.max(x, 130), 880)); label.setAttribute('y', labelY);
            label.textContent = `дом ${n} — примерно здесь`;

            $('#addrNum').textContent = n;
            $('#addrKnown').textContent = `${from} и ${to}`;
            $('#addrFormula').innerHTML = `t = (${n} − ${from}) / (${to} − ${from}) ≈ <b>${fmt(t, 2)}</b>, то есть дом ${n} — на ${pct} % пути от дома ${from} к дому ${to}`;
            $('#addrPlace').textContent = `отступаем ${pct} % длины отрезка от левого перекрёстка`;
        }
        range.addEventListener('input', draw);
        draw();
    }

    function setupTechCards() {
        $$('#techGrid .tech-card').forEach((card) => {
            card.addEventListener('click', () => card.classList.toggle('open'));
        });
    }

    // ===== Разбор 1.2.3: график 100n² против 2ⁿ =====
    function setupPolyExp() {
        const svg = $('#peChart');
        if (!svg) return;
        const tip = $('#peTip');
        const W = 760, H = 330;
        const m = { l: 70, r: 70, t: 14, b: 40 };
        const N1 = 16, YMAX = 70000;
        const sx = (n) => m.l + (n / N1) * (W - m.l - m.r);
        const sy = (v) => H - m.b - (Math.min(v, YMAX) / YMAX) * (H - m.t - m.b);
        const poly = (n) => 100 * n * n;
        const expo = (n) => 2 ** n;

        [0, 20000, 40000, 60000].forEach((v) => {
            el('line', { class: v ? 'ax-grid' : 'ax-base', x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v) }, svg);
            el('text', { class: 'ax-tick', x: m.l - 10, y: sy(v) + 5, 'text-anchor': 'end' }, svg).textContent = fmt(v, 0);
        });
        [0, 4, 8, 12, 16].forEach((n) => {
            el('text', { class: 'ax-tick', x: sx(n), y: H - m.b + 24, 'text-anchor': 'middle' }, svg).textContent = n;
        });
        el('text', { class: 'ax-title', x: W - m.r + 16, y: H - m.b + 24, 'text-anchor': 'start' }, svg).textContent = 'n';

        const path = (f) => {
            const pts = [];
            for (let i = 0; i <= 320; i++) {
                const n = (N1 * i) / 320;
                pts.push(`${i ? 'L' : 'M'}${sx(n).toFixed(1)},${sy(f(n)).toFixed(1)}`);
            }
            return pts.join('');
        };
        el('path', { class: 'ln ln-a', d: path(poly) }, svg);
        el('path', { class: 'ln ln-b', d: path(expo) }, svg);
        el('text', { class: 'end-label', x: W - m.r + 10, y: sy(poly(N1)) + 6 }, svg).textContent = '100n²';
        el('text', { class: 'end-label', x: W - m.r + 10, y: sy(expo(N1)) + 6 }, svg).textContent = '2ⁿ';

        // Точка пересечения — корень 100n² = 2ⁿ (≈ 14,32), и первое целое n, где экспонента уже больше.
        const cross = 14.3247;
        el('line', { class: 'cross-rule', x1: sx(cross), x2: sx(cross), y1: m.t, y2: H - m.b }, svg);
        el('circle', { class: 'cross-dot', cx: sx(cross), cy: sy(poly(cross)), r: 7 }, svg);
        el('text', { class: 'cross-label', x: sx(cross) - 14, y: sy(poly(cross)) - 16, 'text-anchor': 'end' }, svg).textContent = 'пересечение: n ≈ 14,32';
        el('text', { class: 'wash-label', x: sx(4), y: sy(12000), 'text-anchor': 'middle' }, svg).textContent = 'полином больше';
        el('text', { class: 'wash-label', x: sx(14), y: sy(56000), 'text-anchor': 'end' }, svg).textContent = 'с n = 15 экспонента больше →';

        const hover = el('g', { style: 'display: none' }, svg);
        const hRule = el('line', { class: 'hover-rule', y1: m.t, y2: H - m.b }, hover);
        const hA = el('circle', { class: 'hover-dot-a', r: 6 }, hover);
        const hB = el('circle', { class: 'hover-dot-b', r: 6 }, hover);
        const hit = el('rect', { class: 'hit', x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svg);

        // Наведение прилипает к целым n: задача про целое число элементов.
        hit.addEventListener('pointermove', (e) => {
            const p = svg.createSVGPoint();
            p.x = e.clientX; p.y = e.clientY;
            const loc = p.matrixTransform(svg.getScreenCTM().inverse());
            const n = Math.max(1, Math.min(N1, Math.round(((loc.x - m.l) / (W - m.l - m.r)) * N1)));
            const x = sx(n);
            hover.style.display = '';
            hRule.setAttribute('x1', x); hRule.setAttribute('x2', x);
            hA.setAttribute('cx', x); hA.setAttribute('cy', sy(poly(n)));
            hB.setAttribute('cx', x); hB.setAttribute('cy', sy(expo(n)));
            const stepA = poly(n) / poly(n - 1);
            tip.innerHTML = `<div class="tip-h">n = ${n}</div>`
                + `<div class="tip-row"><i class="key key-a"></i>100n² = ${fmt(poly(n), 0)}${n > 1 ? ` · шаг ×${fmt(stepA, 2)}` : ''}</div>`
                + `<div class="tip-row"><i class="key key-b"></i>2ⁿ = ${fmt(expo(n), 0)} · шаг ×2</div>`
                + `<div class="tip-win">${poly(n) < expo(n) ? 'Экспонента уже больше' : 'Пока больше полином'}</div>`;
            const flip = x > W - 300;
            const [ox, oy] = svgOrigin(svg);
            tip.style.left = `${ox + x + (flip ? -270 : 18)}px`;
            tip.style.top = `${oy + 60}px`;
            tip.classList.add('on');
        });
        hit.addEventListener('pointerleave', () => { hover.style.display = 'none'; tip.classList.remove('on'); });
    }

    // ===== Задача 1.1: таблица пересчитывается под скорость компьютера =====
    function sciHtml(x) {
        let e = Math.floor(Math.log10(x));
        let mant = Math.round((x / 10 ** e) * 10) / 10;
        if (mant >= 10) { mant = 1; e += 1; }
        return `${mant === 1 ? '' : `${fmt(mant, 1)}·`}10${sup(e)}`;
    }
    const countHtml = (n, limit) => (n < limit ? fmt(Math.floor(n), 0) : sciHtml(n));

    function maxNLogN(ops) {
        let lo = 1, hi = Math.max(2, ops);
        for (let i = 0; i < 200; i++) {
            const mid = Math.sqrt(lo * hi);
            if (mid * lg(mid) <= ops) lo = mid; else hi = mid;
        }
        return lo;
    }
    function maxFact(ops) {
        let n = 1, f = 1;
        while (f * (n + 1) <= ops) { n++; f *= n; }
        return n;
    }

    const elems = (k) => {
        const d = k % 10, dd = k % 100;
        const w = d === 1 && dd !== 11 ? 'элемент' : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'элемента' : 'элементов';
        return `${k} ${w}`;
    };

    const T11_ROWS = [
        ['lg n', (ops) => `2<sup>${sciHtml(ops)}</sup>`],
        ['√n', (ops) => sciHtml(ops * ops)],
        ['n', (ops) => sciHtml(ops)],
        ['n lg n', (ops) => countHtml(maxNLogN(ops), 1e5)],
        ['n<sup>2</sup>', (ops) => countHtml(Math.sqrt(ops), 1e9)],
        ['n<sup>3</sup>', (ops) => countHtml(Math.cbrt(ops) * (1 + 1e-12), 1e9)],
        ['2<sup>n</sup>', (ops) => fmt(Math.floor(lg(ops)), 0)],
        ['n!', (ops) => fmt(maxFact(ops), 0)],
    ];
    const T11_SECONDS = [1, 60, 3600, 86400, 2592000, 31536000, 3153600000];

    function setupTable() {
        const table = $('#t11');
        if (!table) return;
        const tbody = $('tbody', table);
        const insight = $('#t11Insight');
        tbody.innerHTML = T11_ROWS.map(([label]) => `<tr><td>${label}</td>${T11_SECONDS.map(() => '<td><span class="v"></span></td>').join('')}</tr>`).join('');
        const rows = $$('tr', tbody);
        let speed = 1e6;

        function fill() {
            rows.forEach((tr, r) => {
                $$('.v', tr).forEach((cell, c) => { cell.innerHTML = T11_ROWS[r][1](speed * T11_SECONDS[c]); });
            });
            const k = speed / 1e6;
            const sec = speed, cent = speed * T11_SECONDS[6];
            $('#t11SpeedNote').innerHTML = k === 1
                ? 'Цифры таблицы — для 10⁶ операций в секунду.'
                : `В ${fmt(k, 0)} раз быстрее условия: для <i>n</i> — в ${fmt(k, 0)} раз больше данных, для <i>n</i>² — в ${fmt(Math.sqrt(k), 0)}, а для 2<sup><i>n</i></sup> — всего <b>+${Math.floor(lg(sec)) - Math.floor(lg(1e6))}</b>.`;
            insight.innerHTML = `Век вместо секунды — это в 3·10⁹ раз больше времени. Для <i>n</i> lg <i>n</i> это ≈ в ${sciHtml(maxNLogN(cent) / maxNLogN(sec))} раз больше данных, `
                + `для <i>n</i>² — в ${fmt(Math.sqrt(T11_SECONDS[6]), 0)} раз, для <i>n</i>³ — в ${fmt(Math.cbrt(T11_SECONDS[6]), 0)} раз, `
                + `а для 2<sup><i>n</i></sup> — <b>всего +${elems(Math.floor(lg(cent)) - Math.floor(lg(sec)))}</b>, для <i>n</i>! — <b>+${maxFact(cent) - maxFact(sec)}</b>.`;
        }

        const sync = () => insight.classList.toggle('revealed', rows.every((r) => r.classList.contains('open')));
        rows.forEach((r) => r.addEventListener('click', () => { r.classList.toggle('open'); sync(); }));
        $('#t11All').addEventListener('click', () => { rows.forEach((r) => r.classList.add('open')); sync(); });
        $('#t11None').addEventListener('click', () => { rows.forEach((r) => r.classList.remove('open')); sync(); });
        $$('#t11Speed [data-speed]').forEach((btn) => btn.addEventListener('click', () => {
            speed = +btn.dataset.speed;
            $$('#t11Speed [data-speed]').forEach((b) => b.classList.toggle('is-active', b === btn));
            fill();
        }));
        fill();
    }

    // deck.js сбрасывает «отгибающиеся» выводы только на восьмом слайде шаблона,
    // а у нас выводы дальше, поэтому сбрасываем сами при каждом входе на слайд.
    function resetPeel() {
        $$('.peel-cover').forEach((c) => c.classList.remove('peeled'));
        $('#mainTakeawayCard')?.classList.remove('revealed');
        window.peeledCount = 0;
    }

    const onEnter = setupHashNav();
    setupBlurAfterClick();
    setupReveals();
    setupCrossover();
    setupRace();
    setupRoute();
    setupRouteTabs();
    setupSimplify();
    setupAddress();
    setupTechCards();
    setupPolyExp();
    setupTable();
    onEnter($('.peel-container')?.closest('.slide'), resetPeel);
})();
