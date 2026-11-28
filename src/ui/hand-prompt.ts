/**
 * Live Contextual Hand Coach Pill (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Guides first-time users step-by-step through creating and plucking their first string,
 * then automatically fades out once the first note is played.
 * Zero-GC per-frame update: only mutates DOM when the coaching stage actually changes.
 */

import { Icons } from './icons';

type HintStage = 'none' | 'show_hand' | 'pinch' | 'release' | 'pluck';

interface HintContent {
  icon: string;
  text: string;
  tone: 'neutral' | 'mint';
}

const HINT_COPY: Record<Exclude<HintStage, 'none'>, HintContent> = {
  show_hand: {
    icon: Icons.hand(17),
    text: 'Show your hand to the camera',
    tone: 'neutral',
  },
  pinch: {
    icon: Icons.pinch(17),
    text: 'Hold pinch steady until it pops, then drag to draw a string',
    tone: 'mint',
  },
  release: {
    icon: Icons.sparkle(17),
    text: 'Drag apart and release to anchor the string in air',
    tone: 'mint',
  },
  pluck: {
    icon: Icons.pluck(17),
    text: 'Swipe a fingertip across the string to play',
    tone: 'mint',
  },
};

const HANDS_LOST_GRACE_MS = 900;

export class HandPrompt {
  private element: HTMLDivElement;
  private iconEl: HTMLSpanElement;
  private textEl: HTMLSpanElement;

  private isActive = false;
  private hasCompletedOnboarding = false;
  private currentStage: HintStage = 'none';
  private lastHandSeenMs = -Infinity;

  constructor(container: HTMLElement) {
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

  public activate(): void {
    this.isActive = true;
    this.hasCompletedOnboarding = false;
    this.lastHandSeenMs = -Infinity;
    this.applyStage('show_hand');
  }

  public markPlucked(): void {
    if (this.hasCompletedOnboarding) return;
    this.hasCompletedOnboarding = true;
    this.applyStage('none');
  }

  public update(
    handCount: number,
    isStretching: boolean,
    stringCount: number,
    nowMs: number
  ): void {
    if (!this.isActive || this.hasCompletedOnboarding) {
      if (this.currentStage !== 'none') {
        this.applyStage('none');
      }
      return;
    }

    if (handCount >= 1) {
      this.lastHandSeenMs = nowMs;
    }

    let nextStage: HintStage;
    if (stringCount > 0) {
      nextStage = 'pluck';
    } else if (isStretching) {
      nextStage = 'release';
    } else if (handCount >= 1) {
      nextStage = 'pinch';
    } else if (
      this.currentStage === 'pinch' &&
      nowMs - this.lastHandSeenMs < HANDS_LOST_GRACE_MS
    ) {
      nextStage = 'pinch';
    } else {
      nextStage = 'show_hand';
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

    const content = HINT_COPY[stage];
    this.iconEl.innerHTML = content.icon;
    this.textEl.textContent = content.text;
    this.element.dataset.tone = content.tone;
    this.element.dataset.visible = 'true';
  }
}
