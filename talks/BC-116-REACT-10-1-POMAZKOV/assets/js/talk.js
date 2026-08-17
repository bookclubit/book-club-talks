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

    /* ===== Слайд «Суть реактивного программирования»: каскад ===== */
    function initCascade() {
        var root = document.getElementById('cascadeDemo');
        if (!root) return;

        var count = 3;
        var out = {
            count: root.querySelectorAll('[data-cascade="count"]'),
            doubled: root.querySelector('[data-cascade="doubled"]'),
            bar: root.querySelector('[data-cascade="bar"]')
        };

        function render() {
            out.count.forEach(function (node) {
                node.textContent = count;
            });
            out.doubled.textContent = count * 2;
            out.bar.style.width = Math.min(100, count * 10) + '%';

            root.classList.add('is-live');
            root.querySelectorAll('.cascade-dep').forEach(function (dep, i) {
                setTimeout(function () {
                    flash(dep, 'is-hit', 700);
                }, i * 90);
            });
            setTimeout(function () {
                root.classList.remove('is-live');
            }, 700);
        }

        root.querySelectorAll('[data-count]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                count = Math.max(0, count + Number(btn.dataset.count));
                render();
            });
        });
    }

    /* ===== Слайд «Как реактивность решает React»: цикл обновления =====
       Шаги подсвечиваются по очереди, на шаге «перерендер» вспыхивает рамка
       всего компонента — единица обновления в React именно компонент. */
    function initReactCycle() {
        var root = document.getElementById('reactCycle');
        if (!root) return;

        var steps = root.querySelectorAll('.cycle-step');
        var component = root.querySelector('[data-role="component"]');
        var value = root.querySelector('[data-role="count"]');
        var button = root.querySelector('[data-role="click"]');
        var count = 0;
        var timers = [];
        var running = false;

        function reset() {
            timers.forEach(clearTimeout);
            timers = [];
            steps.forEach(function (s) {
                s.classList.remove('is-on', 'is-done');
            });
        }

        button.addEventListener('click', function () {
            if (running) return;
            running = true;
            reset();

            steps.forEach(function (step, i) {
                timers.push(
                    setTimeout(function () {
                        steps.forEach(function (s) {
                            if (s.classList.contains('is-on')) {
                                s.classList.remove('is-on');
                                s.classList.add('is-done');
                            }
                        });
                        step.classList.add('is-on');

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

    /* ===== Слайд «Vue 2: где ломается»: наручники геттеров и сеттеров ===== */
    function initVue2() {
        var root = document.getElementById('vue2Demo');
        if (!root) return;

        var list = root.querySelector('[data-role="list"]');
        var log = root.querySelector('[data-role="log"]');
        var addBtn = root.querySelector('[data-role="add"]');
        var extra = 0;
        var names = ['price', 'tags', 'user'];

        addBtn.addEventListener('click', function () {
            if (extra >= names.length) return;
            var row = document.createElement('div');
            row.className = 'prop-row is-blind';
            row.innerHTML =
                CUFF +
                '<b>' + names[extra] + '</b>' +
                '<span class="prop-state">без геттера и сеттера</span>';
            list.appendChild(row);
            extra++;

            log.textContent =
                'Свойство добавлено после инициализации: Vue отслеживает 2 из ' +
                (2 + extra) + '. Нужен Vue.set().';
            log.classList.add('is-warn');
            log.classList.remove('is-ok');

            if (extra >= names.length) addBtn.disabled = true;
        });

        root.querySelector('[data-role="touch"]').addEventListener('click', function () {
            list.querySelectorAll('.prop-row').forEach(function (row, i) {
                setTimeout(function () {
                    flash(row, 'is-hit', 700);
                }, i * 90);
            });

            if (extra === 0) {
                log.textContent = 'Все свойства реактивны: интерфейс обновился.';
                log.classList.add('is-ok');
                log.classList.remove('is-warn');
            } else {
                log.textContent =
                    'Обновилось только то, что размечено при инициализации: ' +
                    extra + ' из ' + (2 + extra) + ' свойств Vue не видит.';
                log.classList.add('is-warn');
                log.classList.remove('is-ok');
            }
        });
    }

    /* ===== Слайд «Proxy перехватывает всё»: ловушки =====
       У каждой операции — своя ловушка и своя приписка о том, умел ли так Vue 2:
       именно в этом разница между defineProperty и Proxy. */
    var PROXY_OPS = {
        read: {
            trap: "get(target, 'count')",
            note: 'Чтение записывает зависимость: эффект, который сейчас выполняется, подписывается на <em>count</em>.',
            vue2: '<span>Vue 2</span> тоже это умел',
            vue2Fail: false
        },
        write: {
            trap: "set(target, 'count', 1)",
            note: 'Значение изменилось — Vue уведомляет все эффекты, которые читали <em>count</em>.',
            vue2: '<span>Vue 2</span> тоже это умел',
            vue2Fail: false
        },
        add: {
            trap: "set(target, 'newProp', 'hi')",
            note: 'Новое свойство перехватывается той же ловушкой: разметка заранее не нужна.',
            vue2: '<span>Vue 2 не видел</span> — требовался Vue.set()',
            vue2Fail: true
        },
        delete: {
            trap: "deleteProperty(target, 'title')",
            note: 'Удаление — отдельная ловушка: интерфейс узнаёт и об исчезновении свойства.',
            vue2: '<span>Vue 2 не видел</span> — требовался Vue.delete()',
            vue2Fail: true
        },
        array: {
            trap: "set(target.arr, '0', 5)",
            note: 'Запись по индексу — обычная операция set у прокси массива. Хаки с методами массива больше не нужны.',
            vue2: '<span>Vue 2 не видел</span> — индексы не имели сеттеров',
            vue2Fail: true
        }
    };

    function initProxy() {
        var root = document.getElementById('proxyDemo');
        if (!root) return;

        var film = root.querySelector('[data-role="film"]');
        var trap = root.querySelector('[data-role="trap"]');
        var note = root.querySelector('[data-role="note"]');
        var vue2 = root.querySelector('[data-role="vue2"]');
        var buttons = root.querySelectorAll('[data-op]');

        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var op = PROXY_OPS[btn.dataset.op];
                if (!op) return;

                buttons.forEach(function (b) {
                    b.classList.toggle('is-on', b === btn);
                });

                trap.textContent = op.trap;
                note.innerHTML = op.note;
                vue2.innerHTML = op.vue2;
                vue2.classList.toggle('is-no', op.vue2Fail);
                flash(film, 'is-hit', 700);
            });
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

    /* ===== Слайды про Angular: обход дерева компонентов =====
       Zone.js проверяет все узлы сверху вниз, сигналы — только путь к одному
       компоненту. Обе демки — один и тот же компонент дерева. */
    function initTree(id, mode) {
        var root = document.getElementById(id);
        if (!root) return;

        var tree = root.querySelector('[data-role="tree"]');
        var log = root.querySelector('[data-role="log"]');
        var button = root.querySelector('[data-role="run"]');
        var nodes = Array.prototype.slice.call(tree.querySelectorAll('.tree-node'));
        var timers = [];

        var order =
            mode === 'zone'
                ? nodes
                : nodes.filter(function (n) {
                      return n.classList.contains('is-target');
                  });

        var done =
            mode === 'zone'
                ? 'Проверено ' + nodes.length + ' компонентов из ' + nodes.length + ' — изменился один'
                : 'Обновлён 1 компонент из ' + nodes.length + ' — тот, который читает сигнал';

        button.addEventListener('click', function () {
            timers.forEach(clearTimeout);
            timers = [];
            nodes.forEach(function (n) {
                n.classList.remove('is-check');
            });

            order.forEach(function (node, i) {
                timers.push(
                    setTimeout(function () {
                        node.classList.add('is-check');
                    }, i * 130)
                );
            });

            timers.push(
                setTimeout(function () {
                    log.textContent = done;
                    log.classList.toggle('is-warn', mode === 'zone');
                    log.classList.toggle('is-ok', mode !== 'zone');
                }, order.length * 130 + 120)
            );
        });
    }

    /* ===== Слайд «Svelte 4: магия $:» — как рвётся связь ===== */
    function initSvelte4() {
        var root = document.getElementById('svelte4Demo');
        if (!root) return;

        var arrow = root.querySelector('[data-role="arrow"]');
        var label = root.querySelector('[data-role="arrow-label"]');
        var log = root.querySelector('[data-role="log"]');
        var button = root.querySelector('[data-role="toggle"]');
        var broken = false;

        button.addEventListener('click', function () {
            broken = !broken;
            arrow.classList.toggle('is-broken', broken);

            if (broken) {
                label.textContent = 'зависимость потеряна';
                button.textContent = 'Вернуть в компонент';
                log.innerHTML =
                    'Функция уехала в <em>utils.js</em>: присваивание есть, но компилятор его не видит — <em>doubleCount</em> больше не пересчитывается';
                log.classList.add('is-warn');
                log.classList.remove('is-ok');
            } else {
                label.textContent = 'отслеживается';
                button.textContent = 'Вынести в файл';
                log.innerHTML =
                    'Код в <em>.svelte</em> — компилятор видит присваивание и связывает его с <em>$:</em>';
                log.classList.add('is-ok');
                log.classList.remove('is-warn');
            }
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
        initCascade();
        initReactCycle();
        initVue2();
        initProxy();
        initLanes();
        initTree('zoneTree', 'zone');
        initTree('signalTree', 'signal');
        initSvelte4();
        initGrain();
        initBoot();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
