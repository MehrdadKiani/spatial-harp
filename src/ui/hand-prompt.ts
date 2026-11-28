/**
 * Interactive 3-Step Coach Bar ("Play First, Build Second")
 * Pure Vanilla DOM & TypeScript — zero UI frameworks, zero-GC per-frame update.
 *
 * Guides first-time users through 3 live, auto-verifying actions:
 *   1. Pluck the starter string (instant audio-visual reward in 2 seconds)
 *   2. Draw your own string (pinch & hold until it pops → drag → release)
 *   3. Grab a string tip (move or resize with 1 or 2 hands)
 *
 * Always skippable via Skip button; persists completion in localStorage and can be
 * replayed anytime from the top bar `?` button.
 */

import { Icons } from './icons';

const ONBOARDING_STORAGE_KEY = 'spatial_harp_onboarding_done_v1';

type CoachStep = 'pluck' | 'draw' | 'move' | 'complete' | 'hidden';
type DrawSubstate = 'idle' | 'charging' | 'stretching';

const ANIM_PLUCK_SVG = `
<svg class="coach-svg coach-svg--pluck" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <line class="anim-string" x1="6" y1="24" x2="42" y2="24" stroke="#5ef2c2" stroke-width="2" stroke-linecap="round"/>
  <circle cx="6" cy="24" r="2.5" fill="#f4f6fa"/>
  <circle cx="42" cy="24" r="2.5" fill="#f4f6fa"/>
  <circle class="anim-finger-swipe" cx="24" cy="10" r="4.5" fill="#f4f6fa"/>
  <path class="anim-swipe-trail" d="M24 10 L24 38" stroke="rgba(244,246,250,0.28)" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"/>
</svg>`;

const ANIM_DRAW_SVG = `
<svg class="coach-svg coach-svg--draw" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <circle class="anim-charge-ring" cx="12" cy="24" r="7" stroke="#5ef2c2" stroke-width="1.8"/>
  <circle cx="12" cy="24" r="2.5" fill="#5ef2c2"/>
  <line class="anim-draw-line" x1="12" y1="24" x2="36" y2="24" stroke="#f4f6fa" stroke-width="2" stroke-linecap="round"/>
  <circle class="anim-draw-cursor" cx="12" cy="24" r="4" fill="#f4f6fa"/>
</svg>`;

const ANIM_MOVE_SVG = `
<svg class="coach-svg coach-svg--move" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <line class="anim-move-line" x1="10" y1="30" x2="36" y2="20" stroke="#5ef2c2" stroke-width="2" stroke-linecap="round"/>
  <circle cx="10" cy="30" r="2.5" fill="#f4f6fa"/>
  <g class="anim-tip-crosshair">
    <circle cx="36" cy="20" r="6" stroke="#f5a623" stroke-width="1.6"/>
    <line x1="36" y1="11" x2="36" y2="15" stroke="#f5a623" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="36" y1="25" x2="36" y2="29" stroke="#f5a623" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="27" y1="20" x2="31" y2="20" stroke="#f5a623" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="41" y1="20" x2="45" y2="20" stroke="#f5a623" stroke-width="1.6" stroke-linecap="round"/>
  </g>
</svg>`;

