/**
 * Glassmorphic Splash Screen & Audio Unlocker (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Provides an atmospheric intro overlay with live AR instructions and a primary "Enter Experience"
 * button that seamlessly unlocks the Web Audio Context.
 */

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
  private progressBar: HTMLDivElement;
  private progressLabel: HTMLSpanElement;
  private progressPercent: HTMLSpanElement;
  private audioNotice: HTMLDivElement;
  private isDismissed = false;
  private isReady = false;
  private buttonLabel: string;
  private onStart?: () => void | Promise<void>;

  constructor(container: HTMLElement, options: SplashScreenOptions = {}) {
    this.container = container;
    this.onStart = options.onStart;
    this.buttonLabel = options.buttonLabel || 'START EXPERIENCE';

    this.element = document.createElement('div');
    this.element.id = 'app-splash-screen';

    Object.assign(this.element.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '100',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, rgba(14, 22, 42, 0.88) 0%, rgba(6, 8, 16, 0.96) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      fontFamily: 'var(--font-primary)',
      color: '#ffffff',
      userSelect: 'none',
      opacity: '1',
      transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    });

    const titleText = options.title || 'SPATIAL HARP';
    const subtitleText = options.subtitle || 'Augmented Reality Audio-Visual Instrument';

    this.element.innerHTML = `
      <div class="splash-card" style="
        max-width: 640px;
        width: 92%;
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
        <!-- Brand Emblem SVG -->
        <div style="filter: drop-shadow(0 0 16px #00f0ff); margin-bottom: 2px;">
          <svg width="80" height="80" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="16,2 29,9 29,23 16,30 3,23 3,9" stroke="#00f0ff" stroke-width="1.8" fill="rgba(0, 240, 255, 0.1)"/>
            <line x1="11" y1="8" x2="11" y2="24" stroke="#ff007f" stroke-width="1.6" stroke-linecap="round" />
            <line x1="16" y1="5" x2="16" y2="27" stroke="#00f0ff" stroke-width="2.0" stroke-linecap="round" />
            <line x1="21" y1="8" x2="21" y2="24" stroke="#38ef7d" stroke-width="1.6" stroke-linecap="round" />
            <circle cx="16" cy="14" r="2.4" fill="#ffffff" style="filter: drop-shadow(0 0 5px #ffffff);" />
          </svg>
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
            <div class="guide-icon" style="font-size: 26px; margin-bottom: 6px;">🤏🤏</div>
            <div>
              <div style="font-weight: 700; color: #00f0ff; margin-bottom: 4px; font-size: 14px;">Dual Pinch</div>
              <div style="color: rgba(255, 255, 255, 0.70); line-height: 1.3;">Stretch & anchor strings in 3D air</div>
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

        <!-- Live Loading Bar Section -->
        <div id="splash-loading-section" style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: rgba(255, 255, 255, 0.75); font-weight: 600;">
            <span id="splash-progress-label">Initializing application...</span>
            <span id="splash-progress-percent" style="color: #00f0ff;">0%</span>
          </div>
          <div id="splash-progress-track" style="
            width: 100%;
            height: 8px;
            background: rgba(0, 240, 255, 0.12);
            border: 1px solid rgba(0, 240, 255, 0.25);
            border-radius: 10px;
            overflow: hidden;
            position: relative;
          ">
            <div id="splash-progress-bar" style="
              width: 0%;
              height: 100%;
              background: linear-gradient(90deg, #00f0ff, #38ef7d);
              box-shadow: 0 0 12px #00f0ff;
              border-radius: 10px;
              transition: width 0.35s ease-out;
            "></div>
          </div>
        </div>

        <!-- Privacy & Local-Only Processing Notice -->
        <div class="splash-privacy-note" style="
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.72);
          background: rgba(0, 255, 170, 0.06);
          border: 1px solid rgba(0, 255, 170, 0.24);
          border-radius: 12px;
          padding: 10px 16px;
          line-height: 1.45;
          text-align: left;
        ">
          <span style="font-size: 20px; flex-shrink: 0;">🔒</span>
          <span>
            <strong style="color: #00ffaa; font-weight: 700;">100% Private & On-the-Fly:</strong> 
            Camera frames and hand movements are processed purely in real time inside your browser. No video, images, or personal data are ever recorded, stored, or sent to any server.
          </span>
        </div>

        <!-- Primary Start Button (Disabled until loading reaches 100%) -->
        <button id="splash-start-btn" disabled style="
          width: 100%;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.45);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1.8px;
          padding: 16px 28px;
          border-radius: 14px;
          cursor: not-allowed;
          box-shadow: none;
          transition: all 0.3s ease;
        ">LOADING SYSTEM...</button>

        <!-- Audio unlock notice (Appears under Start button only when loading completes) -->
        <div id="splash-audio-notice" style="
          display: none;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 170, 0, 0.95);
          background: rgba(255, 170, 0, 0.12);
          border: 1px solid rgba(255, 170, 0, 0.28);
          border-radius: 10px;
          padding: 8px 16px;
          width: 100%;
          opacity: 0;
          transition: opacity 0.4s ease;
        ">
          <span style="font-size: 16px;">🔊</span>
          <span>Clicking start will activate Web Audio and start the camera feed</span>
        </div>

        <!-- App Version & Engine Footer -->
        <div style="
          font-family: var(--font-primary);
          font-size: 10px;
          color: rgba(255, 255, 255, 0.40);
          letter-spacing: 1.2px;
          margin-top: 2px;
          text-transform: uppercase;
        ">
          SPATIAL HARP · <span style="color: rgba(0, 240, 255, 0.85); font-weight: 700;">v${__APP_VERSION__}</span> · OFFLINE AR ENGINE
        </div>
      </div>
    `;

    this.startBtn = this.element.querySelector('#splash-start-btn') as HTMLButtonElement;
    this.progressBar = this.element.querySelector('#splash-progress-bar') as HTMLDivElement;
    this.progressLabel = this.element.querySelector('#splash-progress-label') as HTMLSpanElement;
    this.progressPercent = this.element.querySelector('#splash-progress-percent') as HTMLSpanElement;
    this.audioNotice = this.element.querySelector('#splash-audio-notice') as HTMLDivElement;

    this.setupListeners();
    this.container.appendChild(this.element);
  }

  private setupListeners(): void {
    this.startBtn.addEventListener('mouseenter', () => {
      if (this.isReady) {
        this.startBtn.style.transform = 'translateY(-2px)';
        this.startBtn.style.boxShadow = '0 6px 28px rgba(0, 240, 255, 0.65)';
        this.startBtn.style.filter = 'brightness(1.08)';
      }
    });

    this.startBtn.addEventListener('mouseleave', () => {
      if (this.isReady) {
        this.startBtn.style.transform = 'translateY(0)';
        this.startBtn.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.45)';
        this.startBtn.style.filter = 'none';
      }
    });

    this.startBtn.addEventListener('click', async () => {
      if (!this.isReady) return;
      await this.dismiss();
    });
  }

  /**
   * Updates loading progress dynamically from the application bootstrapper
   * @param progress Normalized 0.0 to 1.0 (or percentage 0 to 100)
   * @param status Descriptive text for current loading phase
   */
  public setProgress(progress: number, status: string): void {
    const pct = Math.min(100, Math.max(0, progress <= 1.0 ? Math.round(progress * 100) : Math.round(progress)));
    this.progressBar.style.width = `${pct}%`;
    this.progressPercent.textContent = `${pct}%`;
    this.progressLabel.textContent = status;

    if (pct >= 100 && !this.isReady) {
      this.setReady();
    }
  }

  /**
   * Enables the Start button with glowing neon styles once everything has finished loading
   */
  public setReady(): void {
    this.isReady = true;
    this.startBtn.disabled = false;
    this.startBtn.style.cursor = 'pointer';
    this.startBtn.style.background = 'linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%)';
    this.startBtn.style.border = 'none';
    this.startBtn.style.color = '#070d1a';
    this.startBtn.style.boxShadow = '0 6px 24px rgba(0, 240, 255, 0.45)';
    this.startBtn.textContent = this.buttonLabel;
    this.audioNotice.style.display = 'flex';
    requestAnimationFrame(() => {
      this.audioNotice.style.opacity = '1';
    });
    this.progressLabel.textContent = 'All systems ready!';
  }

  public async dismiss(): Promise<void> {
    if (this.isDismissed) return;
    this.isDismissed = true;

    this.startBtn.disabled = true;
    this.startBtn.style.opacity = '0.7';
    this.startBtn.innerText = 'INITIALIZING...';

    if (this.onStart) {
      try {
        await this.onStart();
      } catch (err) {
        console.error('[SplashScreen] Error during onStart:', err);
      }
    }

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
