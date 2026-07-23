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

new Presentation();
