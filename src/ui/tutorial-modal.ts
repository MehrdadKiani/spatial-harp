/**
 * 4-Step Interactive Visual Tutorial Modal (Zero UI Framework - Pure TypeScript & Vanilla DOM)
 * Pops up when the user enters from the splash screen, guiding them through:
 * 1. Palm Calibration
 * 2. Pinching & Anchoring Strings
 * 3. Plucking with Index Finger
 * 4. Pro Tip: Live Re-Grabbing & Modulation
 */

export interface TutorialSlide {
  step: number;
  badge: string;
  badgeColor: string;
  title: string;
  imageSrc: string;
  description: string;
  tip?: string;
}

export const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    step: 1,
    badge: 'STEP 1 OF 4 • CALIBRATION',
    badgeColor: '#38ef7d',
    title: 'Calibrate Hand Tracking',
    imageSrc: '/assets/tutorial/step01.gif',
    description: 'Hold your open palm toward the camera for a moment. Once your hands are detected, the system calibrates 21 tracking joint landmarks in real-time 3D space.',
    tip: 'Ensure your hands are within the camera frame with good lighting.',
  },
  {
    step: 2,
    badge: 'STEP 2 OF 4 • CREATE STRINGS',
    badgeColor: '#00f0ff',
    title: 'Pinch & Anchor in Mid-Air',
    imageSrc: '/assets/tutorial/step02.gif',
    description: 'Pinch your thumb and index finger together on both hands. Pull them apart horizontally to stretch an elastic laser string, then release your pinch to lock the string in space.',
    tip: 'Create multiple strings at different angles and lengths to build your custom harp!',
  },
  {
    step: 3,
    badge: 'STEP 3 OF 4 • PLAY MUSIC',
    badgeColor: '#ff007f',
    title: 'Pluck with Your Index Finger',
    imageSrc: '/assets/tutorial/step03.gif',
    description: 'Swipe your index finger across any anchored string to synthesize rich polyphonic notes. Swipe velocity controls volume intensity, and string length dictates the musical pitch.',
    tip: 'Shorter strings produce higher notes; longer strings resonate deeper bass.',
  },
  {
    step: 4,
    badge: 'STEP 4 OF 4 • PRO TIP ⚡',
    badgeColor: '#ffaa00',
    title: 'Pro Tip: Live Re-Grab & Modulate',
    imageSrc: '/assets/tutorial/step04.gif',
    description: 'Pinch either endpoint reticle [⌖] to re-grab and drag an active string in 3D space. You can continuously stretch and modulate pitch with one hand while plucking with the other!',
    tip: 'Switch synthesizers and scales anytime using the 🎹 Sound Studio panel.',
  },
];

export class TutorialModal {
  private overlay: HTMLDivElement;
  private card: HTMLDivElement;
  private imageEl: HTMLImageElement;
  private badgeEl: HTMLSpanElement;
  private titleEl: HTMLHeadingElement;
  private descEl: HTMLParagraphElement;
  private tipEl: HTMLDivElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private dotsContainer: HTMLDivElement;
  private skipBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;

  private currentSlideIndex = 0;
  private isOpen = false;
  private onCloseCallback?: () => void;

  constructor(container: HTMLElement, onClose?: () => void) {
    this.onCloseCallback = onClose;

    // 1. Fullscreen Dark Backdrop
    this.overlay = document.createElement('div');
    this.overlay.id = 'tutorial-modal-overlay';
    Object.assign(this.overlay.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '50',
      background: 'rgba(5, 8, 16, 0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      opacity: '0',
      transition: 'opacity 0.25s ease',
      userSelect: 'none',
      fontFamily: 'var(--font-primary)',
    });

    // 2. Glassmorphic Modal Card
    this.card = document.createElement('div');
    this.card.className = 'tutorial-modal-card';
    Object.assign(this.card.style, {
      background: 'rgba(10, 16, 32, 0.96)',
      border: '1px solid rgba(0, 240, 255, 0.40)',
      borderRadius: '20px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 240, 255, 0.2)',
      width: '100%',
      maxWidth: '620px',
      maxHeight: '92vh',
      overflowY: 'auto',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      transform: 'scale(0.95)',
      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    });

