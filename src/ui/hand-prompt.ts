/**
 * Live Contextual Hand Coach Pill (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Guides first-time users step-by-step through the core loop without blocking the camera:
 *   1. Show both hands to the camera
 *   2. Pinch thumb & index on both hands to create a string
 *   3. Stretch apart & release to lock the string in air
 *   4. Swipe a fingertip across the string to play
 * Automatically fades out once the user plucks their first note.
 */

type HintStage = 'none' | 'show_hands' | 'pinch' | 'release' | 'pluck';

interface HintContent {
  icon: string;
  text: string;
  accentBorder: string;
  accentGlow: string;
}

const HINT_COPY: Record<Exclude<HintStage, 'none'>, HintContent> = {
  show_hands: {
    icon: '✋',
    text: 'Show both hands to the camera',
    accentBorder: 'rgba(0, 240, 255, 0.38)',
    accentGlow: 'rgba(0, 240, 255, 0.16)',
  },
  pinch: {
    icon: '🤏',
    text: 'Pinch thumb & index on both hands to create a string',
    accentBorder: 'rgba(0, 240, 255, 0.50)',
    accentGlow: 'rgba(0, 240, 255, 0.22)',
  },
  release: {
    icon: '✨',
    text: 'Stretch apart & release to lock the string in air',
    accentBorder: 'rgba(56, 239, 125, 0.50)',
    accentGlow: 'rgba(56, 239, 125, 0.22)',
  },
  pluck: {
    icon: '☝️',
    text: 'Swipe a fingertip across the string to play',
    accentBorder: 'rgba(255, 0, 127, 0.50)',
    accentGlow: 'rgba(255, 0, 127, 0.22)',
  },
};

const HANDS_LOST_GRACE_MS = 900;

export class HandPrompt {
  private element: HTMLDivElement;
  private iconEl: HTMLSpanElement;
  private textEl: HTMLSpanElement;

  private isEnabled = true;
  private isActive = false;
  private hasCompletedOnboarding = false;
  private currentStage: HintStage = 'none';
  private lastTwoHandsSeenMs = -Infinity;

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
      justifyContent: 'center',
      gap: '12px',
      boxSizing: 'border-box',
      width: 'max-content',
      maxWidth: 'calc(100vw - 24px)',
      padding: '14px 20px',
      borderRadius: '20px',
      background: 'rgba(10, 16, 30, 0.45)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1.5px solid rgba(0, 240, 255, 0.35)',
      boxShadow: '0 8px 28px rgba(0, 0, 0, 0.32), 0 0 20px rgba(0, 240, 255, 0.14)',
      fontFamily: 'var(--font-primary)',
      fontSize: 'clamp(15px, 4.2vw, 20px)',
      fontWeight: '700',
      letterSpacing: '0.4px',
      lineHeight: '1.35',
      color: 'rgba(255, 255, 255, 0.96)',
      textAlign: 'center',
      pointerEvents: 'none',
      userSelect: 'none',
      opacity: '0',
      transition: 'opacity 0.32s ease, transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease',
    });

    this.iconEl = document.createElement('span');
    Object.assign(this.iconEl.style, {
      fontSize: 'clamp(20px, 5vw, 26px)',
      lineHeight: '1',
      flexShrink: '0',
    });

    this.textEl = document.createElement('span');

    this.element.appendChild(this.iconEl);
    this.element.appendChild(this.textEl);
    container.appendChild(this.element);
  }

  public configure(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!this.isEnabled) {
      this.applyStage('none');
    }
  }

  /**
   * Starts live coaching once the camera experience is running.
   */
  public activate(): void {
    this.isActive = true;
    this.hasCompletedOnboarding = false;
    this.lastTwoHandsSeenMs = -Infinity;
    if (this.isEnabled) {
      this.applyStage('show_hands');
    }
  }

  /**
   * Marks the core onboarding loop complete once the user plucks their first string.
   */
  public markPlucked(): void {
    if (this.hasCompletedOnboarding) return;
    this.hasCompletedOnboarding = true;
    this.applyStage('none');
  }

  /**
   * Zero-GC per-frame state update. Only touches DOM when the coaching stage actually changes.
   */
  public update(
    handCount: number,
    isDualPinch: boolean,
    stringCount: number,
    nowMs: number
  ): void {
    if (!this.isEnabled || !this.isActive || this.hasCompletedOnboarding) {
      if (this.currentStage !== 'none') {
        this.applyStage('none');
      }
      return;
    }

    if (handCount >= 2) {
      this.lastTwoHandsSeenMs = nowMs;
    }

    let nextStage: HintStage;
    if (stringCount > 0) {
      nextStage = 'pluck';
    } else if (isDualPinch) {
      nextStage = 'release';
    } else if (handCount >= 2) {
      nextStage = 'pinch';
    } else if (
      this.currentStage === 'pinch' &&
      nowMs - this.lastTwoHandsSeenMs < HANDS_LOST_GRACE_MS
    ) {
      // Avoid flickering back to "show_hands" during brief single-frame tracking drops
      nextStage = 'pinch';
    } else {
      nextStage = 'show_hands';
    }

    if (nextStage !== this.currentStage) {
      this.applyStage(nextStage);
    }
  }

  private applyStage(stage: HintStage): void {
    this.currentStage = stage;

    if (stage === 'none') {
      this.element.style.opacity = '0';
      this.element.style.transform = 'translate(-50%, 10px)';
      return;
    }

    const content = HINT_COPY[stage];
    this.iconEl.textContent = content.icon;
    this.textEl.textContent = content.text;
    this.element.style.borderColor = content.accentBorder;
    this.element.style.boxShadow = `0 8px 28px rgba(0, 0, 0, 0.32), 0 0 18px ${content.accentGlow}`;
    this.element.style.opacity = '0.88';
    this.element.style.transform = 'translate(-50%, 0)';
  }
}