const ANIM_DONE_SVG = `
<svg class="coach-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <circle cx="24" cy="24" r="16" fill="rgba(94, 242, 194, 0.14)" stroke="#5ef2c2" stroke-width="2"/>
  <polyline points="17 24.5 22 29.5 32 19" stroke="#5ef2c2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export class HandPrompt {
  private element: HTMLDivElement;
  private stepEls: Record<'pluck' | 'draw' | 'move', HTMLDivElement>;
  private animSlot: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private descEl: HTMLDivElement;
  private skipBtn: HTMLButtonElement;

  private isActive = false;
  private currentStep: CoachStep = 'hidden';
  private drawSubstate: DrawSubstate = 'idle';
  private hasHandsVisible = false;
  private hideTimer: number | null = null;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'hand-camera-prompt';
    this.element.className = 'coach-card';
    this.element.setAttribute('aria-live', 'polite');
    this.element.dataset.visible = 'false';

    this.element.innerHTML = `
      <div class="coach-top-row">
        <div class="coach-steps" role="list" aria-label="Quick start steps">
          <div id="coach-step-pluck" class="coach-step" role="listitem" data-state="active">
            <span class="coach-step-badge">1</span>
            <span>Pluck</span>
          </div>
          <div id="coach-step-draw" class="coach-step" role="listitem" data-state="pending">
            <span class="coach-step-badge">2</span>
            <span>Draw string</span>
          </div>
          <div id="coach-step-move" class="coach-step" role="listitem" data-state="pending">
            <span class="coach-step-badge">3</span>
            <span>Move tip</span>
          </div>
        </div>
        <button id="coach-skip-btn" class="coach-skip-btn" type="button">Skip</button>
      </div>
      <div class="coach-body">
        <div id="coach-anim-slot" class="coach-anim-box"></div>
        <div class="coach-copy">
          <div id="coach-title" class="coach-title"></div>
          <div id="coach-desc" class="coach-desc"></div>
        </div>
      </div>
    `;

    this.stepEls = {
      pluck: this.element.querySelector('#coach-step-pluck') as HTMLDivElement,
      draw: this.element.querySelector('#coach-step-draw') as HTMLDivElement,
      move: this.element.querySelector('#coach-step-move') as HTMLDivElement,
    };
    this.animSlot = this.element.querySelector('#coach-anim-slot') as HTMLDivElement;
    this.titleEl = this.element.querySelector('#coach-title') as HTMLDivElement;
    this.descEl = this.element.querySelector('#coach-desc') as HTMLDivElement;
    this.skipBtn = this.element.querySelector('#coach-skip-btn') as HTMLButtonElement;

    this.skipBtn.addEventListener('click', () => this.skip());

    container.appendChild(this.element);
  }

  public hasCompletedOnboarding(): boolean {
    try {
      return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persistCompleted(): void {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors in private browsing
    }
  }

  public activate(forceReplay = false): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (!forceReplay && this.hasCompletedOnboarding()) {
      this.isActive = false;
      this.setStep('hidden');
      return;
    }

    this.isActive = true;
    this.drawSubstate = 'idle';
    this.setStep('pluck');
  }

  public skip(): void {
    this.isActive = false;
    this.persistCompleted();
    this.setStep('hidden');
  }

  public markPlucked(): void {
    if (!this.isActive) return;
    if (this.currentStep === 'pluck') {
      this.setStep('draw');
    }
  }

  public markStringCreated(): void {
    if (!this.isActive) return;
    if (this.currentStep === 'draw') {
      this.setStep('move');
    }
  }

  public markEndpointGrabbed(): void {
    if (!this.isActive) return;
    if (this.currentStep === 'move') {
      this.persistCompleted();
      this.setStep('complete');
      this.hideTimer = window.setTimeout(() => {
        this.isActive = false;
        this.setStep('hidden');
      }, 2400);
    }
  }

  /**
   * Zero-GC per-frame state update. Only touches DOM when visible coaching state changes.
   */
  public update(
    handCount: number,
    isCharging: boolean,
    isStretching: boolean,
    _stringCount: number,
    _nowMs: number
  ): void {
    if (!this.isActive || this.currentStep === 'hidden' || this.currentStep === 'complete') {
      return;
    }

    const handsSeen = handCount > 0;
    if (handsSeen !== this.hasHandsVisible) {
      this.hasHandsVisible = handsSeen;
      if (this.currentStep === 'pluck') {
        this.renderCopy();
      }
    }

    if (this.currentStep === 'draw') {
      const nextSub: DrawSubstate = isStretching
        ? 'stretching'
        : isCharging
          ? 'charging'
          : 'idle';
      if (nextSub !== this.drawSubstate) {
        this.drawSubstate = nextSub;
        this.renderCopy();
      }
    }
  }

  private setStep(step: CoachStep): void {
    this.currentStep = step;

    if (step === 'hidden') {
      this.element.dataset.visible = 'false';
      return;
    }

    const order: Array<'pluck' | 'draw' | 'move'> = ['pluck', 'draw', 'move'];
    const currentIdx = step === 'complete' ? 3 : order.indexOf(step);

    order.forEach((key, idx) => {
      const el = this.stepEls[key];
      const badge = el.querySelector('.coach-step-badge') as HTMLSpanElement;
      if (idx < currentIdx) {
        el.dataset.state = 'done';
        badge.innerHTML = Icons.check(11);
      } else if (idx === currentIdx) {
        el.dataset.state = 'active';
        badge.textContent = String(idx + 1);
      } else {
        el.dataset.state = 'pending';
        badge.textContent = String(idx + 1);
      }
    });

    if (step === 'pluck') {
      this.animSlot.innerHTML = ANIM_PLUCK_SVG;
    } else if (step === 'draw') {
      this.animSlot.innerHTML = ANIM_DRAW_SVG;
    } else if (step === 'move') {
      this.animSlot.innerHTML = ANIM_MOVE_SVG;
    } else {
      this.animSlot.innerHTML = ANIM_DONE_SVG;
    }

    this.skipBtn.style.display = step === 'complete' ? 'none' : 'inline-flex';
    this.renderCopy();
    this.element.dataset.visible = 'true';
  }

  private renderCopy(): void {
    if (this.currentStep === 'pluck') {
      this.titleEl.textContent = this.hasHandsVisible
        ? 'Swipe across the glowing string'
        : 'Raise your hand to the camera';
      this.descEl.textContent = this.hasHandsVisible
        ? 'Pass any fingertip through the line to hear your first note.'
        : 'Hold a hand in frame, then swipe across the glowing string.';
    } else if (this.currentStep === 'draw') {
      if (this.drawSubstate === 'charging') {
        this.titleEl.textContent = 'Hold steady…';
        this.descEl.textContent = 'Wait for the ring to pop and lock the first point.';
      } else if (this.drawSubstate === 'stretching') {
        this.titleEl.textContent = 'Drag and release!';
        this.descEl.textContent = 'Pull to your desired length, then open your fingers to anchor.';
      } else {
        this.titleEl.textContent = 'Draw your own string';
        this.descEl.textContent = 'Pinch thumb & index together, hold until it pops, then drag.';
      }
    } else if (this.currentStep === 'move') {
      this.titleEl.textContent = 'Move or resize a tip';
      this.descEl.textContent = 'Pinch any crosshair endpoint with one or both hands — or play with your other hand.';
    } else if (this.currentStep === 'complete') {
      this.titleEl.textContent = "You're ready to play";
      this.descEl.textContent = 'Use Studio to switch synth patches or tap ? anytime to replay this guide.';
    }
  }
}
