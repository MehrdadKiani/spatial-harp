/**
 * Live Contextual Hand Coach Pill (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Guides first-time users step-by-step through the core loop without blocking the camera:
 *   One-Hand Mode (default):
 *     1. Show your hand to the camera
 *     2. Pinch thumb & index and drag in mid-air to draw a string
 *     3. Drag apart & release to lock the string in air
 *     4. Swipe a fingertip across the string to play
 *   Two-Hand Mode:
 *     - Guides both hands; if only 1 hand is visible for 3s with 0 strings,
 *       runs a 3-2-1 countdown and automatically switches to One-Hand Mode.
 * Automatically fades out once the user plucks their first note.
 */

import { HandInteractionMode } from '../types/instruments';

type HintStage =
  | 'none'
  | 'show_hands'
  | 'pinch'
  | 'release'
  | 'pluck'
  | 'countdown_3'
  | 'countdown_2'
  | 'countdown_1';

interface HintContent {
  icon: string;
  text: string;
  accentBorder: string;
  accentGlow: string;
}

const ONE_HAND_COPY: Record<'show_hands' | 'pinch' | 'release' | 'pluck', HintContent> = {
  show_hands: {
    icon: '✋',
    text: 'Show your hand to the camera',
    accentBorder: 'rgba(0, 240, 255, 0.38)',
    accentGlow: 'rgba(0, 240, 255, 0.16)',
  },
  pinch: {
    icon: '🤏',
    text: 'Pinch & drag in mid-air to draw a string',
    accentBorder: 'rgba(0, 240, 255, 0.50)',
    accentGlow: 'rgba(0, 240, 255, 0.22)',
  },
  release: {
    icon: '✨',
    text: 'Drag apart & release to lock the string in air',
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

const TWO_HAND_COPY: Record<'show_hands' | 'pinch' | 'release' | 'pluck', HintContent> = {
  show_hands: {
    icon: '👐',
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

const COUNTDOWN_COPY: Record<'countdown_3' | 'countdown_2' | 'countdown_1', HintContent> = {
  countdown_3: {
    icon: '⏳',
    text: 'One hand detected — switching to One-Hand Mode in 3...',
    accentBorder: 'rgba(255, 170, 0, 0.65)',
    accentGlow: 'rgba(255, 170, 0, 0.28)',
  },
  countdown_2: {
    icon: '⏳',
    text: 'One hand detected — switching to One-Hand Mode in 2...',
    accentBorder: 'rgba(255, 170, 0, 0.72)',
    accentGlow: 'rgba(255, 170, 0, 0.32)',
  },
  countdown_1: {
    icon: '⏳',
    text: 'One hand detected — switching to One-Hand Mode in 1...',
    accentBorder: 'rgba(56, 239, 125, 0.75)',
    accentGlow: 'rgba(56, 239, 125, 0.35)',
  },
};

const HANDS_LOST_GRACE_MS = 900;
const SINGLE_HAND_DETECT_MS = 3000;
const COUNTDOWN_DURATION_MS = 3000;

export interface HandPromptOptions {
  initialHandMode?: HandInteractionMode;
  onAutoSwitchToOneHand?: () => void;
}

export class HandPrompt {
  private element: HTMLDivElement;
  private iconEl: HTMLSpanElement;
  private textEl: HTMLSpanElement;

  private isEnabled = true;
  private isActive = false;
  private hasCompletedOnboarding = false;
  private handMode: HandInteractionMode;
  private currentStage: HintStage = 'none';
  private lastRequiredHandsSeenMs = -Infinity;
  private singleHandSinceMs = -Infinity;
  private onAutoSwitchToOneHand?: () => void;

  constructor(container: HTMLElement, options: HandPromptOptions = {}) {
    this.handMode = options.initialHandMode ?? 'one-hand';
    this.onAutoSwitchToOneHand = options.onAutoSwitchToOneHand;

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

  public setHandMode(mode: HandInteractionMode): void {
    if (this.handMode === mode) return;
    this.handMode = mode;
    this.singleHandSinceMs = -Infinity;
    this.lastRequiredHandsSeenMs = -Infinity;
    // Refresh copy immediately if currently visible
    if (this.currentStage !== 'none') {
      const stageToRefresh: HintStage =
        this.currentStage === 'countdown_3' ||
        this.currentStage === 'countdown_2' ||
        this.currentStage === 'countdown_1'
          ? 'show_hands'
          : this.currentStage;
      this.applyStage(stageToRefresh);
    }
  }

  /**
   * Starts live coaching once the camera experience is running.
   */
  public activate(): void {
    this.isActive = true;
    this.hasCompletedOnboarding = false;
    this.lastRequiredHandsSeenMs = -Infinity;
    this.singleHandSinceMs = -Infinity;
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
    this.singleHandSinceMs = -Infinity;
    this.applyStage('none');
  }

  /**
   * Zero-GC per-frame state update. Only touches DOM when the coaching stage actually changes.
   */
  public update(
    handCount: number,
    isStretching: boolean,
    stringCount: number,
    nowMs: number
  ): void {
    if (!this.isActive) return;

    // 1. Auto-fallback in Two-Hand Mode: if only 1 hand is shown for 3s (with 0 strings),
    //    run a 3-2-1 countdown and automatically switch to One-Hand Mode.
    let countdownStage: 'countdown_3' | 'countdown_2' | 'countdown_1' | null = null;

    if (this.handMode === 'two-hand' && stringCount === 0 && !isStretching && handCount === 1) {
      if (this.singleHandSinceMs === -Infinity) {
        this.singleHandSinceMs = nowMs;
      }
      const elapsedSingleMs = nowMs - this.singleHandSinceMs;
      if (elapsedSingleMs >= SINGLE_HAND_DETECT_MS + COUNTDOWN_DURATION_MS) {
        // Countdown finished -> switch to One-Hand Mode and continue
        this.handMode = 'one-hand';
        this.singleHandSinceMs = -Infinity;
        this.lastRequiredHandsSeenMs = nowMs;
        if (this.onAutoSwitchToOneHand) {
          this.onAutoSwitchToOneHand();
        }
      } else if (elapsedSingleMs >= SINGLE_HAND_DETECT_MS) {
        const remainingSec = Math.ceil(
          (SINGLE_HAND_DETECT_MS + COUNTDOWN_DURATION_MS - elapsedSingleMs) / 1000
        );
        if (remainingSec >= 3) countdownStage = 'countdown_3';
        else if (remainingSec === 2) countdownStage = 'countdown_2';
        else countdownStage = 'countdown_1';
      }
    } else {
      this.singleHandSinceMs = -Infinity;
    }

    // Show countdown even if general hints were previously completed or disabled, so user sees why mode switches
    if (countdownStage) {
      if (countdownStage !== this.currentStage) {
        this.applyStage(countdownStage);
      }
      return;
    }

    if (!this.isEnabled || this.hasCompletedOnboarding) {
      if (this.currentStage !== 'none') {
        this.applyStage('none');
      }
      return;
    }

    const requiredHands = this.handMode === 'one-hand' ? 1 : 2;
    if (handCount >= requiredHands) {
      this.lastRequiredHandsSeenMs = nowMs;
    }

    let nextStage: HintStage;
    if (stringCount > 0) {
      nextStage = 'pluck';
    } else if (isStretching) {
      nextStage = 'release';
    } else if (handCount >= requiredHands) {
      nextStage = 'pinch';
    } else if (
      this.currentStage === 'pinch' &&
      nowMs - this.lastRequiredHandsSeenMs < HANDS_LOST_GRACE_MS
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

    const content =
      stage === 'countdown_3' || stage === 'countdown_2' || stage === 'countdown_1'
        ? COUNTDOWN_COPY[stage]
        : this.handMode === 'one-hand'
          ? ONE_HAND_COPY[stage]
          : TWO_HAND_COPY[stage];

    this.iconEl.textContent = content.icon;
    this.textEl.textContent = content.text;
    this.element.style.borderColor = content.accentBorder;
    this.element.style.boxShadow = `0 8px 28px rgba(0, 0, 0, 0.32), 0 0 18px ${content.accentGlow}`;
    this.element.style.opacity = '0.88';
    this.element.style.transform = 'translate(-50%, 0)';
  }
}
