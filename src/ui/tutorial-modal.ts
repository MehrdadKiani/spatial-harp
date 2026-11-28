/**
 * 4-Step Interactive Visual Tutorial Modal (Zero UI Framework - Pure TypeScript & Vanilla DOM)
 * Uses native <dialog closedby="any"> with @starting-style transitions and Optical Studio chrome.
 */

import { Icons } from './icons';

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
    badge: 'Calibration',
    badgeColor: '#5ef2c2',
    title: 'Calibrate your hands',
    imageSrc: '/assets/tutorial/step01.gif',
    description: 'Show your open palms to the camera to initialize 3D hand tracking.',
    tip: 'Keep your hands inside the frame with even lighting.',
  },
  {
    step: 2,
    badge: 'Create strings',
    badgeColor: '#f4f6fa',
    title: 'Pinch and anchor',
    imageSrc: '/assets/tutorial/step02.gif',
    description: 'Hold pinch steady until it pops, stretch to size, then release to lock the string in air.',
    tip: 'Add multiple strings at different lengths to build a custom harp.',
  },
  {
    step: 3,
    badge: 'Play',
    badgeColor: '#5ef2c2',
    title: 'Swipe to pluck',
    imageSrc: '/assets/tutorial/step03.gif',
    description: 'Swipe a fingertip across any string to play notes. Hand speed controls dynamics.',
    tip: 'In Fretted mode, each string plays 5 notes from left to right.',
  },
  {
    step: 4,
    badge: 'Modulate',
    badgeColor: '#f5a623',
    title: 'Re-grab and tune',
    imageSrc: '/assets/tutorial/step04.gif',
    description: 'Pinch a string endpoint crosshair to move, rotate, or bend pitch live.',
    tip: 'Switch synth patches and effects anytime in Sound Studio.',
  },
];

export class TutorialModal {
  private dialog: HTMLDialogElement;
  private card: HTMLDivElement;
  private headerStepEl: HTMLSpanElement;
  private imageEl: HTMLImageElement;
  private titleEl: HTMLHeadingElement;
  private descEl: HTMLParagraphElement;
  private tipEl: HTMLDivElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private dotsContainer: HTMLDivElement;
  private closeBtn: HTMLButtonElement;

  private currentSlideIndex = 0;
  private onCloseCallback?: () => void;

  constructor(container: HTMLElement, onClose?: () => void) {
    this.onCloseCallback = onClose;

    this.dialog = document.createElement('dialog');
    this.dialog.id = 'tutorial-modal-dialog';
    this.dialog.setAttribute('closedby', 'any');
    this.dialog.setAttribute('aria-labelledby', 'tut-title');

    this.card = document.createElement('div');
    this.card.className = 'tutorial-modal-card';

    this.card.innerHTML = `
      <div class="drawer-header" style="margin-bottom: 0; padding-bottom: 12px;">
        <div class="drawer-title-group">
          ${Icons.book(15)}
          <span class="drawer-title">How to play</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="tut-header-step" class="tutorial-step-pill">1 / ${TUTORIAL_SLIDES.length}</span>
          <button id="tut-close-btn" class="drawer-close-btn" type="button" aria-label="Close tutorial">
            ${Icons.close(16)}
          </button>
        </div>
      </div>

      <div class="tutorial-media-frame">
        <img id="tut-slide-img" src="${TUTORIAL_SLIDES[0].imageSrc}" alt="Tutorial demonstration" />
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <h2 id="tut-title" class="tutorial-title">${TUTORIAL_SLIDES[0].title}</h2>
        <p id="tut-desc" class="tutorial-desc">${TUTORIAL_SLIDES[0].description}</p>
        <div id="tut-tip" class="tutorial-tip">${TUTORIAL_SLIDES[0].tip || ''}</div>
      </div>

      <div class="tutorial-footer">
        <button id="tut-prev-btn" class="btn-secondary" type="button" disabled>
          ${Icons.arrowLeft(14)}
          <span>Previous</span>
        </button>

        <div id="tut-dots" class="tutorial-dots" aria-label="Tutorial steps"></div>

        <button id="tut-next-btn" class="btn-primary" type="button" autofocus>
          <span>Next</span>
          ${Icons.arrowRight(14)}
        </button>
      </div>
    `;

    this.dialog.appendChild(this.card);
    container.appendChild(this.dialog);

    this.headerStepEl = this.card.querySelector('#tut-header-step')!;
    this.imageEl = this.card.querySelector('#tut-slide-img')!;
    this.titleEl = this.card.querySelector('#tut-title')!;
    this.descEl = this.card.querySelector('#tut-desc')!;
    this.tipEl = this.card.querySelector('#tut-tip')!;
    this.prevBtn = this.card.querySelector('#tut-prev-btn')!;
    this.nextBtn = this.card.querySelector('#tut-next-btn')!;
    this.dotsContainer = this.card.querySelector('#tut-dots')!;
    this.closeBtn = this.card.querySelector('#tut-close-btn')!;

    this.renderDots();

    this.prevBtn.addEventListener('click', () => this.previousSlide());
    this.nextBtn.addEventListener('click', () => this.nextSlide());
    this.closeBtn.addEventListener('click', () => this.close());

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e: PointerEvent): boolean => {
        const r = this.dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      this.dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = isOutside(e);
      });
      this.dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && isOutside(e)) {
          this.close();
        }
      });
    }

    this.dialog.addEventListener('close', () => {
      this.dialog.returnValue = '';
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    });

    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.nextSlide();
      if (e.key === 'ArrowLeft') this.previousSlide();
    });
  }

  private renderDots(): void {
    const dots = TUTORIAL_SLIDES.map((_, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'tutorial-dot';
      const isActive = idx === this.currentSlideIndex;
      if (isActive) {
        dot.setAttribute('aria-current', 'step');
      }
      dot.setAttribute('aria-label', `Go to step ${idx + 1}`);
      dot.addEventListener('click', () => this.goToSlide(idx));
      return dot;
    });
    this.dotsContainer.replaceChildren(...dots);
  }

  public goToSlide(index: number): void {
    if (index < 0 || index >= TUTORIAL_SLIDES.length) return;
    this.currentSlideIndex = index;
    const slide = TUTORIAL_SLIDES[index];

    this.imageEl.style.opacity = '0.25';
    setTimeout(() => {
      this.imageEl.src = slide.imageSrc;
      this.imageEl.style.opacity = '1';
    }, 110);

    this.headerStepEl.textContent = `${index + 1} / ${TUTORIAL_SLIDES.length}`;
    this.titleEl.textContent = slide.title;
    this.descEl.textContent = slide.description;
    this.tipEl.textContent = slide.tip || '';

    this.prevBtn.disabled = index === 0;

    if (index === TUTORIAL_SLIDES.length - 1) {
      this.nextBtn.innerHTML = `<span>Start playing</span>`;
    } else {
      this.nextBtn.innerHTML = `<span>Next</span>${Icons.arrowRight(14)}`;
    }

    this.renderDots();
  }

  public nextSlide(): void {
    if (this.currentSlideIndex < TUTORIAL_SLIDES.length - 1) {
      this.goToSlide(this.currentSlideIndex + 1);
    } else {
      this.close();
    }
  }

  public previousSlide(): void {
    if (this.currentSlideIndex > 0) {
      this.goToSlide(this.currentSlideIndex - 1);
    }
  }

  public open(startSlide = 0): void {
    this.goToSlide(startSlide);
    if (!this.dialog.open) {
      this.dialog.showModal();
    }
  }

  public close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
  }

  public toggle(): void {
    if (this.dialog.open) {
      this.close();
    } else {
      this.open();
    }
  }
}
