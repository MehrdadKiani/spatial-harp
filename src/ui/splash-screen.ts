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
  private isDismissed = false;
  private onStart?: () => void | Promise<void>;

  constructor(container: HTMLElement, options: SplashScreenOptions = {}) {
    this.container = container;
    this.onStart = options.onStart;

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
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      color: '#ffffff',
      userSelect: 'none',
      opacity: '1',
      transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    });

    const titleText = options.title || 'SPATIAL HARP';
    const subtitleText = options.subtitle || 'Augmented Reality Audio-Visual Instrument';
    const buttonLabel = options.buttonLabel || 'START EXPERIENCE';

    this.element.innerHTML = `
      <div style="
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
        gap: 26px;
      ">
        <!-- Brand Emblem SVG -->
        <div style="filter: drop-shadow(0 0 16px #00f0ff); margin-bottom: 4px;">
          <svg width="84" height="84" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="16,2 29,9 29,23 16,30 3,23 3,9" stroke="#00f0ff" stroke-width="1.8" fill="rgba(0, 240, 255, 0.1)"/>
            <line x1="11" y1="8" x2="11" y2="24" stroke="#ff007f" stroke-width="1.6" stroke-linecap="round" />
            <line x1="16" y1="5" x2="16" y2="27" stroke="#00f0ff" stroke-width="2.0" stroke-linecap="round" />
            <line x1="21" y1="8" x2="21" y2="24" stroke="#38ef7d" stroke-width="1.6" stroke-linecap="round" />
            <circle cx="16" cy="14" r="2.4" fill="#ffffff" style="filter: drop-shadow(0 0 5px #ffffff);" />
          </svg>
        </div>

        <!-- Typography -->
        <div>
          <h1 style="
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 2.5px;
            margin: 0;
            text-transform: uppercase;
            background: linear-gradient(135deg, #ffffff 30%, #00f0ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          ">${titleText}</h1>
          <p style="
            margin: 8px 0 0 0;
            font-size: 15px;
            color: rgba(255, 255, 255, 0.70);
            letter-spacing: 0.6px;
          ">${subtitleText}</p>
        </div>

        <!-- Gesture Quick Guide Cards -->
        <div style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          width: 100%;
          margin: 6px 0;
          font-size: 13px;
        ">
          <div style="background: rgba(0, 240, 255, 0.07); border: 1px solid rgba(0, 240, 255, 0.22); border-radius: 14px; padding: 16px 10px;">
            <div style="font-size: 26px; margin-bottom: 6px;">🤏🤏</div>
            <div style="font-weight: 700; color: #00f0ff; margin-bottom: 4px; font-size: 14px;">Dual Pinch</div>
            <div style="color: rgba(255, 255, 255, 0.70); line-height: 1.3;">Stretch & anchor strings in 3D air</div>
          </div>
          <div style="background: rgba(255, 0, 127, 0.07); border: 1px solid rgba(255, 0, 127, 0.22); border-radius: 14px; padding: 16px 10px;">
            <div style="font-size: 26px; margin-bottom: 6px;">☝️</div>
            <div style="font-weight: 700; color: #ff007f; margin-bottom: 4px; font-size: 14px;">Touch / Pluck</div>
            <div style="color: rgba(255, 255, 255, 0.70); line-height: 1.3;">Swipe fingertip to synthesize tones</div>
          </div>
          <div style="background: rgba(56, 239, 125, 0.07); border: 1px solid rgba(56, 239, 125, 0.22); border-radius: 14px; padding: 16px 10px;">
            <div style="font-size: 26px; margin-bottom: 6px;">⌖</div>
            <div style="font-weight: 700; color: #38ef7d; margin-bottom: 4px; font-size: 14px;">Re-Grab Tips</div>
            <div style="color: rgba(255, 255, 255, 0.70); line-height: 1.3;">Pinch tip crosshair to move or rotate</div>
          </div>
        </div>

        <!-- Audio unlock notice -->
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 170, 0, 0.95);
          background: rgba(255, 170, 0, 0.12);
          border: 1px solid rgba(255, 170, 0, 0.28);
          border-radius: 10px;
          padding: 8px 16px;
        ">
          <span style="font-size: 16px;">🔊</span>
          <span>Starting will activate Web Audio and camera hand tracking</span>
        </div>

        <!-- Primary Start Button -->
        <button id="splash-start-btn" style="
          width: 100%;
          background: linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%);
          border: none;
          color: #070d1a;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1.8px;
          padding: 16px 28px;
          border-radius: 14px;
          cursor: pointer;
          box-shadow: 0 6px 24px rgba(0, 240, 255, 0.45);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        ">${buttonLabel}</button>
      </div>
    `;

    this.startBtn = this.element.querySelector('#splash-start-btn') as HTMLButtonElement;
    this.setupListeners();
    this.container.appendChild(this.element);
  }

  private setupListeners(): void {
    this.startBtn.addEventListener('mouseenter', () => {
      this.startBtn.style.transform = 'translateY(-2px)';
      this.startBtn.style.boxShadow = '0 6px 28px rgba(0, 240, 255, 0.65)';
      this.startBtn.style.filter = 'brightness(1.08)';
    });

    this.startBtn.addEventListener('mouseleave', () => {
      this.startBtn.style.transform = 'translateY(0)';
      this.startBtn.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.45)';
      this.startBtn.style.filter = 'none';
    });

    this.startBtn.addEventListener('click', async () => {
      await this.dismiss();
    });
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
