/**
 * Live Camera Empty-State Prompt (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Displays a subtle glassmorphic pill ("Show your hands to the camera") when the experience
 * is active and no hands are currently detected, fading out the instant a hand appears.
 */

const REAPPEAR_DELAY_MS = 1200;

export class HandPrompt {
  private element: HTMLDivElement;
  private isActive = false;
  private isVisible = false;
  private hasSeenHandOnce = false;
  private lastHandSeenMs = 0;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'hand-camera-prompt';
    this.element.setAttribute('aria-live', 'polite');

    Object.assign(this.element.style, {
      position: 'fixed',
      left: '50%',
      bottom: 'max(56px, calc(env(safe-area-inset-bottom, 16px) + 40px))',
      transform: 'translate(-50%, 10px)',
      zIndex: '25',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      maxWidth: 'calc(100vw - 32px)',
      padding: '10px 18px',
      borderRadius: '999px',
      background: 'rgba(10, 16, 30, 0.72)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(0, 240, 255, 0.35)',
      boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45), 0 0 18px rgba(0, 240, 255, 0.16)',
      fontFamily: 'var(--font-primary)',
      fontSize: 'clamp(12px, 3.2vw, 14px)',
      fontWeight: '600',
      letterSpacing: '0.4px',
      color: 'rgba(255, 255, 255, 0.92)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      userSelect: 'none',
      opacity: '0',
      transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    });

    this.element.innerHTML = `
      <span style="font-size: 16px; line-height: 1; flex-shrink: 0;">✋</span>
      <span>Show both hands to the camera</span>
    `;

    container.appendChild(this.element);
  }

  /**
   * Enables the prompt once the camera experience has started and shows it immediately.
   */
  public activate(): void {
    this.isActive = true;
    this.hasSeenHandOnce = false;
    this.setVisible(true);
  }

  /**
   * Zero-GC per-frame state update. Only touches DOM when visibility actually changes.
   */
  public update(handCount: number, nowMs: number): void {
    if (!this.isActive) return;

    if (handCount > 0) {
      this.hasSeenHandOnce = true;
      this.lastHandSeenMs = nowMs;
      if (this.isVisible) {
        this.setVisible(false);
      }
      return;
    }

    // No hands detected: show immediately before first detection, or after grace delay
    if (!this.isVisible) {
      if (!this.hasSeenHandOnce || nowMs - this.lastHandSeenMs >= REAPPEAR_DELAY_MS) {
        this.setVisible(true);
      }
    }
  }

  private setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.opacity = visible ? '1' : '0';
    this.element.style.transform = visible ? 'translate(-50%, 0)' : 'translate(-50%, 10px)';
  }
}