    this.card.innerHTML = `
      <!-- Top Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">📖</span>
          <span style="font-weight: 800; font-size: 13px; letter-spacing: 1.5px; color: #ffffff; text-transform: uppercase;">
            HOW TO PLAY <span style="color: #00f0ff;">• TUTORIAL</span>
          </span>
        </div>
        <button id="tut-close-btn" style="background: transparent; border: none; color: rgba(255, 255, 255, 0.6); font-size: 20px; cursor: pointer; padding: 2px 6px; line-height: 1; border-radius: 4px; transition: color 0.2s;">✕</button>
      </div>

      <!-- Slide Image Showcase Viewport -->
      <div style="
        width: 100%;
        height: 250px;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid rgba(0, 240, 255, 0.3);
        background: #060a14;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <img id="tut-slide-img" src="${TUTORIAL_SLIDES[0].imageSrc}" alt="Tutorial Step" style="height: 100%; width: auto; max-width: 100%; object-fit: contain; display: block; border-radius: 8px; transition: opacity 0.2s ease;" />
      </div>

      <!-- Slide Content -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span id="tut-badge" style="
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            padding: 3px 8px;
            border-radius: 6px;
            background: rgba(56, 239, 125, 0.15);
            color: #38ef7d;
            border: 1px solid rgba(56, 239, 125, 0.35);
          ">${TUTORIAL_SLIDES[0].badge}</span>
          <button id="tut-skip-btn" style="background: transparent; border: none; color: rgba(255, 255, 255, 0.5); font-size: 11px; cursor: pointer; text-decoration: underline; font-family: inherit;">Skip Tutorial</button>
        </div>

        <h3 id="tut-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.8px;">${TUTORIAL_SLIDES[0].title}</h3>
        <p id="tut-desc" style="margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.80); line-height: 1.5;">${TUTORIAL_SLIDES[0].description}</p>
        
        <div id="tut-tip" style="background: rgba(0, 240, 255, 0.08); border-left: 3px solid #00f0ff; padding: 8px 12px; border-radius: 4px; font-size: 11px; color: rgba(0, 240, 255, 0.95); line-height: 1.4;">
          💡 ${TUTORIAL_SLIDES[0].tip}
        </div>
      </div>

      <!-- Navigation & Step Dots Bar -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        <!-- Previous Button -->
        <button id="tut-prev-btn" style="
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.8);
          border-radius: 8px;
          padding: 8px 16px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          opacity: 0.4;
          pointer-events: none;
          transition: all 0.2s;
        ">← Previous</button>

        <!-- Step Dots Indicator -->
        <div id="tut-dots" style="display: flex; gap: 8px; align-items: center;"></div>

        <!-- Next / Finish Button -->
        <button id="tut-next-btn" style="
          background: linear-gradient(135deg, #00f0ff 0%, #00a8ff 100%);
          border: none;
          color: #050b16;
          border-radius: 8px;
          padding: 8px 18px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.5px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0, 240, 255, 0.35);
          transition: all 0.2s;
        ">Next →</button>
      </div>
    `;

    this.overlay.appendChild(this.card);
    container.appendChild(this.overlay);

    // Query elements
    this.imageEl = this.card.querySelector('#tut-slide-img')!;
    this.badgeEl = this.card.querySelector('#tut-badge')!;
    this.titleEl = this.card.querySelector('#tut-title')!;
    this.descEl = this.card.querySelector('#tut-desc')!;
    this.tipEl = this.card.querySelector('#tut-tip')!;
    this.prevBtn = this.card.querySelector('#tut-prev-btn')!;
    this.nextBtn = this.card.querySelector('#tut-next-btn')!;
    this.dotsContainer = this.card.querySelector('#tut-dots')!;
    this.skipBtn = this.card.querySelector('#tut-skip-btn')!;
    this.closeBtn = this.card.querySelector('#tut-close-btn')!;

