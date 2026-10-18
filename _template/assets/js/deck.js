// deck.js — движок презентации Книжного клуба.
// Извлечён из _template/index.html: правка поведения дека = правка этого файла.
// Маркеров подстановки здесь быть не должно — только чистый JS.


window.peeledCount = 0;

class Presentation {
    constructor() {
        this.slides = document.querySelectorAll('.slide');
        this.current = 0;
        this.stage = document.getElementById('deckStage');
        this.progressBar = document.getElementById('progressBar');
        
        this.scaleStage();
        window.addEventListener('resize', () => this.scaleStage());
        
        document.addEventListener('keydown', (e) => {
            if(e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); this.next(); }
            if(e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.prev(); }
        });

        this.setupInteractiveBlocks();
        this.setupDiagramTooltips();
        this.setupBeforeAfterSlider();
        this.setupCollapsibleCompose();
        this.setupPillarsAccordion();
        this.setupTakeawaysDrag();
        this.showSlide(0);
    }

    setupCollapsibleCompose() {
        const wrapper = document.querySelector('.col-compose-wrapper');
        const btn = document.querySelector('.collapse-btn');
        
        if (wrapper && btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                wrapper.classList.toggle('collapsed');
            });
        }
    }

    setupBeforeAfterSlider() {
        const rangeInput = document.getElementById('sliderRangeInput');
        const beforeContainer = document.getElementById('sliderBeforeContainer');
        const beforeText = document.getElementById('sliderBeforeText');
        const afterText = document.getElementById('sliderAfterText');
        const handle = document.getElementById('sliderHandle');
        
        if (rangeInput && beforeContainer && handle && beforeText && afterText) {
            const updateSlider = () => {
                const val = rangeInput.value;
                beforeContainer.style.width = `${val}%`;
                handle.style.left = `${val}%`;
                
                // Calculate opacities
                const beforeOpacity = val / 100;
                const afterOpacity = 1 - beforeOpacity;
                beforeText.style.opacity = beforeOpacity;
                afterText.style.opacity = afterOpacity;
                
                // Dynamically update pointer-events so tooltips/links are interactive
                beforeText.style.pointerEvents = beforeOpacity > 0.5 ? 'auto' : 'none';
                afterText.style.pointerEvents = afterOpacity > 0.5 ? 'auto' : 'none';
            };
            rangeInput.addEventListener('input', updateSlider);
            updateSlider(); // Initial run on load
        }
    }

    setupDiagramTooltips() {
        document.querySelectorAll('.build-service-card, .build-controller').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                
                let targetId = '';
                if (card.classList.contains('build-card-frontend')) targetId = 'tooltip-frontend';
                else if (card.classList.contains('build-card-backend')) targetId = 'tooltip-backend';
                else if (card.classList.contains('build-card-db')) targetId = 'tooltip-db';
                else if (card.classList.contains('build-controller')) targetId = 'tooltip-orchestrator';
                
                const targetTooltip = document.getElementById(targetId);
                const isActive = targetTooltip.classList.contains('active');
                
                // Close all tooltips & deactivate cards
                document.querySelectorAll('.build-tooltip').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.build-service-card, .build-controller').forEach(c => c.classList.remove('active-card'));
                
                // Toggle active state
                if (!isActive) {
                    targetTooltip.classList.add('active');
                    card.classList.add('active-card');
                }
            });
        });

        // Close tooltips on click outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.build-tooltip').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.build-service-card, .build-controller').forEach(c => c.classList.remove('active-card'));
        });

        // Prevent closing when clicking inside tooltip
        document.querySelectorAll('.build-tooltip').forEach(tooltip => {
            tooltip.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });

        // Tab switching
        document.querySelectorAll('.tooltip-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const container = tab.closest('.build-tooltip');
                const tabName = tab.getAttribute('data-tab');
                
                container.querySelectorAll('.tooltip-tab').forEach(t => t.classList.remove('active'));
                container.querySelectorAll('.tooltip-tab-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                container.querySelector(`.tooltip-tab-content[data-content="${tabName}"]`).classList.add('active');
            });
        });
    }

    scaleStage() {
        const factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        const x = (window.innerWidth - 1920 * factor) / 2;
        const y = (window.innerHeight - 1080 * factor) / 2;
        this.stage.style.transform = `translate(${x}px, ${y}px) scale(${factor})`;
    }

    showSlide(idx) {
        this.slides[this.current].classList.remove('active');
        this.current = Math.max(0, Math.min(idx, this.slides.length - 1));
        this.slides[this.current].classList.add('active');
        this.progressBar.style.width = `${((this.current + 1) / this.slides.length) * 100}%`;
        
        // Reset Slide 8 peel covers when entering the slide
        if (this.current === 7) {
            document.querySelectorAll('.peel-cover').forEach(c => c.classList.remove('peeled'));
            const card = document.getElementById('mainTakeawayCard');
            if (card) card.classList.remove('revealed');
            window.peeledCount = 0;
        }
    }

    next() { this.showSlide(this.current + 1); }
    prev() { this.showSlide(this.current - 1); }

    setupInteractiveBlocks() {
        document.querySelectorAll('.interactive-block').forEach(block => {
            const targetId = block.getAttribute('data-target');
            const targetPanel = document.getElementById(targetId);
            
            block.querySelectorAll('.code-line').forEach(line => {
                line.addEventListener('click', () => {
                    // Reset active classes inside this block
                    block.querySelectorAll('.code-line').forEach(l => l.classList.remove('active'));
                    line.classList.add('active');
                    
                    const title = line.getAttribute('data-title');
                    const desc = line.getAttribute('data-desc');
                    
                    // Update info panel
                    targetPanel.innerHTML = `
                        <h3>${title}</h3>
                        <p>${desc}</p>
                    `;
                    
                    // Slight animation
                    targetPanel.style.opacity = '0';
                    targetPanel.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        targetPanel.style.transition = 'all 0.3s ease';
                        targetPanel.style.opacity = '1';
                        targetPanel.style.transform = 'translateY(0)';
                    }, 50);
                });
            });
        });
    }

    setupPillarsAccordion() {
        const container = document.querySelector('.pillars-container');
        if (!container) return;
        
        const cards = container.querySelectorAll('.pillar-card');
        
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = card.classList.contains('expanded');
                
                // Reset all cards
                cards.forEach(c => {
                    c.classList.remove('expanded');
                    c.classList.remove('collapsed');
                });
                
                if (!isExpanded) {
                    // Expand clicked card, collapse others
                    card.classList.add('expanded');
                    cards.forEach(c => {
                        if (c !== card) {
                            c.classList.add('collapsed');
                        }
                    });
                }
            });
        });
        
        // Clicking outside container resets all cards
        document.addEventListener('click', () => {
            cards.forEach(c => {
                c.classList.remove('expanded');
                c.classList.remove('collapsed');
            });
        });
    }

    setupTakeawaysDrag() {
        const container = document.querySelector('.peel-container');
        if (!container) return;
        
        const covers = container.querySelectorAll('.peel-cover');
        
        covers.forEach(cover => {
            const fold = cover.querySelector('.peel-fold');
            if (!fold) return;
            
            let startX = 0;
            let startY = 0;
            let isDragging = false;
            
            const onMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (e.type === 'mousedown' && e.button !== 0) return;
                
                isDragging = true;
                
                const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
                const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
                
                startX = clientX;
                startY = clientY;
                
                cover.style.transition = 'none';
                fold.style.cursor = 'grabbing';
                document.body.style.cursor = 'grabbing';
                
                const onMouseMove = (moveEvent) => {
                    if (!isDragging) return;
                    
                    const moveX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
                    const moveY = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientY : moveEvent.clientY;
                    
                    const dx = moveX - startX;
                    const dy = moveY - startY;
                    
                    const activeX = Math.max(0, dx);
                    const activeY = Math.max(0, dy);
                    
                    if (activeX > 0 || activeY > 0) {
                        // 3D rotate around axis (1, -1, 0)
                        const angle = Math.min(115, activeX / 1.5);
                        cover.style.transform = `rotate3d(1, -1, 0, ${angle}deg) translate(${activeX * 0.3}px, -${activeY * 0.3}px) scale(${Math.max(0.2, 1 - activeX / 600)})`;
                        cover.style.opacity = `${Math.max(0.1, 1 - activeX / 500)}`;
                    }
                };
                
                const onMouseUp = (upEvent) => {
                    isDragging = false;
                    fold.style.cursor = 'grab';
                    document.body.style.cursor = '';
                    
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.removeEventListener('touchmove', onMouseMove);
                    document.removeEventListener('touchend', onMouseUp);
                    
                    const clientXEnd = upEvent.type === 'touchend' ? upEvent.changedTouches[0].clientX : upEvent.clientX;
                    const dx = clientXEnd - startX;
                    
                    if (dx > 120) {
                        // Reset inline styles so CSS .peeled classes take effect
                        cover.style.transform = '';
                        cover.style.opacity = '';
                        cover.style.transition = '';
                        cover.classList.add('peeled');
                        
                        window.peeledCount++;
                        if (window.peeledCount === 5) {
                            const card = document.getElementById('mainTakeawayCard');
                            if (card) {
                                setTimeout(() => {
                                    card.classList.add('revealed');
                                }, 400);
                            }
                        }
                    } else {
                        cover.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
                        cover.style.transform = '';
                        cover.style.opacity = '';
                    }
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                document.addEventListener('touchmove', onMouseMove, { passive: false });
                document.addEventListener('touchend', onMouseUp);
            };
            
            fold.addEventListener('mousedown', onMouseDown);
            fold.addEventListener('touchstart', onMouseDown, { passive: false });
        });
    }
}

