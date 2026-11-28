/**
 * Optical Studio Splash Screen & Audio Unlocker (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Minimal smoked-obsidian welcome overlay with hairline gesture guide, hand-mode toggle,
 * and integrated asset-loading progress CTA.
 */

import { HandInteractionMode } from '../types/instruments';
import { Icons } from './icons';

export interface SplashScreenOptions {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  initialHandMode?: HandInteractionMode;
  onHandModeChange?: (mode: HandInteractionMode) => void;
  onStart?: () => void | Promise<void>;
}

export class SplashScreen {
  private element: HTMLDivElement;
  private container: HTMLElement;
  private startBtn: HTMLButtonElement;
  private btnProgressFill: HTMLDivElement;
  private btnSpinner: HTMLSpanElement;
  private btnText: HTMLSpanElement;
  private errorBanner: HTMLDivElement;
  private oneHandBtn: HTMLButtonElement;
  private twoHandBtn: HTMLButtonElement;
  private createGuideTitle: HTMLDivElement;
  private createGuideDesc: HTMLDivElement;
  private isDismissed = false;
  private isReady = false;
  private handMode: HandInteractionMode;
  private customButtonLabel?: string;
  private buttonLabel: string;
  private onHandModeChange?: (mode: HandInteractionMode) => void;
  private onStart?: () => void | Promise<void>;