    // Build Step Dots
    this.renderDots();

    // Event Listeners
    this.prevBtn.addEventListener('click', () => this.previousSlide());
    this.nextBtn.addEventListener('click', () => this.nextSlide());
    this.skipBtn.addEventListener('click', () => this.close());
    this.closeBtn.addEventListener('click', () => this.close());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'ArrowRight') this.nextSlide();
      if (e.key === 'ArrowLeft') this.previousSlide();
      if (e.key === 'Escape') this.close();
    });
  }

  private renderDots(): void {
    this.dotsContainer.innerHTML = '';
    TUTORIAL_SLIDES.forEach((_, idx) => {
      const dot = document.createElement('span');
      const isActive = idx === this.currentSlideIndex;
      Object.assign(dot.style, {
        width: isActive ? '22px' : '8px',
        height: '8px',
        borderRadius: '4px',
        background: isActive ? '#00f0ff' : 'rgba(255, 255, 255, 0.25)',
        boxShadow: isActive ? '0 0 10px #00f0ff' : 'none',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      });
      dot.title = `Go to Step ${idx + 1}`;
      dot.addEventListener('click', () => this.goToSlide(idx));
      this.dotsContainer.appendChild(dot);
    });
  }

  public goToSlide(index: number): void {
    if (index < 0 || index >= TUTORIAL_SLIDES.length) return;
    this.currentSlideIndex = index;
    const slide = TUTORIAL_SLIDES[index];

    // Smooth image crossfade
    this.imageEl.style.opacity = '0.3';
    setTimeout(() => {
      this.imageEl.src = slide.imageSrc;
      this.imageEl.style.opacity = '1';
    }, 120);

    // Update text
    this.badgeEl.textContent = slide.badge;
    this.badgeEl.style.color = slide.badgeColor;
    this.badgeEl.style.borderColor = slide.badgeColor;
    this.badgeEl.style.background = `${slide.badgeColor}22`;

    this.titleEl.textContent = slide.title;
    this.descEl.textContent = slide.description;
    this.tipEl.innerHTML = `💡 ${slide.tip || ''}`;

    // Update Previous Button State
    if (index === 0) {
      this.prevBtn.style.opacity = '0.3';
      this.prevBtn.style.pointerEvents = 'none';
    } else {
      this.prevBtn.style.opacity = '1';
      this.prevBtn.style.pointerEvents = 'auto';
    }

    // Update Next Button (on last slide turns into Start Playing!)
    if (index === TUTORIAL_SLIDES.length - 1) {
      this.nextBtn.textContent = "Start Playing! 🎸";
      this.nextBtn.style.background = 'linear-gradient(135deg, #00ffaa 0%, #00f0ff 100%)';
      this.nextBtn.style.boxShadow = '0 4px 18px rgba(0, 255, 170, 0.5)';
    } else {
      this.nextBtn.textContent = 'Next →';
      this.nextBtn.style.background = 'linear-gradient(135deg, #00f0ff 0%, #00a8ff 100%)';
      this.nextBtn.style.boxShadow = '0 4px 15px rgba(0, 240, 255, 0.35)';
    }

    this.renderDots();
  }

  public nextSlide(): void {
    if (this.currentSlideIndex < TUTORIAL_SLIDES.length - 1) {
      this.goToSlide(this.currentSlideIndex + 1);
    } else {
      // Completed last step!
      this.close();
    }
  }

  public previousSlide(): void {
    if (this.currentSlideIndex > 0) {
      this.goToSlide(this.currentSlideIndex - 1);
    }
  }

  public open(startSlide = 0): void {
    this.isOpen = true;
    this.goToSlide(startSlide);
    this.overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
      this.card.style.transform = 'scale(1)';
    });
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    this.card.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.overlay.style.display = 'none';
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    }, 250);
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
