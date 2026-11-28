/**
 * Optical Studio Splash Screen & Audio Unlocker (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Minimal smoked-obsidian welcome overlay with hairline gesture guide and integrated
 * asset-loading progress CTA.
 */

import { Icons } from './icons';

export interface SplashScreenOptions {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
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
  private isDismissed = false;
  private isReady = false;
  private buttonLabel: string;
  private onStart?: () => void | Promise<void>;

  constructor(container: HTMLElement, options: SplashScreenOptions = {}) {
    this.container = container;
    this.onStart = options.onStart;
    this.buttonLabel = options.buttonLabel || 'Start playing';

    this.element = document.createElement('div');
    this.element.id = 'app-splash-screen';
    (this.element.style as CSSStyleDeclaration & { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';

    const titleText = options.title || 'Spatial Harp';
    const subtitleText = options.subtitle || 'Play polyphonic light strings in mid-air with your hands.';

    this.element.innerHTML = `
      <div class="splash-card">
        <div class="splash-header">
          <div class="splash-emblem">
            <img src="/icon-128.png" width="82" height="82" alt="Spatial Harp" />
          </div>
          <h1 class="splash-title">${titleText}</h1>
          <p class="splash-subtitle">${subtitleText}</p>
        </div>

        <div class="splash-guide-strip">
          <div class="splash-guide-item">
            <span class="splash-guide-num" aria-hidden="true">1</span>
            <div>
              <div class="splash-guide-title">Pinch & drag</div>
              <div class="splash-guide-desc">Hold steady until it pops, then draw a string</div>
            </div>
          </div>
          <div class="splash-guide-item">
            <span class="splash-guide-num" aria-hidden="true">2</span>
            <div>
              <div class="splash-guide-title">Swipe to pluck</div>
              <div class="splash-guide-desc">Cross any string with your fingertips to play</div>
            </div>
          </div>
          <div class="splash-guide-item">
            <span class="splash-guide-num" aria-hidden="true">3</span>
            <div>
              <div class="splash-guide-title">Grab anchors</div>
              <div class="splash-guide-desc">Pinch tips with one or both hands to resize or tune</div>
            </div>
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
          ${Icons.shield(15)}
          <span>Camera processing runs locally in your browser — never recorded or uploaded.</span>
        </div>
      </div>
    `;

    this.startBtn = this.element.querySelector('#splash-start-btn') as HTMLButtonElement;
    this.btnProgressFill = this.element.querySelector('#splash-btn-progress') as HTMLDivElement;
    this.btnSpinner = this.element.querySelector('#splash-btn-spinner') as HTMLSpanElement;
    this.btnText = this.element.querySelector('#splash-btn-text') as HTMLSpanElement;
    this.errorBanner = this.element.querySelector('#splash-error-banner') as HTMLDivElement;

    this.startBtn.onclick = this.handleStartClick;
    this.container.appendChild(this.element);
  }

  private handleStartClick = async () => {
    if (!this.isReady || this.isDismissed) return;
    await this.dismiss();
  };

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
