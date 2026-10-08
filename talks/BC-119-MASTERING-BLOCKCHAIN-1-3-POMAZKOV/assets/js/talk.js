// talk.js — поведение контентных слайдов ЭТОГО доклада
// («История блокчейна», глава 1).
// Общий движок (клавиши, масштаб, прогресс) живёт в deck.js и правится только
// в шаблоне. Здесь то, чего в нём нет: порядок появления блоков, нижняя шкала
// времени, общая для всех слайдов, переход на слайд по клику, раскрытие блока
// «Как это работает», переключатели демонстраций, живой майнер Hashcash
// и панель заметок докладчика.

(function () {
    const slides = [...document.querySelectorAll('.slide')];
    const stage = document.getElementById('deckStage');

    // ---------- Появление блоков ----------
    // Сама анимация — в talk.css и привязана к .slide.active, поэтому
    // проигрывается при каждом входе на слайд. Здесь только разметка: какие
    // блоки участвуют (data-rv = вид появления) и в каком порядке (--d).
    // Без этого скрипта слайды просто показываются целиком.
    const REVEAL = [
        ['.fact, .chain > .cn, .hc-b, .conv-node', 'pop'],
        ['.ev, .tbl-r, .smr-r, .kbar', 'left'],
        ['.blk-f, .blk-net', 'right'],
        ['.card, .wide-accent, .chart-box, .section-label, .fig, .demo-bar, .ov-col, .ov-legend, .miner', 'up'],
    ];
    const ALL = REVEAL.map(([sel]) => sel).join(', ') + ', [data-rv]';

    slides.forEach((slide) => {
        const root = slide.querySelector('.content-slide');
        if (!root) return;
        const items = [...root.querySelectorAll(ALL)].filter(
            (el) => !el.closest('svg, .cap') && !el.parentElement.closest(ALL),
        );
        const step = Math.max(45, Math.min(110, 1900 / Math.max(items.length, 1)));
        items.forEach((el, i) => {
            el.style.setProperty('--d', `${Math.round(250 + i * step)}ms`);
            if (el.hasAttribute('data-rv')) return;
            const rule = REVEAL.find(([sel]) => el.matches(sel));
            el.setAttribute('data-rv', rule ? rule[1] : 'up');
        });
        root.querySelectorAll('.chain').forEach((row) => {
            [...row.children].forEach((child, k) => child.style.setProperty('--k', k));
        });
    });

    // ---------- Переход на слайд по клику ----------
    // Своего API у deck.js нет, поэтому «перематываем» дек теми же стрелками,
    // которые он слушает: прогресс и заметки остаются в согласии с движком.
    function gotoSlide(index) {
        const from = slides.findIndex((sl) => sl.classList.contains('active'));
        if (from < 0 || index < 0) return;
        const step = index > from ? 'ArrowRight' : 'ArrowLeft';
        for (let i = 0; i < Math.abs(index - from); i++) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: step }));
        }
    }
    const gotoId = (id) => gotoSlide(slides.indexOf(document.getElementById(`slide-${id}`)));

    document.querySelectorAll('[data-goto]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            gotoId(el.getAttribute('data-goto'));
            el.blur();
        });
    });

    // ---------- Нижняя шкала времени ----------
    // Одна сплошная линия на весь доклад, по точке на событие. Живёт в сцене
    // поверх слайдов, поэтому не перерисовывается, а едет: пройденный путь
    // залит, точка текущего слайда и её год — крупнее. Строится по слайду
    // «Общий таймлайн» — список событий есть только там.
    const events = [...document.querySelectorAll('.ov-ev[data-ev]')];
    let rail = null;
    if (events.length && stage) {
        rail = document.createElement('nav');
        rail.className = 'rail';
        rail.setAttribute('aria-label', 'Таймлайн доклада');
        rail.innerHTML = '<div class="rail-line"><i class="rail-fill"></i></div>';
        events.forEach((ev, k) => {
            const pt = document.createElement('button');
            pt.type = 'button';
            pt.className = `rail-pt ${[...ev.classList].find((c) => c.startsWith('l-')) || ''}`;
            pt.dataset.ev = ev.dataset.ev;
            pt.title = `${ev.dataset.y} · ${ev.lastChild.textContent.trim()}`;
            pt.style.left = `${(k / (events.length - 1)) * 100}%`;
            pt.innerHTML = `<span class="rail-yr">${ev.dataset.y}</span><b class="rail-dot"></b>`;
            pt.addEventListener('click', (e) => {
                e.stopPropagation();
                gotoId(ev.dataset.ev);
                pt.blur();
            });
            rail.appendChild(pt);
        });
        stage.appendChild(rail);
    }

    let slideMarks = [];
    function setMarks(ids) {
        if (!rail) return;
        rail.classList.toggle('has-marks', ids.length > 0);
        rail.querySelectorAll('.rail-pt').forEach((p) => p.classList.toggle('is-mark', ids.includes(p.dataset.ev)));
    }

    // data-ev слайда — его точка на шкале; «end» — сводные слайды после
    // последнего события: весь путь пройден.
    function updateRail(slide) {
        if (!rail) return;
        const id = slide.dataset.ev;
        rail.classList.toggle('is-on', Boolean(id));
        if (!id) return;
        const pts = [...rail.querySelectorAll('.rail-pt')];
        const cur = id === 'end' ? pts.length : pts.findIndex((p) => p.dataset.ev === id);
        pts.forEach((p, i) => {
            p.classList.toggle('is-past', i < cur);
            p.classList.toggle('is-cur', i === cur);
        });
        rail.querySelector('.rail-fill').style.width = `${Math.min(1, cur / (pts.length - 1)) * 100}%`;
        slideMarks = (slide.dataset.railMark || '').split(/\s+/).filter(Boolean);
        setMarks(slideMarks);
    }

    // Наведение на часть блока, идею рисунка 1.3 или карточку наследия
    // подсвечивает её события на шкале; уход — возвращает подсветку слайда.
    document.querySelectorAll('[data-marks]').forEach((el) => {
        el.addEventListener('mouseenter', () => setMarks(el.dataset.marks.split(/\s+/)));
        el.addEventListener('mouseleave', () => setMarks(slideMarks));
    });

    // ---------- «Как это работает» ----------
    // Необязательный блок слайда события: на слайде от него только кнопка
    // с пунктирной рамкой, схема или демонстрация раскрывается поверх слайда.
    // Закрывается той же кнопкой, «свернуть», Esc и при уходе со слайда.
    const hows = [...document.querySelectorAll('.how')];
    const howBtns = [...document.querySelectorAll('[data-how]')];

    function closeHows() {
        hows.forEach((h) => h.classList.remove('is-open'));
        howBtns.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
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

    // ---------- Переключатели демонстраций ----------
    // Кнопка пишет data-state в блок-цель, остальное решает CSS. Подписи
    // (.cap) лежат в .caps[data-caps=<id цели>]. Исходное состояние берём
    // из разметки и возвращаемся к нему при уходе со слайда.
    const segsAll = [...document.querySelectorAll('.seg[data-target]')];

    function applyState(seg, value) {
        const id = seg.getAttribute('data-target');
        const target = document.getElementById(id);
        if (!target) return;
        target.setAttribute('data-state', value);
        seg.querySelectorAll('button[data-value]').forEach((b) => {
            b.classList.toggle('is-active', b.getAttribute('data-value') === value);
        });
        document.querySelectorAll(`.caps[data-caps="${id}"] .cap`).forEach((cap) => {
            cap.classList.toggle('is-on', cap.dataset.for === value);
        });
    }

    segsAll.forEach((seg) => {
        const target = document.getElementById(seg.getAttribute('data-target'));
        seg.dataset.initial = target ? target.getAttribute('data-state') || '' : '';
        applyState(seg, seg.dataset.initial);
        seg.querySelectorAll('button[data-value]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyState(seg, btn.getAttribute('data-value'));
                btn.blur();
            });
        });
    });

    // ---------- Майнер Hashcash ----------
    // Настоящий перебор SHA-256 в браузере: ищем nonce, при котором хеш
    // начинается с нужного числа нулей. Считаем порциями по ~14 мс,
    // чтобы счётчик бежал на глазах, а слайд не замирал.
    const K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]);
    const W = new Uint32Array(64);
    const enc = new TextEncoder();

    function sha256hex(bytes) {
        const len = bytes.length;
        const blocks = ((len + 9 + 63) >> 6) << 6;
        const buf = new Uint8Array(blocks);
        buf.set(bytes);
        buf[len] = 0x80;
        const bits = len * 8;
        buf[blocks - 4] = bits >>> 24;
        buf[blocks - 3] = (bits >>> 16) & 255;
        buf[blocks - 2] = (bits >>> 8) & 255;
        buf[blocks - 1] = bits & 255;
        let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
        let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
        for (let off = 0; off < blocks; off += 64) {
            for (let i = 0; i < 16; i++) {
                const j = off + i * 4;
                W[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
            }
            for (let i = 16; i < 64; i++) {
                const a = W[i - 15], b = W[i - 2];
                const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
                const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
                W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
            }
            let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
            for (let i = 0; i < 64; i++) {
                const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
                const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
                const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
                const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
            h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
        }
        return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
    }

    const miner = document.getElementById('miner');
    let stopMiner = () => {};
    if (miner) {
        const $ = (s) => miner.querySelector(s);
        const fmt = (n) => n.toLocaleString('ru-RU');
        const tries = (n) => {
            const d = n % 10, dd = n % 100;
            const w = d === 1 && dd !== 11 ? 'попытку' : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'попытки' : 'попыток';
            return `${fmt(n)} ${w}`;
        };
        // Соль новая на каждый запуск: иначе данные одни и те же и nonce
        // всегда находится за одно и то же число попыток.
        const salt = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
        let run = 0;

        function paintHash(hex, zeros) {
            const ok = hex.startsWith('0'.repeat(zeros));
            $('.mn-hash').innerHTML = ok ? `<b>${hex.slice(0, zeros)}</b>${hex.slice(zeros)}` : hex;
        }

        function reset() {
            run += 1;
            miner.classList.remove('is-found');
            $('.mn-nonce').textContent = '0';
            $('.mn-hash').textContent = '—';
            $('.mn-tries').textContent = '0';
            $('.mn-go').disabled = false;
            $('.mn-msg').textContent = 'Каждый лишний ноль — в 16 раз больше работы.';
        }

        function setZeros(z) {
            miner.dataset.zeros = String(z);
            miner.querySelectorAll('.mn-seg button').forEach((b) => b.classList.toggle('is-active', b.dataset.zeros === String(z)));
            $('.mn-expect').textContent = fmt(16 ** z);
            reset();
        }

        miner.querySelectorAll('.mn-seg button').forEach((b) => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                setZeros(Number(b.dataset.zeros));
                b.blur();
            });
        });

        $('.mn-go').addEventListener('click', (e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            reset();
            const my = run;
            const zeros = Number(miner.dataset.zeros);
            const want = '0'.repeat(zeros);
            const s = salt();
            $('.mn-salt').textContent = s;
            const PREFIX = `Книжный клуб · блок 1 · соль=${s} · nonce=`;
            const t0 = performance.now();
            let nonce = 0;
            $('.mn-go').disabled = true;
            $('.mn-msg').textContent = 'Перебираем…';
            function frame() {
                if (my !== run) return;
                const until = performance.now() + 14;
                let hex = '';
                while (performance.now() < until) {
                    for (let i = 0; i < 400; i++) {
                        hex = sha256hex(enc.encode(PREFIX + nonce));
                        if (hex.startsWith(want)) break;
                        nonce += 1;
                    }
                    if (hex.startsWith(want)) break;
                }
                $('.mn-nonce').textContent = String(nonce);
                $('.mn-tries').textContent = fmt(nonce + 1);
                paintHash(hex, zeros);
                if (hex.startsWith(want)) {
                    const ms = Math.round(performance.now() - t0);
                    miner.classList.add('is-found');
                    $('.mn-go').disabled = false;
                    $('.mn-msg').textContent = `Найдено за ${tries(nonce + 1)} и ${fmt(ms)} мс. Проверить — один хеш.`;
                    return;
                }
                setTimeout(frame, 16);
            }
            setTimeout(frame, 16);
        });

        stopMiner = () => setZeros(4);
    }

    function resetSlide(slide) {
        slide.querySelectorAll('.seg[data-target]').forEach((seg) => applyState(seg, seg.dataset.initial));
        if (miner && slide.contains(miner)) stopMiner();
        closeHows();
    }

    // ---------- Заметки докладчика ----------
    // Текст лежит в самом слайде (<aside class="notes">), панель собирается тут:
    // она вне масштабируемой сцены, поэтому читается при любом размере окна.
    // Кнопки на экране нет намеренно — она попадала бы в запись. Клавиша N.
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

    // Слайд меняет deck.js — ловим это по классу active: двигаем шкалу,
    // обновляем заметки, а ушедший слайд возвращаем в исходный вид.
    slides.forEach((slide) => {
        let wasActive = slide.classList.contains('active');
        new MutationObserver(() => {
            const isActive = slide.classList.contains('active');
            if (isActive === wasActive) return;
            wasActive = isActive;
            if (isActive) {
                updateRail(slide);
                if (panel.classList.contains('is-open')) renderNotes();
            } else {
                resetSlide(slide);
            }
        }).observe(slide, { attributes: true, attributeFilter: ['class'] });
    });

    const first = slides.find((s) => s.classList.contains('active'));
    if (first) updateRail(first);
})();
