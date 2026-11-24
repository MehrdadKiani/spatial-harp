/**
 * Glassmorphic Splash Screen & Audio Unlocker (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Provides an atmospheric intro overlay with live AR instructions and a primary "Enter Experience"
 * button that seamlessly unlocks the Web Audio Context.
 */

import { HandInteractionMode } from '../types/instruments';

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
  private btnShimmer: HTMLDivElement;
  private btnSpinner: HTMLSpanElement;
  private btnText: HTMLSpanElement;
  private errorBanner: HTMLDivElement;
  private oneHandBtn: HTMLButtonElement;
  private twoHandBtn: HTMLButtonElement;
  private createGuideIcon: HTMLDivElement;
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

    Object.assign(this.element.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100dvh',
      zIndex: '100',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      overflowX: 'hidden',
      overscrollBehavior: 'contain',
      touchAction: 'pan-y',
      padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px max(16px, env(safe-area-inset-bottom, 16px)) 16px',
      background: 'radial-gradient(circle at center, rgba(14, 22, 42, 0.88) 0%, rgba(6, 8, 16, 0.96) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      fontFamily: 'var(--font-primary)',
      color: '#ffffff',
      userSelect: 'none',
      opacity: '1',
      transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    });
    // Enable smooth iOS momentum scrolling on the overlay container
    (this.element.style as CSSStyleDeclaration & { webkitOverflowScrolling?: string }).webkitOverflowScrolling = 'touch';

    const titleText = options.title || 'SPATIAL HARP';
    const subtitleText = options.subtitle || 'Augmented Reality Audio-Visual Instrument';

    this.element.innerHTML = `
      <div class="splash-card" style="
        max-width: 640px;
        width: 92%;
        margin: auto 0;
        flex-shrink: 0;
        touch-action: pan-y;
        text-align: center;
        background: rgba(12, 18, 34, 0.75);
        border: 1px solid rgba(0, 240, 255, 0.32);
        border-radius: 24px;
        padding: 46px 40px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65), 0 0 35px rgba(0, 240, 255, 0.18);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      ">
        <!-- Brand Emblem -->
        <div style="filter: drop-shadow(0 0 24px rgba(0, 240, 255, 0.75)); margin-bottom: 2px;">
          <img src="/icon-128.png" width="84" height="84" alt="Spatial Harp Logo" style="display: block; object-fit: contain;" />
        </div>

        <!-- Typography -->
        <div>
          <h1 class="splash-title" style="
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 2.5px;
            margin: 0;
            text-transform: uppercase;
            background: linear-gradient(135deg, #ffffff 30%, #00f0ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          ">${titleText}</h1>
          <p class="splash-subtitle" style="
            margin: 8px 0 0 0;
            font-size: 15px;
            color: rgba(255, 255, 255, 0.70);
            letter-spacing: 0.6px;
          ">${subtitleText}</p>
        </div>

        <!-- Gesture Quick Guide Cards -->
        <div class="splash-guide-grid" style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          width: 100%;
          margin: 4px 0;
          font-size: 13px;
        ">
          <div class="splash-guide-card" style="background: rgba(0, 240, 255, 0.07); border: 1px solid rgba(0, 240, 255, 0.22); border-radius: 14px; padding: 16px 10px;">
            <div id="splash-create-icon" class="guide-icon" style="font-size: 26px; margin-bottom: 6px;">🤏</div>
            <div>
              <div id="splash-create-title" style="font-weight: 700; color: #00f0ff; margin-bottom: 4px; font-size: 14px;">Pinch & Drag</div>
              <div id="splash-create-desc" style="color: rgba(255, 255, 255, 0.70); line-height: 1.3;">Pinch, drag & release to draw strings</div>
            </div>
          </div>
          <div class="splash-guide-card" style="background: rgba(255, 0, 127, 0.07); border: 1px solid rgba(255, 0, 127, 0.22); border-radius: 14px; padding: 16px 10px;">
            <div class="guide-icon" style="font-size: 26px; margin-bottom: 6px;">☝️</div>
            <div>
              <div style="font-weight: 700; color: #ff007f; margin-bottom: 4px; font-size: 14px;">Touch / Pluck</div>
              <div style="color: rgba(255, 255, 255, 0.70); line-height: 1.3;">Swipe fingertip to synthesize tones</div>
            </div>
          </div>
          <div class="splash-guide-card" style="background: rgba(56, 239, 125, 0.07); border: 1px solid rgba(56, 239, 125, 0.22); border-radius: 14px; padding: 16px 10px;">
            <div class="guide-icon" style="font-size: 26px; margin-bottom: 6px;">⌖</div>
            <div>
              <div style="font-weight: 700; color: #38ef7d; margin-bottom: 4px; font-size: 14px;">Re-Grab Tips</div>
              <div style="color: rgba(255, 255, 255, 0.70); line-height: 1.3;">Pinch tip crosshair to move or rotate</div>
            </div>
          </div>
        </div>

        <!-- Hand Mode Quick Toggle (Accessibility) -->
        <div class="splash-mode-selector" style="
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255, 255, 255, 0.58);">
            Hand Mode
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
            <button id="splash-mode-one" type="button" style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 10px 14px;
              border-radius: 11px;
              font-family: var(--font-primary);
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
              outline: none;
              transition: all 0.2s ease;
            ">
              <span>✋</span><span>One-Hand</span>
            </button>
            <button id="splash-mode-two" type="button" style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 10px 14px;
              border-radius: 11px;
              font-family: var(--font-primary);
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
              outline: none;
              transition: all 0.2s ease;
            ">
              <span>👐</span><span>Two-Hand</span>
            </button>
          </div>
        </div>

        <!-- Compact Privacy Notice -->
        <div class="splash-privacy-note" style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.72);
          background: rgba(0, 255, 170, 0.06);
          border: 1px solid rgba(0, 255, 170, 0.22);
          border-radius: 10px;
          padding: 8px 14px;
          line-height: 1.3;
          text-align: center;
        ">
          <span style="font-size: 14px; flex-shrink: 0;">🔒</span>
          <span><strong style="color: #00ffaa; font-weight: 700;">100% Private:</strong> Runs locally in your browser — never recorded or sent.</span>
        </div>

        <!-- Inline Error Banner (hidden unless an error occurs) -->
        <div id="splash-error-banner" style="
          display: none;
          width: 100%;
          font-size: 12px;
          font-weight: 600;
          color: #ff6688;
          background: rgba(255, 0, 85, 0.10);
          border: 1px solid rgba(255, 0, 85, 0.35);
          border-radius: 10px;
          padding: 10px 14px;
          line-height: 1.4;
          text-align: center;
        "></div>

        <!-- Primary Start Button with Integrated Progress Fill & Active Loader -->
        <button id="splash-start-btn" disabled style="
          position: relative;
          overflow: hidden;
          width: 100%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(0, 240, 255, 0.25);
          color: rgba(255, 255, 255, 0.88);
          font-size: clamp(13px, 3.6vw, 15.5px);
          font-weight: 800;
          letter-spacing: 1.2px;
          line-height: 1.35;
          padding: 16px 22px;
          border-radius: 14px;
          cursor: not-allowed;
          box-shadow: none;
          transition: transform 0.25s ease, box-shadow 0.3s ease, border-color 0.3s ease, color 0.3s ease, background 0.3s ease, opacity 0.25s ease;
        ">
          <div id="splash-btn-progress" style="
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: 0%;
            background: linear-gradient(90deg, rgba(0, 240, 255, 0.45), rgba(56, 239, 125, 0.45));
            box-shadow: 0 0 18px rgba(0, 240, 255, 0.4);
            transition: width 0.35s ease-out, background 0.35s ease;
            pointer-events: none;
            z-index: 0;
          "></div>
          <div id="splash-btn-shimmer" class="splash-btn-shimmer" style="display: none;"></div>
          <span id="splash-btn-content" style="
            position: relative;
            z-index: 2;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          ">
            <span id="splash-btn-spinner" class="splash-spinner" style="display: none;"></span>
            <span id="splash-btn-text">LOADING... 0%</span>
          </span>
        </button>
      </div>
    `;

    this.startBtn = this.element.querySelector('#splash-start-btn') as HTMLButtonElement;
    this.btnProgressFill = this.element.querySelector('#splash-btn-progress') as HTMLDivElement;
    this.btnShimmer = this.element.querySelector('#splash-btn-shimmer') as HTMLDivElement;
    this.btnSpinner = this.element.querySelector('#splash-btn-spinner') as HTMLSpanElement;
    this.btnText = this.element.querySelector('#splash-btn-text') as HTMLSpanElement;
    this.errorBanner = this.element.querySelector('#splash-error-banner') as HTMLDivElement;
    this.oneHandBtn = this.element.querySelector('#splash-mode-one') as HTMLButtonElement;
    this.twoHandBtn = this.element.querySelector('#splash-mode-two') as HTMLButtonElement;
    this.createGuideIcon = this.element.querySelector('#splash-create-icon') as HTMLDivElement;
    this.createGuideTitle = this.element.querySelector('#splash-create-title') as HTMLDivElement;
    this.createGuideDesc = this.element.querySelector('#splash-create-desc') as HTMLDivElement;

    this.renderHandModeUI();
    this.setupListeners();
    this.container.appendChild(this.element);
  }

  private getEffectiveButtonLabel(): string {
    if (this.customButtonLabel) return this.customButtonLabel;
    return this.handMode === 'one-hand'
      ? 'START & SHOW YOUR HAND TO CAMERA'
      : 'START & SHOW BOTH HANDS TO CAMERA';
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
    const applyStyle = (btn: HTMLButtonElement, active: boolean) => {
      btn.style.background = active ? 'rgba(0, 240, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)';
      btn.style.border = active ? '1px solid rgba(0, 240, 255, 0.75)' : '1px solid rgba(255, 255, 255, 0.16)';
      btn.style.color = active ? '#00f0ff' : 'rgba(255, 255, 255, 0.72)';
      btn.style.boxShadow = active ? '0 0 14px rgba(0, 240, 255, 0.25)' : 'none';
    };

    applyStyle(this.oneHandBtn, isOneHand);
    applyStyle(this.twoHandBtn, !isOneHand);

    if (isOneHand) {
      this.createGuideIcon.textContent = '🤏';
      this.createGuideTitle.textContent = 'Pinch & Drag';
      this.createGuideDesc.textContent = 'Pinch, drag & release to draw strings';
    } else {
      this.createGuideIcon.textContent = '🤏🤏';
      this.createGuideTitle.textContent = 'Dual Pinch';
      this.createGuideDesc.textContent = 'Stretch & anchor strings in 3D air';
    }
  }

  private handleStartClick = async () => {
    if (!this.isReady || this.isDismissed) return;
    await this.dismiss();
  };

  private setupListeners(): void {
    this.startBtn.addEventListener('mouseenter', () => {
      if (this.isReady && !this.startBtn.disabled) {
        this.startBtn.style.transform = 'translateY(-2px)';
        this.startBtn.style.boxShadow = '0 6px 28px rgba(0, 240, 255, 0.65)';
        this.startBtn.style.filter = 'brightness(1.08)';
      }
    });

    this.startBtn.addEventListener('mouseleave', () => {
      if (this.isReady && !this.startBtn.disabled) {
        this.startBtn.style.transform = 'translateY(0)';
        this.startBtn.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.45)';
        this.startBtn.style.filter = 'none';
      }
    });

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

  /**
   * Updates loading progress dynamically inside the Start button
   * @param progress Normalized 0.0 to 1.0 (or percentage 0 to 100)
   * @param _status Descriptive text for current loading phase
   */
  public setProgress(progress: number, _status: string): void {
    const pct = Math.min(100, Math.max(0, progress <= 1.0 ? Math.round(progress * 100) : Math.round(progress)));
    this.errorBanner.style.display = 'none';
    this.btnSpinner.style.display = 'none';
    this.btnShimmer.style.display = 'none';
    this.btnProgressFill.style.width = `${pct}%`;
    this.btnText.textContent = `LOADING... ${pct}%`;

    if (pct >= 100 && !this.isReady) {
      this.setReady();
    }
  }

  /**
   * Puts the Start button into an active loading state with spinner & shimmer
   * while camera stream permission is being negotiated with the browser.
   */
  public setLoading(status: string): void {
    this.errorBanner.style.display = 'none';
    this.startBtn.disabled = true;
    this.startBtn.style.cursor = 'wait';
    this.startBtn.style.opacity = '0.92';
    this.startBtn.style.transform = 'none';
    this.startBtn.style.filter = 'none';
    this.btnProgressFill.style.width = '100%';
    this.btnProgressFill.style.background = 'linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%)';
    this.startBtn.style.color = '#070d1a';
    this.btnSpinner.style.display = 'inline-block';
    this.btnShimmer.style.display = 'block';
    this.btnText.textContent = status.toLowerCase().includes('vision')
      ? 'FINALIZING VISION...'
      : 'CONNECTING CAMERA...';
  }

  /**
   * Displays a prominent error state on the splash screen with a retry button
   */
  public setError(status: string, onRetry?: () => void | Promise<void>): void {
    this.isReady = false;
    this.isDismissed = false;
    this.btnSpinner.style.display = 'none';
    this.btnShimmer.style.display = 'none';
    this.errorBanner.textContent = status;
    this.errorBanner.style.display = 'block';

    this.btnProgressFill.style.width = '100%';
    this.btnProgressFill.style.background = 'linear-gradient(135deg, #ff0055 0%, #ff5500 100%)';

    if (onRetry) {
      this.startBtn.disabled = false;
      this.startBtn.style.cursor = 'pointer';
      this.startBtn.style.opacity = '1';
      this.startBtn.style.background = 'linear-gradient(135deg, #ff0055 0%, #ff5500 100%)';
      this.startBtn.style.border = 'none';
      this.startBtn.style.color = '#ffffff';
      this.startBtn.style.boxShadow = '0 6px 24px rgba(255, 0, 85, 0.45)';
      this.btnText.textContent = 'GRANT PERMISSION & RETRY';
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

  /**
   * Enables the Start button with glowing neon styles once assets are preloaded
   */
  public setReady(): void {
    this.isReady = true;
    this.isDismissed = false;
    this.errorBanner.style.display = 'none';
    this.btnSpinner.style.display = 'none';
    this.btnShimmer.style.display = 'none';
    this.btnProgressFill.style.width = '100%';
    this.btnProgressFill.style.background = 'linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%)';
    this.startBtn.disabled = false;
    this.startBtn.style.cursor = 'pointer';
    this.startBtn.style.opacity = '1';
    this.startBtn.style.background = 'linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%)';
    this.startBtn.style.border = 'none';
    this.startBtn.style.color = '#070d1a';
    this.startBtn.style.boxShadow = '0 6px 24px rgba(0, 240, 255, 0.45)';
    this.btnText.textContent = this.buttonLabel;
    this.startBtn.onclick = this.handleStartClick;
  }

  public async dismiss(): Promise<void> {
    if (this.isDismissed) return;

    this.setLoading('CONNECTING CAMERA...');

    if (this.onStart) {
      try {
        await this.onStart();
      } catch (err) {
        console.error('[SplashScreen] Error during onStart:', err);
        // Do NOT dismiss or unmount the splash overlay if onStart threw an error!
        return;
      }
    }

    this.isDismissed = true;

    // Smooth fade & scale out transition
    this.element.style.opacity = '0';
    this.element.style.transform = 'scale(1.05)';
    this.element.style.pointerEvents = 'none';

    setTimeout(() => {
      if (this.element.parentElement) {
        this.element.parentElement.removeChild(this.element);
      }
    }, 600);
  }

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'flex' : 'none';
  }
}