// ===== Тема дека =====
// По умолчанию дек тёмный — его таким и задумывали для проектора. Выбор
// человека запоминается в localStorage и восстанавливается ещё до отрисовки
// (инлайновый скрипт в <head>), поэтому здесь остаётся только переключение.
const THEME_KEY = 'bc-deck-theme';

function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');

    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.setAttribute('aria-checked', String(theme === 'light'));
    btn.title = theme === 'light' ? 'Тёмная тема (T)' : 'Светлая тема (T)';
}

function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    // Кросс-фейд средствами браузера: дек не перерисовывается по кадрам,
    // а там, где View Transitions нет, тема просто переключается сразу.
    if (document.startViewTransition) document.startViewTransition(() => applyTheme(theme));
    else applyTheme(theme);
}

function setupTheme() {
    applyTheme(currentTheme());
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => setTheme(currentTheme() === 'light' ? 'dark' : 'light'));
    // Клавиша T по физической раскладке: работает и в русской (там это «е»).
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyT' || e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        setTheme(currentTheme() === 'light' ? 'dark' : 'light');
    });
}

setupTheme();

new Presentation();

// ===== Слайды нового стиля (класс fx) =====
// Порядок появления блоков (data-rv), счётчики (data-count), ряды «ячеек»
// (data-cells), облако частиц (data-particles), прорисовка SVG (data-draw),
// HUD-строка с номером слайда и панель заметок докладчика (клавиша N).
// Анимации описаны в deck.css и привязаны к .slide.active; без этого блока
// слайды показываются целиком, просто без задержек.
(function () {
  const slides = [...document.querySelectorAll('.slide')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Ячейки: токены, точки, частицы ----------
  // data-cells="72" — строка из 72 «токенов»; у каждого свой --i, чтобы
  // CSS выкладывал их по одному.
  document.querySelectorAll('[data-cells]').forEach((box) => {
    const n = parseInt(box.dataset.cells, 10) || 0;
    box.innerHTML = Array.from({ length: n }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  });
  // Номер по порядку для любых повторяющихся элементов (точки, токены).
  document.querySelectorAll('[data-seq]').forEach((box) => {
    [...box.children].forEach((el, i) => el.style.setProperty('--i', i));
  });

  // Облако частиц «Шоггота»: детерминированный генератор, чтобы картинка
  // не менялась от загрузки к загрузке.
  document.querySelectorAll('[data-particles]').forEach((g) => {
    const [cx, cy, r, count] = g.dataset.particles.split(',').map(Number);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ns = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * r;
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('class', 'p');
      c.setAttribute('cx', (cx + Math.cos(a) * d * 1.08).toFixed(1));
      c.setAttribute('cy', (cy + Math.sin(a) * d * 0.92).toFixed(1));
      c.setAttribute('r', (1.5 + rnd() * 3.5).toFixed(1));
      c.style.setProperty('--i', i);
      c.style.setProperty('--dx', `${(rnd() * 16 - 8).toFixed(1)}px`);
      c.style.setProperty('--dy', `${(rnd() * 16 - 8).toFixed(1)}px`);
      c.style.setProperty('--t', `${(3.5 + rnd() * 4).toFixed(1)}s`);
      c.style.opacity = (0.25 + rnd() * 0.6).toFixed(2);
      g.appendChild(c);
    }
  });

  // Длина линий для «прорисовки» SVG-путей.
  document.querySelectorAll('svg [data-draw]').forEach((p, k) => {
    const len = Math.ceil(p.getTotalLength ? p.getTotalLength() : 400);
    p.style.setProperty('--len', len);
    p.style.strokeDasharray = len;
    p.style.setProperty('--k', k);
  });

  // ---------- Появление блоков ----------
  // Анимация — в talk.css (привязана к .slide.active). Здесь только задержки
  // в порядке чтения; шаг сжимается, если блоков много, чтобы слайд
  // собирался примерно за полторы секунды.
  slides.forEach((slide) => {
    const items = [...slide.querySelectorAll('[data-rv]')];
    const step = Math.max(60, Math.min(140, 1500 / Math.max(items.length, 1)));
    items.forEach((el, i) => el.style.setProperty('--d', `${Math.round(180 + i * step)}ms`));
  });

  // ---------- HUD-строка ----------
  // Внизу каждого слайда нового стиля (кроме титула): книга, глава и тема
  // слева, номер справа. Подпись пишет генератор в <body data-hud>.
  const [topic, book] = document.title.split(' — ');
  const hudLabel = document.body.dataset.hud || [book, topic].filter(Boolean).join(' · ');
  slides.forEach((slide, i) => {
    if (!slide.classList.contains('fx') || slide.classList.contains('is-title')) return;
    const hud = document.createElement('div');
    hud.className = 'fx-hud';
    hud.setAttribute('aria-hidden', 'true');
    const pad = (n) => String(n).padStart(2, '0');
    hud.innerHTML = `<span>${hudLabel}</span>` +
      `<span class="pg"><b>${pad(i + 1)}</b> / ${pad(slides.length)}</span>`;
    slide.appendChild(hud);
  });

  // ---------- Счётчики ----------
  // Число «набегает» от нуля, когда слайд открыт. Итоговый текст лежит
  // в разметке — к нему возвращаемся при уходе со слайда, и он же остаётся,
  // если анимации отключены. data-count — значение, data-dec — знаков после
  // запятой; тысячи разделяются узким пробелом, как в итоговом тексте.
  const timers = new WeakMap();
  const finals = new WeakMap();
  const fmt = (v, dec) => {
    const s = v.toFixed(dec).replace('.', ',');
    const [int, frac] = s.split(',');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return frac ? `${grouped},${frac}` : grouped;
  };

  document.querySelectorAll('[data-count]').forEach((el) => {
    el.dataset.final = el.innerHTML;
  });

  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || '0', 10);
    const holder = el.closest('[data-rv]') || el;
    const delay = (parseFloat(getComputedStyle(holder).getPropertyValue('--d')) || 300) + 150;
    const duration = 1400;
    const suffix = el.dataset.suffix || '';
    el.textContent = fmt(0, dec) + suffix;
    const startAt = performance.now() + delay;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - startAt) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased, dec) + suffix;
      if (p < 1) timers.set(el, requestAnimationFrame(tick));
      else el.innerHTML = el.dataset.final;
    };
    timers.set(el, requestAnimationFrame(tick));
    // Кадры браузер выдаёт только видимой вкладке — если слайд открыли
    // в фоне, число не должно застрять на нуле.
    finals.set(el, setTimeout(() => { el.innerHTML = el.dataset.final; }, delay + duration + 400));
  }

  function startCounters(slide) {
    if (reduceMotion) return;
    slide.querySelectorAll('[data-count]').forEach(runCounter);
  }

  function stopCounters(slide) {
    slide.querySelectorAll('[data-count]').forEach((el) => {
      cancelAnimationFrame(timers.get(el));
      clearTimeout(finals.get(el));
      el.innerHTML = el.dataset.final;
    });
  }

  // ---------- Заметки докладчика ----------
  // Текст доклада лежит в самом слайде (<aside class="notes">), панель
  // собирается здесь и открывается клавишей N. Кнопки на экране нет
  // намеренно: она попадала бы в запись.
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
    // Латинская N и русская Т — одна клавиша при любой раскладке.
    if (e.code === 'KeyN' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setNotesOpen(!panel.classList.contains('is-open'));
    }
    if (e.key === 'Escape') setNotesOpen(false);
  });

  // Слайд меняет deck.js — ловим это по классу active.
  slides.forEach((slide) => {
    let wasActive = slide.classList.contains('active');
    if (wasActive) startCounters(slide);
    new MutationObserver(() => {
      const isActive = slide.classList.contains('active');
      if (isActive === wasActive) return;
      wasActive = isActive;
      if (isActive) {
        if (panel.classList.contains('is-open')) renderNotes();
        startCounters(slide);
      } else {
        stopCounters(slide);
      }
    }).observe(slide, { attributes: true, attributeFilter: ['class'] });
  });
})();
