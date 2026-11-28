/**
 * Live Contextual Hand Coach Pill (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Guides first-time users step-by-step through the core loop without blocking the camera.
 * Zero-GC per-frame update: only mutates DOM when the coaching stage actually changes.
 */

import { HandInteractionMode } from '../types/instruments';
import { Icons } from './icons';

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
  tone: 'neutral' | 'mint' | 'amber';
}

const ONE_HAND_COPY: Record<'show_hands' | 'pinch' | 'release' | 'pluck', HintContent> = {
  show_hands: {
    icon: Icons.hand(16),
    text: 'Show your hand to the camera',
    tone: 'neutral',
  },
  pinch: {
    icon: Icons.pinch(16),
    text: 'Hold pinch steady until it pops, then drag to draw a string',
    tone: 'mint',
  },
  release: {
    icon: Icons.sparkle(16),
    text: 'Drag apart and release to anchor the string in air',
    tone: 'mint',
  },
  pluck: {
    icon: Icons.pluck(16),
    text: 'Swipe a fingertip across the string to play',
    tone: 'mint',
  },
};

const TWO_HAND_COPY: Record<'show_hands' | 'pinch' | 'release' | 'pluck', HintContent> = {
  show_hands: {
    icon: Icons.hands(16),
    text: 'Show both hands to the camera',
    tone: 'neutral',
  },
  pinch: {
    icon: Icons.pinch(16),
    text: 'Hold pinch on both hands until it pops to create a string',
    tone: 'mint',
  },
  release: {
    icon: Icons.sparkle(16),
    text: 'Stretch apart and release to anchor the string in air',
    tone: 'mint',
  },
  pluck: {
    icon: Icons.pluck(16),
    text: 'Swipe a fingertip across the string to play',
    tone: 'mint',
  },
};

const COUNTDOWN_COPY: Record<'countdown_3' | 'countdown_2' | 'countdown_1', HintContent> = {
  countdown_3: {
    icon: Icons.clock(16),
    text: 'One hand detected — switching to One-Hand mode in 3...',
    tone: 'amber',
  },
  countdown_2: {
    icon: Icons.clock(16),
    text: 'One hand detected — switching to One-Hand mode in 2...',
    tone: 'amber',
  },
  countdown_1: {
    icon: Icons.clock(16),
    text: 'One hand detected — switching to One-Hand mode in 1...',
    tone: 'mint',
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
    this.element.dataset.visible = 'false';
    this.element.dataset.tone = 'neutral';

    this.iconEl = document.createElement('span');
    this.iconEl.className = 'prompt-icon';

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

  public activate(): void {
    this.isActive = true;
    this.hasCompletedOnboarding = false;
    this.lastRequiredHandsSeenMs = -Infinity;
    this.singleHandSinceMs = -Infinity;
    if (this.isEnabled) {
      this.applyStage('show_hands');
    }
  }

  public markPlucked(): void {
    if (this.hasCompletedOnboarding) return;
    this.hasCompletedOnboarding = true;
    this.singleHandSinceMs = -Infinity;
    this.applyStage('none');
  }

  public update(
    handCount: number,
    isStretching: boolean,
    stringCount: number,
    nowMs: number
  ): void {
    if (!this.isActive) return;

    let countdownStage: 'countdown_3' | 'countdown_2' | 'countdown_1' | null = null;

    if (this.handMode === 'two-hand' && stringCount === 0 && !isStretching && handCount === 1) {
      if (this.singleHandSinceMs === -Infinity) {
        this.singleHandSinceMs = nowMs;
      }
      const elapsedSingleMs = nowMs - this.singleHandSinceMs;
      if (elapsedSingleMs >= SINGLE_HAND_DETECT_MS + COUNTDOWN_DURATION_MS) {
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
      this.element.dataset.visible = 'false';
      return;
    }

    const content =
      stage === 'countdown_3' || stage === 'countdown_2' || stage === 'countdown_1'
        ? COUNTDOWN_COPY[stage]
        : this.handMode === 'one-hand'
          ? ONE_HAND_COPY[stage]
          : TWO_HAND_COPY[stage];

    this.iconEl.innerHTML = content.icon;
    this.textEl.textContent = content.text;
    this.element.dataset.tone = content.tone;
    this.element.dataset.visible = 'true';
  }
}
