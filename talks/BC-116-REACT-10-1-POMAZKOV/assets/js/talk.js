/*
 * talk.js — поведение контентных слайдов ЭТОГО доклада («Vue.js», глава 10).
 * Общий движок дека (клавиатура, масштаб, кликабельные строки кода) — в deck.js
 * и правится только в шаблоне. Здесь — демонстрации реактивности: каждая
 * инициализируется отдельно и молча выходит, если её слайда в деке нет.
 */

(function () {
    'use strict';

    /** Коротко подсвечивает элемент: класс снимается по окончании анимации. */
    function flash(el, cls, ms) {
        if (!el) return;
        el.classList.remove(cls);
        // Перезапуск анимации: без чтения offsetWidth браузер склеит снятие
        // и повторную установку класса в один кадр, и вспышки не будет.
        void el.offsetWidth;
        el.classList.add(cls);
        setTimeout(function () {
            el.classList.remove(cls);
        }, ms || 700);
    }

    /* ===== Слайд «Что такое реактивность»: электронная таблица =====
       A1 меняется кнопками, формулы пересчитываются каскадом: B3 зависит
       от B1 и B2, поэтому вспышки идут по цепочке, а не все сразу. */
    function initSheet() {
        var root = document.getElementById('sheetDemo');
        if (!root) return;

        var a1 = 2;
        var A2 = 5;
        var cells = {
            a1: root.querySelector('[data-cell="a1"]'),
            b1: root.querySelector('[data-cell="b1"]'),
            b2: root.querySelector('[data-cell="b2"]'),
            b3: root.querySelector('[data-cell="b3"]')
        };

        function recalc() {
            var b1 = a1 * 10;
            var b2 = a1 + A2;
            cells.a1.textContent = a1;
            cells.b1.textContent = b1;
            cells.b2.textContent = b2;
            cells.b3.textContent = b1 + b2;

            // Порядок вспышек — порядок пересчёта: сначала прямые зависимости,
            // затем формула, которая зависит от них.
            flash(root.querySelector('[data-formula="b1"]'), 'is-recalc', 600);
            flash(root.querySelector('[data-formula="b2"]'), 'is-recalc', 600);
            setTimeout(function () {
                flash(root.querySelector('[data-formula="b3"]'), 'is-recalc', 600);
            }, 180);
        }

        root.querySelectorAll('.sheet-step').forEach(function (btn) {
            btn.addEventListener('click', function () {
                a1 = Math.max(0, a1 + Number(btn.dataset.step));
                recalc();
            });
        });
    }

    /* ===== Слайд «Как реактивность решает React»: код и цикл обновления =====
       Два способа пройти цикл. Кнопка «Клик» прогоняет все четыре шага сама;
       клик по строке кода (или по шагу) останавливает прогон и показывает
       ровно эту пару «строка ↔ шаг» — так можно разбирать цикл в своём темпе.

       Шаг ищется по номеру, а не по позиции: порядок цикла (клик → перерендер
       → сверка → патч) не совпадает с порядком строк в файле. */
    function initReactCycle() {
        var root = document.getElementById('reactCycle');
        if (!root) return;

        // Нулевой шаг — сам компонент, в прогоне цикла он не участвует.
        var steps = root.querySelectorAll('.cycle-step[data-step]');
        var codeLines = root.querySelectorAll('.cyc-line');
        var component = root.querySelector('[data-role="component"]');
        var value = root.querySelector('[data-role="count"]');
        var button = root.querySelector('[data-role="click"]');
        var count = 0;
        var timers = [];
        var running = false;

        function clear() {
            timers.forEach(clearTimeout);
            timers = [];
            running = false;
            steps.forEach(function (s) {
                s.classList.remove('is-on', 'is-done');
            });
            codeLines.forEach(function (l) {
                l.classList.remove('is-on');
            });
        }

        // Подсветить пару «шаг ↔ строка» по номеру шага.
        function highlight(no) {
            steps.forEach(function (s) {
                s.classList.toggle('is-on', s.dataset.step === no);
            });
            codeLines.forEach(function (l) {
                l.classList.toggle('is-on', l.dataset.cycle === no);
            });
        }

        function pick(no) {
            clear();
            highlight(no);
        }

        codeLines.forEach(function (line) {
            line.addEventListener('click', function () {
                pick(line.dataset.cycle);
            });
        });
        steps.forEach(function (step) {
            step.addEventListener('click', function () {
                pick(step.dataset.step);
            });
        });

        button.addEventListener('click', function () {
            if (running) return;
            clear();
            running = true;

            steps.forEach(function (step, i) {
                timers.push(
                    setTimeout(function () {
                        steps.forEach(function (s) {
                            if (s.classList.contains('is-on')) {
                                s.classList.remove('is-on');
                                s.classList.add('is-done');
                            }
                        });
                        highlight(step.dataset.step);

                        // Шаг 2 — перерендер: тело функции выполняется заново.
                        if (i === 1) flash(component, 'is-rerender', 600);
                        // Шаг 4 — в DOM уходит одна цифра.
                        if (i === 3) value.textContent = ++count;
                    }, i * 700)
                );
            });

            timers.push(
                setTimeout(function () {
                    running = false;
                }, steps.length * 700)
            );
        });
    }

    // Иконка «наручников» — та же разметка, что у свойств в HTML.
    var CUFF =
        '<span class="cuff" aria-hidden="true"><svg viewBox="0 0 24 24">' +
        '<rect x="5" y="11" width="14" height="9" rx="2"></rect>' +
        '<path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg></span>';

    /* ===== Слайд «Vue 2: где ломается» =====
       Каждая из трёх проблем — кнопка: слева видно, что стало с объектом,
       и что об этом думает Vue. Две из трёх лечатся обёрткой Vue.set(),
       третья не лечится вовсе — это цена самого подхода, а не ошибка.

       Состояние всегда пересобирается из BASE: проблемы разбираются в любом
       порядке, и предыдущая не оставляет следов в следующей. */
    var VUE2_BASE = [
        { key: 'count', value: '0', tracked: true },
        { key: 'title', value: "'Vue'", tracked: true },
        { key: 'arr', value: '[1, 2]', tracked: true }
    ];

    var VUE2_PAINS = {
        add: {
            props: VUE2_BASE.concat([
                { key: 'price', value: '100', tracked: false, state: 'без геттера и сеттера' }
            ]),
            log: 'Свойство в объекте есть, но Vue о нём не знает: шаблон не обновится.',
            tone: 'no',
            fix: {
                label: "Vue.set(data, 'price', 100)",
                props: VUE2_BASE.concat([{ key: 'price', value: '100', tracked: true }]),
                log: 'Vue.set() ставит наручники вручную и сам сообщает об изменении — свойство стало реактивным.'
            }
        },
        array: {
            props: [
                VUE2_BASE[0],
                VUE2_BASE[1],
                { key: 'arr', value: '[5, 2]', tracked: false, state: 'элемент изменён молча' }
            ],
            log: 'Значение в массиве поменялось, а сеттер не сработал: у индексов своих наручников нет.',
            tone: 'no',
            fix: {
                label: 'Vue.set(data.arr, 0, 5)',
                props: [VUE2_BASE[0], VUE2_BASE[1], { key: 'arr', value: '[5, 2]', tracked: true }],
                log: 'Vue.set() (или splice) меняет элемент через обёртку — и уведомление уходит.'
            }
        },
        deep: {
            // Вложенные свойства приходят по одному: обход рекурсивный, и его
            // цена — главное, что должно быть видно на этой демонстрации.
            props: VUE2_BASE.concat([
                { key: 'user', value: '{ … }', tracked: true },
                { key: 'user.profile', value: '{ … }', tracked: true, nested: true },
                { key: 'user.profile.name', value: "'Аня'", tracked: true, nested: true },
                { key: 'user.profile.tags', value: '[…]', tracked: true, nested: true }
            ]),
            stagger: 220,
            log: 'Реактивно всё — но Vue обошёл объект рекурсивно и поставил 4 пары геттер/сеттер. На большом состоянии это заметно при старте.',
            tone: 'note',
            fix: null
        }
    };

    var CUFF =
        '<span class="cuff" aria-hidden="true"><svg viewBox="0 0 24 24">' +
        '<rect x="5" y="11" width="14" height="9" rx="2"></rect>' +
        '<path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg></span>';

    function initVue2() {
        var root = document.getElementById('vue2Demo');
        if (!root) return;

        var list = root.querySelector('[data-role="list"]');
        var log = root.querySelector('[data-role="log"]');
        var fixBtn = root.querySelector('[data-role="fix"]');
        var resetBtn = root.querySelector('[data-role="reset"]');
        var cards = root.querySelectorAll('[data-pain]');
        var timers = [];
        var current = null;

        function row(p) {
            return '<div class="prop-row ' + (p.tracked ? 'is-tracked' : 'is-blind') +
                (p.nested ? ' is-nested' : '') + '">' + CUFF +
                '<b>' + p.key + '</b><i>' + p.value + '</i>' +
                '<span class="prop-state">' + (p.state || 'геттер + сеттер') + '</span></div>';
        }

        function render(props, stagger) {
            timers.forEach(clearTimeout);
            timers = [];
            list.innerHTML = props.map(row).join('');

            var rows = list.querySelectorAll('.prop-row');
            rows.forEach(function (el, i) {
                // Без задержки — просто вспышка; с задержкой видно, как Vue
                // проходит по свойствам одно за другим.
                var wait = stagger ? i * stagger : i * 60;
                timers.push(setTimeout(function () {
                    flash(el, 'is-hit', 700);
                }, wait));
            });
        }

        // Три тона: ok — обёртка помогла, no — реактивность потеряна,
        // note — всё работает, но за это платят временем старта.
        function say(text, tone) {
            log.textContent = text;
            log.classList.toggle('is-ok', tone === 'ok');
            log.classList.toggle('is-warn', tone === 'no');
            log.classList.toggle('is-note', tone === 'note');
        }

        function reset() {
            current = null;
            cards.forEach(function (c) { c.classList.remove('is-on'); });
            fixBtn.disabled = true;
            fixBtn.textContent = 'Обёртка Vue';
            render(VUE2_BASE);
            log.textContent = 'Vue разметил 3 свойства: у каждого свой геттер и сеттер.';
            log.classList.remove('is-ok', 'is-warn', 'is-note');
        }

        cards.forEach(function (card) {
            card.addEventListener('click', function () {
                var pain = VUE2_PAINS[card.dataset.pain];
                if (!pain) return;
                current = pain;

                cards.forEach(function (c) { c.classList.toggle('is-on', c === card); });
                render(pain.props, pain.stagger);
                say(pain.log, pain.tone);

                fixBtn.disabled = !pain.fix;
                fixBtn.textContent = pain.fix ? pain.fix.label : 'Обёртка здесь не поможет';
            });
        });

        fixBtn.addEventListener('click', function () {
            if (!current || !current.fix) return;
            render(current.fix.props);
            say(current.fix.log, 'ok');
            fixBtn.disabled = true;
        });

        resetBtn.addEventListener('click', reset);
        reset();
    }

    /* ===== Слайд «Proxy перехватывает всё»: Vue 3 против Vue 2 =====
       Обе панели показывают ОДИН и тот же объект после ОДНОЙ и той же операции:
       слева — каким его видит Proxy, справа — каким его видит defineProperty.
       Разница в том, узнал ли фреймворк об изменении, а не в самом объекте,
       поэтому у каждого свойства своя пометка, а не общая на панель.

       Каждая кнопка применяется к исходному состоянию, а не к результату
       предыдущей: иначе после «удалить title» половина операций осталась бы
       без своего свойства и демонстрация ломалась бы. */
    var PROXY_BASE = [
        { key: 'count', value: '0' },
        { key: 'title', value: "'Vue'" },
        { key: 'arr', value: '[1, 2]' }
    ];

    // Пометка свойства: подпись и класс строки. Пустая пометка — свойство
    // в этой операции не участвует.
    var PROXY_MARKS = {
        read: { cls: 'is-read', text: 'прочитано' },
        ok: { cls: 'is-ok', text: 'Vue узнал' },
        no: { cls: 'is-no', text: 'Vue не узнал' }
    };

    var PROXY_OPS = {
        read: {
            props: PROXY_BASE,
            v3: {
                trap: "get(target, 'count')",
                ok: true,
                verdict: 'Чтение записывает зависимость: эффект подписался на count',
                marks: { count: 'read' }
            },
            v2: {
                trap: 'геттер свойства count',
                ok: true,
                verdict: 'То же самое: у count есть свой геттер',
                marks: { count: 'read' }
            }
        },
        write: {
            props: [{ key: 'count', value: '1' }, PROXY_BASE[1], PROXY_BASE[2]],
            v3: {
                trap: "set(target, 'count', 1)",
                ok: true,
                verdict: 'Значение изменилось — обновятся все эффекты, читавшие count',
                marks: { count: 'ok' }
            },
            v2: {
                trap: 'сеттер свойства count',
                ok: true,
                verdict: 'То же самое: сеттер размечен при инициализации',
                marks: { count: 'ok' }
            }
        },
        add: {
            props: PROXY_BASE.concat([{ key: 'newProp', value: "'hi'" }]),
            v3: {
                trap: "set(target, 'newProp', 'hi')",
                ok: true,
                verdict: 'Новое свойство ловит та же ловушка — размечать заранее не нужно',
                marks: { newProp: 'ok' }
            },
            v2: {
                trap: 'ловушки нет',
                ok: false,
                verdict: 'Свойство появилось, но без геттера и сеттера: нужен Vue.set()',
                marks: { newProp: 'no' }
            }
        },
        delete: {
            props: [PROXY_BASE[0], { key: 'title', value: "'Vue'", gone: true }, PROXY_BASE[2]],
            v3: {
                trap: "deleteProperty(target, 'title')",
                ok: true,
                verdict: 'Удаление — своя ловушка: интерфейс узнаёт и об исчезновении',
                marks: { title: 'ok' }
            },
            v2: {
                trap: 'ловушки нет',
                ok: false,
                verdict: 'Об удалении сообщить некому: нужен Vue.delete()',
                marks: { title: 'no' }
            }
        },
        array: {
            props: [PROXY_BASE[0], PROXY_BASE[1], { key: 'arr', value: '[5, 2]' }],
            v3: {
                trap: "set(target.arr, '0', 5)",
                ok: true,
                verdict: 'Прокси массива ловит запись по индексу как обычный set',
                marks: { arr: 'ok' }
            },
            v2: {
                trap: 'ловушки нет',
                ok: false,
                verdict: 'У индексов массива своих сеттеров нет — запись прошла мимо',
                marks: { arr: 'no' }
            }
        }
    };

    function initProxy() {
        var root = document.getElementById('proxyDemo');
        if (!root) return;

        var panels = {};
        root.querySelectorAll('.vs-panel').forEach(function (panel) {
            panels[panel.dataset.side] = {
                el: panel,
                obj: panel.querySelector('[data-role="obj"]'),
                trap: panel.querySelector('[data-role="trap"]'),
                verdict: panel.querySelector('[data-role="verdict"]')
            };
        });

        function renderObject(box, props, marks) {
            var html = '<span class="vs-brace">{</span>';
            props.forEach(function (p) {
                var mark = PROXY_MARKS[marks[p.key]];
                html +=
                    '<span class="vs-prop' +
                    (mark ? ' ' + mark.cls : '') +
                    (p.gone ? ' is-gone' : '') +
                    '"><b>' + p.key + ':</b><i>' + p.value + '</i>' +
                    (mark ? '<em>' + mark.text + '</em>' : '') +
                    '</span>';
            });
            html += '<span class="vs-brace">}</span>';
            box.innerHTML = html;
        }

        function show(side, data, props) {
            var panel = panels[side];
            renderObject(panel.obj, props, data.marks);
            panel.trap.textContent = data.trap;
            panel.trap.classList.toggle('is-none', !data.ok);
            panel.verdict.textContent = data.verdict;
            panel.verdict.classList.toggle('is-ok', data.ok);
            panel.verdict.classList.toggle('is-no', !data.ok);
            flash(panel.el, 'is-hit', 700);
        }

        var buttons = root.querySelectorAll('[data-op]');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var op = PROXY_OPS[btn.dataset.op];
                if (!op) return;

                buttons.forEach(function (b) {
                    b.classList.toggle('is-on', b === btn);
                });

                show('v3', op.v3, op.props);
                show('v2', op.v2, op.props);
            });
        });

        // Стартовое состояние: объект как есть, без пометок и приговоров.
        renderObject(panels.v3.obj, PROXY_BASE, {});
        renderObject(panels.v2.obj, PROXY_BASE, {});
    }

    /* ===== Слайд «Vue 2026 · реактивность»: как изменение идёт по графу =====
       Две фазы, и в них вся суть сигналов. Сначала запись только помечает
       зависимых «может устареть» — это дёшево и не считает ничего. Потом
       кто-то читает значение, и цепочка пересчитывается ровно один раз. */
    function initAlien() {
        var root = document.getElementById('alienDemo');
        if (!root) return;

        var log = root.querySelector('[data-role="log"]');
        var button = root.querySelector('[data-role="run"]');
        var nodes = {};
        root.querySelectorAll('.gnode').forEach(function (n) {
            nodes[n.dataset.node] = n;
        });
        var vals = {};
        root.querySelectorAll('[data-val]').forEach(function (v) {
            vals[v.dataset.val] = v;
        });

        var chain = ['doubled', 'total', 'view'];
        var count = 1;
        var timers = [];

        function clear() {
            timers.forEach(clearTimeout);
            timers = [];
            Object.keys(nodes).forEach(function (k) {
                nodes[k].classList.remove('is-dirty', 'is-fresh');
            });
        }

        function say(text, tone) {
            log.textContent = text;
            log.classList.toggle('is-ok', tone === 'ok');
            log.classList.toggle('is-note', tone === 'note');
        }

        button.addEventListener('click', function () {
            clear();
            button.disabled = true;

            count += 1;
            vals.count.textContent = count;
            flash(nodes.count, 'is-fresh', 2600);

            // Фаза 1 — push: только пометки, ни одного пересчёта.
            chain.forEach(function (key, i) {
                timers.push(setTimeout(function () {
                    nodes[key].classList.add('is-dirty');
                }, 160 + i * 160));
            });
            timers.push(setTimeout(function () {
                say('Запись только пометила зависимых «может устареть». Пересчёта пока не было — это самая дешёвая часть.', 'note');
            }, 200));

            // Фаза 2 — pull: экран читает значение, цепочка считается сверху вниз.
            timers.push(setTimeout(function () {
                say('Экран прочитал total — и только теперь цепочка пересчиталась, каждый узел ровно один раз.', 'ok');
            }, 900));

            chain.forEach(function (key, i) {
                timers.push(setTimeout(function () {
                    nodes[key].classList.remove('is-dirty');
                    nodes[key].classList.add('is-fresh');
                    var next = { doubled: count * 2, total: count * 2 + 10 };
                    var value = key === 'view' ? next.total : next[key];
                    vals[key].textContent = value;
                }, 950 + i * 220));
            });

            timers.push(setTimeout(function () {
                button.disabled = false;
            }, 1700));
        });
    }

    /* ===== Слайд «Vapor Mode»: два пути обновления ===== */
    function initLanes() {
        var root = document.getElementById('vaporLanes');
        if (!root) return;

        var lanes = root.querySelectorAll('.lane');
        var button = root.querySelector('[data-role="run"]');
        var timers = [];

        button.addEventListener('click', function () {
            timers.forEach(clearTimeout);
            timers = [];
            root.querySelectorAll('.lane-step').forEach(function (s) {
                s.classList.remove('is-on');
            });

            // Обе дорожки идут одновременно и в одном темпе: короткая
            // добирается до DOM раньше — в этом вся мысль слайда.
            lanes.forEach(function (lane) {
                lane.querySelectorAll('.lane-step').forEach(function (step, i) {
                    timers.push(
                        setTimeout(function () {
                            step.classList.add('is-on');
                        }, i * 460)
                    );
                });
            });
        });
    }

    /* ===== Дерево компонентов: связи между узлами =====
       CSS-псевдоэлемент рисовал у каждого узла вертикальную чёрточку вверх,
       и на втором уровне она упиралась в пустоту: узлы разъехались по ширине,
       а родитель один. Связи считаем по data-parent и рисуем ломаной в SVG —
       так они попадают ровно из центра родителя в центр ребёнка.

       Координаты берём из getBoundingClientRect и делим на масштаб сцены:
       #deckStage сжимает весь дек одним transform: scale(), а viewBox у SVG
       живёт в несжатых пикселях макета. */
    function stageScale() {
        var stage = document.getElementById('deckStage');
        if (!stage) return 1;
        var m = new DOMMatrixReadOnly(getComputedStyle(stage).transform);
        return m.a || 1;
    }

    function drawTreeWires(tree) {
        var nodes = tree.querySelectorAll('.tree-node[data-parent]');
        if (!nodes.length) return;

        var k = stageScale();
        var base = tree.getBoundingClientRect();
        var at = function (el) {
            var r = el.getBoundingClientRect();
            return {
                cx: (r.left + r.width / 2 - base.left) / k,
                top: (r.top - base.top) / k,
                bottom: (r.bottom - base.top) / k
            };
        };

        var d = '';
        nodes.forEach(function (node) {
            var parent = tree.querySelector('.tree-node[data-node="' + node.dataset.parent + '"]');
            if (!parent) return;
            var p = at(parent);
            var c = at(node);
            var mid = (p.bottom + c.top) / 2;
            d += 'M' + p.cx + ' ' + p.bottom + 'V' + mid + 'H' + c.cx + 'V' + c.top + ' ';
        });

        var ns = 'http://www.w3.org/2000/svg';
        var svg = tree.querySelector('.tree-wires') || document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'tree-wires');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('viewBox', '0 0 ' + base.width / k + ' ' + base.height / k);
        svg.innerHTML = '<path d="' + d + '"></path>';
        if (!svg.parentNode) tree.insertBefore(svg, tree.firstChild);
    }

    function initTreeWires() {
        document.querySelectorAll('.tree').forEach(drawTreeWires);
    }

    /* ===== Слайды про Angular: как обновляется интерфейс =====
       Обе демонстрации устроены одинаково: четыре шага справа, строки кода
       слева и дерево компонентов под шагами. Кнопка прогоняет шаги по порядку,
       клик по строке или по шагу показывает одну ступень — как на слайде
       про цикл React.

       Разница только в третьем шаге: Zone.js гонит проверку по всем узлам,
       сигналы — по одному помеченному. */
    function initChangeDetection(id, mode) {
        var root = document.getElementById(id);
        if (!root) return;

        var steps = root.querySelectorAll('.cd-step');
        var lines = root.querySelectorAll('.code-line[data-cd]');
        var tree = root.querySelector('[data-role="tree"]');
        var log = root.querySelector('[data-role="log"]');
        var button = root.querySelector('[data-role="run"]');
        var nodes = Array.prototype.slice.call(tree.querySelectorAll('.tree-node'));
        var timers = [];

        // Zone.js проверяет все узлы, сигналы — только тот, который читает сигнал.
        var walk = mode === 'zone'
            ? nodes
            : nodes.filter(function (n) { return n.classList.contains('is-target'); });

        var done = mode === 'zone'
            ? 'Проверено ' + nodes.length + ' компонентов из ' + nodes.length + ' — а изменился один'
            : 'Обновлён 1 компонент из ' + nodes.length + ' — тот, который читает сигнал';

        function clear() {
            timers.forEach(clearTimeout);
            timers = [];
            steps.forEach(function (s) { s.classList.remove('is-on', 'is-done'); });
            lines.forEach(function (l) { l.classList.remove('is-cd'); });
            nodes.forEach(function (n) { n.classList.remove('is-check'); });
        }

        function highlight(no) {
            steps.forEach(function (s) { s.classList.toggle('is-on', s.dataset.step === no); });
            lines.forEach(function (l) { l.classList.toggle('is-cd', l.dataset.cd === no); });
        }

        function pick(no) {
            clear();
            highlight(no);
        }

        lines.forEach(function (line) {
            line.addEventListener('click', function () { pick(line.dataset.cd); });
        });
        steps.forEach(function (step) {
            step.addEventListener('click', function () { pick(step.dataset.step); });
        });

        button.addEventListener('click', function () {
            clear();

            steps.forEach(function (step, i) {
                timers.push(setTimeout(function () {
                    steps.forEach(function (s) {
                        if (s.classList.contains('is-on')) {
                            s.classList.remove('is-on');
                            s.classList.add('is-done');
                        }
                    });
                    highlight(step.dataset.step);

                    // Третий шаг — сам обход: узлы загораются по очереди.
                    if (i === 2) {
                        walk.forEach(function (node, j) {
                            timers.push(setTimeout(function () {
                                node.classList.add('is-check');
                            }, j * 110));
                        });
                    }
                }, i * 900));
            });

            timers.push(setTimeout(function () {
                log.textContent = done;
                log.classList.toggle('is-warn', mode === 'zone');
                log.classList.toggle('is-ok', mode !== 'zone');
            }, 4 * 900));
        });
    }

    /* ===== Слайд «Svelte 4: как работает $:» — сборка на глазах =====
       Справа стоит результат компиляции, но его не видно, пока не нажмёшь
       «Скомпилировать»: смысл слайда в том, что этот код появляется на этапе
       сборки, а не пишется руками. Куски результата привязаны к строкам
       исходника через data-out — видно, что из чего получилось. */
    var COMPILE_STEPS = [
        'Компилятор читает файл: обычные let переезжают как есть',
        'Нашёл присваивание count += 1 — дописал рядом вызов $$invalidate',
        'Нашёл $: — собрал список его зависимостей и превратил в блок update',
        'Связал выражения шаблона с текстовыми узлами. Готово: рантайма-наблюдателя нет'
    ];

    function initSvelteCompile() {
        var root = document.getElementById('svelteCompile');
        if (!root) return;

        var outs = root.querySelectorAll('.out-line');
        var lines = root.querySelectorAll('.code-line[data-out]');
        var log = root.querySelector('[data-role="log"]');
        var button = root.querySelector('[data-role="run"]');
        var timers = [];

        function pair(no) {
            outs.forEach(function (o) { o.classList.toggle('is-lit', o.dataset.out === no); });
            lines.forEach(function (l) { l.classList.toggle('is-cd', l.dataset.out === no); });
        }

        // Клик по строке исходника — сразу показать её кусок результата.
        lines.forEach(function (line) {
            line.addEventListener('click', function () {
                timers.forEach(clearTimeout);
                timers = [];
                outs.forEach(function (o) {
                    if (Number(o.dataset.out) <= Number(line.dataset.out)) o.classList.add('is-shown');
                });
                pair(line.dataset.out);
                log.textContent = COMPILE_STEPS[Number(line.dataset.out) - 1];
                log.classList.add('is-ok');
            });
        });

        button.addEventListener('click', function () {
            timers.forEach(clearTimeout);
            timers = [];
            outs.forEach(function (o) { o.classList.remove('is-shown', 'is-lit'); });
            lines.forEach(function (l) { l.classList.remove('is-cd'); });
            log.classList.remove('is-ok');
            button.disabled = true;

            outs.forEach(function (out, i) {
                timers.push(setTimeout(function () {
                    out.classList.add('is-shown');
                    pair(out.dataset.out);
                    log.textContent = COMPILE_STEPS[i];
                    log.classList.add('is-ok');
                    if (i === outs.length - 1) button.disabled = false;
                }, 250 + i * 900));
            });
        });
    }

    /* ===== Слайд «Svelte 4: где ломается $:» =====
       Кнопка не просто рвёт стрелку — она подменяет сам листинг: слева видно,
       что код физически уехал в обычный .js, и дописывать $$invalidate стало
       некуда. Без этого «связь потеряна» выглядит произволом. */
    function initSvelte4() {
        var root = document.getElementById('svelte4Demo');
        if (!root) return;

        var arrow = root.querySelector('[data-role="arrow"]');
        var label = root.querySelector('[data-role="arrow-label"]');
        var log = root.querySelector('[data-role="log"]');
        var button = root.querySelector('[data-role="toggle"]');
        var views = {};
        root.querySelectorAll('[data-view]').forEach(function (v) {
            views[v.dataset.view] = v;
        });
        var broken = false;

        button.addEventListener('click', function () {
            broken = !broken;
            arrow.classList.toggle('is-broken', broken);
            views.inline.hidden = broken;
            views.moved.hidden = !broken;

            if (broken) {
                label.textContent = 'зависимость потеряна';
                button.textContent = 'Вернуть в компонент';
                log.innerHTML =
                    'Присваивание уехало в <em>utils.js</em>. Компилятор Svelte туда не заглядывает — <em>$$invalidate</em> не дописан, <em>doubleCount</em> не пересчитывается';
                log.classList.add('is-warn');
                log.classList.remove('is-ok');
            } else {
                label.textContent = 'отслеживается';
                button.textContent = 'Вынести в файл';
                log.innerHTML =
                    'Код в <em>.svelte</em>: компилятор видит присваивание и связывает его с <em>$:</em>';
                log.classList.add('is-ok');
                log.classList.remove('is-warn');
            }
        });
    }

    /* ===== Слайд «Svelte 5: руны» =====
       Тот же сценарий, что ломал $: — но связь держится, потому что зависимость
       собирается во время выполнения. Кнопка меняет только подпись: рвать
       тут нечего, и это единственное, что нужно увидеть. */
    function initRunes() {
        var root = document.getElementById('runesDemo');
        if (!root) return;

        var chain = document.getElementById('runesChain');
        var label = chain.querySelector('[data-role="arrow-label"]');
        var log = chain.querySelector('[data-role="log"]');
        var button = chain.querySelector('[data-role="toggle"]');
        var lines = root.querySelectorAll('.code-line[data-rune]');
        var runes = root.querySelectorAll('.rune');
        var moved = false;

        // Кнопка руны и строка кода — одна и та же мысль с двух сторон.
        function pick(name) {
            lines.forEach(function (l) { l.classList.toggle('is-cd', l.dataset.rune === name); });
            runes.forEach(function (r) { r.classList.toggle('is-on', r.dataset.rune === name); });
        }
        runes.forEach(function (r) {
            r.addEventListener('click', function () {
                pick(r.dataset.rune);
                // Показываем то же пояснение, что и у строки кода.
                var line = root.querySelector('.code-line[data-rune="' + r.dataset.rune + '"]');
                if (line) line.click();
            });
        });
        lines.forEach(function (l) {
            l.addEventListener('click', function () { pick(l.dataset.rune); });
        });

        button.addEventListener('click', function () {
            moved = !moved;
            button.textContent = moved ? 'Вернуть в компонент' : 'Вынести в файл';
            label.textContent = 'отслеживается';
            log.innerHTML = moved
                ? 'Состояние теперь в <em>counter.svelte.ts</em> — и связь жива: зависимость собралась при чтении, а не при сборке'
                : 'Тот же сценарий, что ломал <em>$:</em> — здесь связь остаётся';
            flash(chain.querySelector('[data-role="chain"]'), 'is-hit', 700);
        });
    }

    /* ===== Слайд про Solid: крупно- против мелкозернистых обновлений ===== */
    function initGrain() {
        var root = document.getElementById('grainDemo');
        if (!root) return;

        root.querySelectorAll('.grain-panel').forEach(function (panel) {
            var isSolid = panel.classList.contains('is-solid');
            var box = panel.querySelector('[data-role="box"]');
            var count = panel.querySelector('[data-role="count"]');
            var doubled = panel.querySelector('[data-role="doubled"]');
            var value = 0;

            panel.querySelector('[data-role="run"]').addEventListener('click', function () {
                value++;
                count.textContent = value;
                doubled.textContent = value * 2;

                if (isSolid) {
                    // Мелкозернисто: вспыхивают только те узлы, что читают сигнал.
                    flash(count, 'is-run', 600);
                    flash(doubled, 'is-run', 600);
                } else {
                    // Крупнозернисто: перерендер всего компонента.
                    flash(box, 'is-run', 600);
                }
            });
        });
    }

    /* ===== Слайд про Qwik: таймлайн загрузки =====
       Дорожки стартуют вместе, но у React каждый шаг стоит времени, поэтому
       «интерактивно» у него загорается заметно позже. */
    function initBoot() {
        var root = document.getElementById('bootDemo');
        if (!root) return;

        var log = root.querySelector('[data-role="log"]');
        var button = root.querySelector('[data-role="run"]');
        var timers = [];

        var PACE = { react: 780, qwik: 420 };

        button.addEventListener('click', function () {
            timers.forEach(clearTimeout);
            timers = [];
            root.querySelectorAll('.boot-step').forEach(function (s) {
                s.classList.remove('is-on');
            });
            root.querySelectorAll('[data-role="wait"]').forEach(function (w) {
                w.classList.remove('is-shown');
            });

            root.querySelectorAll('.boot-track').forEach(function (track) {
                var pace = PACE[track.dataset.track] || 600;
                var steps = track.querySelectorAll('.boot-step');
                var wait = track.querySelector('[data-role="wait"]');

                steps.forEach(function (step, i) {
                    // Последний шаг Qwik — ленивая загрузка по клику: он
                    // загорается после «интерактивно», а не до.
                    timers.push(
                        setTimeout(function () {
                            step.classList.add('is-on');
                            if (step.classList.contains('is-goal')) wait.classList.add('is-shown');
                        }, (i + 1) * pace)
                    );
                });
            });

            timers.push(
                setTimeout(function () {
                    log.innerHTML =
                        'Qwik интерактивен, пока React ещё гидратируется: время до интерактивности <b>не зависит</b> от размера приложения';
                    log.classList.add('is-ok');
                }, 4 * PACE.react + 200)
            );
        });
    }

    function init() {
        initSheet();
        initReactCycle();
        initVue2();
        initProxy();
        initAlien();
        initLanes();
        initChangeDetection('zoneCd', 'zone');
        initChangeDetection('signalCd', 'signal');
        initTreeWires();
        initSvelteCompile();
        initSvelte4();
        initRunes();
        initGrain();
        initBoot();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