  constructor(container: HTMLElement, options: SplashScreenOptions = {}) {
    this.container = container;
    this.onStart = options.onStart;
    this.onHandModeChange = options.onHandModeChange;
    this.handMode = options.initialHandMode ?? 'one-hand';
    this.customButtonLabel = options.buttonLabel;
    this.buttonLabel = this.getEffectiveButtonLabel();

    this.element = document.createElement('div');
    this.element.id = 'app-splash-screen';
    (this.element.style as CSSStyleDeclaration & { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';

    const titleText = options.title || 'Spatial Harp';
    const subtitleText = options.subtitle || 'Play polyphonic light strings in mid-air with your hands.';

    this.element.innerHTML = `
      <div class="splash-card">
        <div class="splash-header">
          <div class="splash-emblem">
            <img src="/icon-128.png" width="38" height="38" alt="Spatial Harp" />
          </div>
          <h1 class="splash-title">${titleText}</h1>
          <p class="splash-subtitle">${subtitleText}</p>
        </div>

        <div class="splash-guide-strip">
          <div class="splash-guide-item">
            <span class="splash-guide-icon">${Icons.pinch(18)}</span>
            <div>
              <div id="splash-create-title" class="splash-guide-title">Pinch & drag</div>
              <div id="splash-create-desc" class="splash-guide-desc">Hold steady until it pops, then draw</div>
            </div>
          </div>
          <div class="splash-guide-item">
            <span class="splash-guide-icon">${Icons.pluck(18)}</span>
            <div>
              <div class="splash-guide-title">Swipe to pluck</div>
              <div class="splash-guide-desc">Cross any string to play notes</div>
            </div>
          </div>
          <div class="splash-guide-item">
            <span class="splash-guide-icon">${Icons.crosshair(18)}</span>
            <div>
              <div class="splash-guide-title">Grab anchors</div>
              <div class="splash-guide-desc">Pinch a string tip to move or tune</div>
            </div>
          </div>
        </div>

        <div class="splash-mode-block">
          <div class="splash-mode-header">
            <span class="section-label">Hand mode</span>
            <span class="section-meta">Switch anytime in Settings</span>
          </div>
          <div class="segmented-control" role="group" aria-label="Hand mode">
            <button id="splash-mode-one" class="seg-btn" type="button" aria-pressed="true">
              ${Icons.hand(15)}
              <span>One-Hand</span>
            </button>
            <button id="splash-mode-two" class="seg-btn" type="button" aria-pressed="false">
              ${Icons.hands(15)}
              <span>Two-Hand</span>
            </button>
          </div>
        </div>

        <div id="splash-error-banner" class="splash-error-banner" role="alert"></div>

        <button id="splash-start-btn" class="splash-start-btn" type="button" disabled data-state="preloading">
          <div id="splash-btn-progress" class="splash-btn-progress"></div>
          <span class="splash-btn-content">
            <span id="splash-btn-spinner" class="splash-spinner"></span>
            <span id="splash-btn-text" class="mono">Loading 0%</span>
          </span>
        </button>

        <div class="splash-privacy-note">
          ${Icons.shield(14)}
          <span>Camera processing runs locally in your browser — never recorded or uploaded.</span>
        </div>
      </div>
    `;

    this.startBtn = this.element.querySelector('#splash-start-btn') as HTMLButtonElement;
    this.btnProgressFill = this.element.querySelector('#splash-btn-progress') as HTMLDivElement;
    this.btnSpinner = this.element.querySelector('#splash-btn-spinner') as HTMLSpanElement;
    this.btnText = this.element.querySelector('#splash-btn-text') as HTMLSpanElement;
    this.errorBanner = this.element.querySelector('#splash-error-banner') as HTMLDivElement;
    this.oneHandBtn = this.element.querySelector('#splash-mode-one') as HTMLButtonElement;
    this.twoHandBtn = this.element.querySelector('#splash-mode-two') as HTMLButtonElement;
    this.createGuideTitle = this.element.querySelector('#splash-create-title') as HTMLDivElement;
    this.createGuideDesc = this.element.querySelector('#splash-create-desc') as HTMLDivElement;

    this.renderHandModeUI();
    this.setupListeners();
    this.container.appendChild(this.element);
  }

  private getEffectiveButtonLabel(): string {
    if (this.customButtonLabel) return this.customButtonLabel;
    return this.handMode === 'one-hand'
      ? 'Start playing'
      : 'Start with both hands';
  }

  public setHandMode(mode: HandInteractionMode): void {
    this.handMode = mode;
    this.buttonLabel = this.getEffectiveButtonLabel();
    this.renderHandModeUI();
    if (this.isReady && !this.startBtn.disabled) {
      this.btnText.textContent = this.buttonLabel;
    }
  }

  private renderHandModeUI(): void {
    const isOneHand = this.handMode === 'one-hand';
    this.oneHandBtn.setAttribute('aria-pressed', String(isOneHand));
    this.twoHandBtn.setAttribute('aria-pressed', String(!isOneHand));

    if (isOneHand) {
      this.createGuideTitle.textContent = 'Pinch & drag';
      this.createGuideDesc.textContent = 'Hold steady until it pops, then draw';
    } else {
      this.createGuideTitle.textContent = 'Dual pinch';
      this.createGuideDesc.textContent = 'Hold both hands, stretch, and release';
    }
  }

  private handleStartClick = async () => {
    if (!this.isReady || this.isDismissed) return;
    await this.dismiss();
  };

  private setupListeners(): void {
    this.startBtn.onclick = this.handleStartClick;

    this.oneHandBtn.addEventListener('click', () => {
      if (this.handMode !== 'one-hand') {
        this.setHandMode('one-hand');
        if (this.onHandModeChange) this.onHandModeChange('one-hand');
      }
    });

    this.twoHandBtn.addEventListener('click', () => {
      if (this.handMode !== 'two-hand') {
        this.setHandMode('two-hand');
        if (this.onHandModeChange) this.onHandModeChange('two-hand');
      }
    });
  }

  public setProgress(progress: number, _status: string): void {
    const pct = Math.min(100, Math.max(0, progress <= 1.0 ? Math.round(progress * 100) : Math.round(progress)));
    this.errorBanner.style.display = 'none';
    this.btnSpinner.style.display = 'none';
    this.startBtn.dataset.state = 'preloading';
    this.btnProgressFill.style.width = `${pct}%`;
    this.btnText.classList.add('mono');
    this.btnText.textContent = `Loading ${pct}%`;

    if (pct >= 100 && !this.isReady) {
      this.setReady();
    }
  }

  public setLoading(status: string): void {
    this.errorBanner.style.display = 'none';
    this.startBtn.disabled = true;
    this.startBtn.dataset.state = 'loading';
    this.btnSpinner.style.display = 'inline-block';
    this.btnText.classList.remove('mono');
    this.btnText.textContent = status.toLowerCase().includes('vision')
      ? 'Finalizing vision...'
      : 'Connecting camera...';
  }

  public setError(status: string, onRetry?: () => void | Promise<void>): void {
    this.isReady = false;
    this.isDismissed = false;
    this.btnSpinner.style.display = 'none';
    this.errorBanner.textContent = status;
    this.errorBanner.style.display = 'block';
    this.startBtn.dataset.state = 'error';
    this.btnText.classList.remove('mono');

    if (onRetry) {
      this.startBtn.disabled = false;
      this.btnText.textContent = 'Allow camera & retry';
      this.startBtn.onclick = async (e) => {
        e.stopPropagation();
        this.setLoading('Retrying camera connection...');
        try {
          await onRetry();
        } catch (err) {
          console.error('[SplashScreen] Retry failed:', err);
        }
      };
    }
  }

  public setReady(): void {
    this.isReady = true;
    this.isDismissed = false;
    this.errorBanner.style.display = 'none';
    this.btnSpinner.style.display = 'none';
    this.btnProgressFill.style.width = '100%';
    this.startBtn.disabled = false;
    this.startBtn.dataset.state = 'ready';
    this.btnText.classList.remove('mono');
    this.btnText.textContent = this.buttonLabel;
    this.startBtn.onclick = this.handleStartClick;
  }

  public async dismiss(): Promise<void> {
    if (this.isDismissed) return;

    this.setLoading('Connecting camera...');

    if (this.onStart) {
      try {
        await this.onStart();
      } catch (err) {
        console.error('[SplashScreen] Error during onStart:', err);
        return;
      }
    }

    this.isDismissed = true;
    this.element.style.opacity = '0';
    this.element.style.transform = 'scale(1.03)';
    this.element.style.pointerEvents = 'none';

    setTimeout(() => {
      if (this.element.parentElement) {
        this.element.parentElement.removeChild(this.element);
      }
    }, 520);
  }

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'flex' : 'none';
  }
}
