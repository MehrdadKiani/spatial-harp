import { Icons } from './icons';

export class HUD {
  private element: HTMLElement;
  private cardElement: HTMLDivElement;
  private fpsDisplay: HTMLSpanElement;
  private fpsBadge: HTMLButtonElement;
  private fpsBadgeValue: HTMLSpanElement;
  private lastBadgeFps = -1;
  private handsDisplay: HTMLSpanElement;
  private gestureDisplay: HTMLSpanElement;
  private stringsDisplay: HTMLSpanElement;
  private lastPluckDisplay: HTMLSpanElement;
  private statusDisplay: HTMLDivElement;
  private isExpanded = false;
  private onToggleStateChange?: (expanded: boolean) => void;

  constructor(
    container: HTMLElement,
    onToggleStateChange?: (expanded: boolean) => void
  ) {
    this.onToggleStateChange = onToggleStateChange;
    this.element = document.createElement('aside');
    this.element.id = 'hud-overlay';
    this.element.setAttribute('aria-label', 'System Metrics');

    this.element.innerHTML = `
      <div id="hud-card" class="app-drawer" data-open="false">
        <div class="drawer-header" style="margin-bottom: 12px; padding-bottom: 10px;">
          <div class="drawer-title-group">
            ${Icons.activity(16)}
            <h2 class="drawer-title">System metrics</h2>
          </div>
          <button id="hud-close-card-btn" class="drawer-close-btn" type="button" aria-label="Close System Metrics">
            ${Icons.close(16)}
          </button>
        </div>

        <div class="hud-metrics-grid">
          <span class="hud-metric-key">Frame rate</span>
          <span id="hud-fps" class="hud-metric-val">--</span>
          <span class="hud-metric-key">Hands</span>
          <span id="hud-hands" class="hud-metric-val">Searching...</span>
          <span class="hud-metric-key">Gesture</span>
          <span id="hud-gesture" class="hud-metric-val">None</span>
          <span class="hud-metric-key">Strings</span>
          <span id="hud-strings" class="hud-metric-val">0 / 12</span>
          <span class="hud-metric-key">Last pluck</span>
          <span id="hud-last-pluck" class="hud-metric-val">--</span>
          <span class="hud-metric-key">Version</span>
          <span id="hud-version" class="hud-metric-val" style="color: var(--text-muted);">v${__APP_VERSION__}</span>
        </div>

        <div class="hud-status-bar">
          <div id="hud-status" aria-live="polite">
            Hold pinch steady to draw a string in mid-air.
          </div>
        </div>
      </div>
    `;

    container.appendChild(this.element);

    // Always-visible bottom-left FPS pill (balances bottom-right About/version pill)
    this.fpsBadge = document.createElement('button');
    this.fpsBadge.type = 'button';
    this.fpsBadge.id = 'app-fps-badge';
    this.fpsBadge.dataset.tier = 'idle';
    this.fpsBadge.title = 'Live frame rate — click to toggle System Metrics [D]';
    this.fpsBadge.setAttribute('aria-label', 'Live frame rate');
    this.fpsBadge.innerHTML = `<span class="fps-badge-dot" aria-hidden="true"></span><span id="app-fps-badge-val">-- FPS</span>`;
    this.fpsBadgeValue = this.fpsBadge.querySelector('#app-fps-badge-val') as HTMLSpanElement;
    this.fpsBadge.addEventListener('click', () => this.toggleCard());
    container.appendChild(this.fpsBadge);

    this.cardElement = this.element.querySelector('#hud-card')!;
    this.fpsDisplay = this.element.querySelector('#hud-fps')!;
    this.handsDisplay = this.element.querySelector('#hud-hands')!;
    this.gestureDisplay = this.element.querySelector('#hud-gesture')!;
    this.stringsDisplay = this.element.querySelector('#hud-strings')!;
    this.lastPluckDisplay = this.element.querySelector('#hud-last-pluck')!;
    this.statusDisplay = this.element.querySelector('#hud-status')!;
    const closeCardBtn = this.element.querySelector('#hud-close-card-btn')!;

    closeCardBtn.addEventListener('click', () => this.setCardExpanded(false));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyD') {
        this.toggleCard();
      }
    });
  }

  public toggleCard(): void {
    this.setCardExpanded(!this.isExpanded);
  }

  public setCardExpanded(expanded: boolean): void {
    this.isExpanded = expanded;
    this.cardElement.dataset.open = String(expanded);
    if (this.onToggleStateChange) {
      this.onToggleStateChange(expanded);
    }
  }

  public getIsExpanded(): boolean {
    return this.isExpanded;
  }

  public setLastPluck(note: string, velocity: number): void {
    const pct = Math.round(velocity * 100);
    this.lastPluckDisplay.textContent = `${note} (${pct}%)`;
    this.lastPluckDisplay.style.color = 'var(--accent-mint)';

    setTimeout(() => {
      if (this.lastPluckDisplay) {
        this.lastPluckDisplay.style.color = 'var(--text-primary)';
      }
    }, 180);
  }

  public update(
    fps: number,
    handsCount: number,
    handDetails: string[],
    isDualPinching: boolean,
    singlePinchHand: string | null,
    stringsCount: number,
    maxStrings: number,
    isGrabbingEndpoint: boolean = false,
    grabbedStringNote: string | null = null
  ): void {
    this.fpsDisplay.textContent = `${fps} fps`;
    const fpsTier = fps >= 30 ? 'good' : fps >= 20 ? 'warn' : 'low';
    this.fpsDisplay.style.color =
      fpsTier === 'good' ? 'var(--accent-mint)' : fpsTier === 'warn' ? 'var(--accent-amber)' : 'var(--accent-coral)';

    if (fps !== this.lastBadgeFps) {
      this.lastBadgeFps = fps;
      this.fpsBadgeValue.textContent = `${fps} FPS`;
      this.fpsBadge.dataset.tier = fpsTier;
    }

    this.stringsDisplay.textContent = `${stringsCount} / ${maxStrings}`;
    this.stringsDisplay.style.color = stringsCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)';

    if (handsCount === 0) {
      this.handsDisplay.textContent = 'None';
      this.handsDisplay.style.color = 'var(--accent-coral)';
      this.gestureDisplay.textContent = 'Idle';
      this.gestureDisplay.style.color = 'var(--text-muted)';
      this.statusDisplay.textContent = stringsCount > 0
        ? `${stringsCount} string(s) ready to pluck. Raise a hand to play or add more.`
        : 'Raise your hand in front of the camera.';
      return;
    }

    this.handsDisplay.textContent = `${handsCount} (${handDetails.join(', ')})`;
    this.handsDisplay.style.color = 'var(--accent-mint)';

    if (isGrabbingEndpoint) {
      const pitchLabel = grabbedStringNote ? ` · ${grabbedStringNote}` : '';
      this.gestureDisplay.textContent = `Resizing${pitchLabel}`;
      this.gestureDisplay.style.color = 'var(--accent-amber)';
      this.statusDisplay.textContent = `Dragging string anchor${pitchLabel} — stretch or shrink to tune, release to lock.`;
    } else if (isDualPinching) {
      this.gestureDisplay.textContent = 'Dual pinch';
      this.gestureDisplay.style.color = 'var(--accent-mint)';
      this.statusDisplay.textContent = 'Pinching with both hands.';
    } else if (singlePinchHand) {
      this.gestureDisplay.textContent = `Pinch (${singlePinchHand})`;
      this.gestureDisplay.style.color = 'var(--accent-amber)';
      this.statusDisplay.textContent = stringsCount > 0
        ? 'Pinch a string anchor to move it, or hold pinch steady to draw a new string.'
        : 'Hold pinch steady until it pops, then drag to draw a string.';
    } else {
      this.gestureDisplay.textContent = 'Open hand';
      this.gestureDisplay.style.color = 'var(--accent-mint)';
      this.statusDisplay.textContent = stringsCount > 0
        ? `Swipe fingertips across any string to play (${stringsCount} active).`
        : 'Hold pinch steady to draw your first string.';
    }
  }

  public setMessage(msg: string): void {
    this.statusDisplay.textContent = msg;
  }
}
