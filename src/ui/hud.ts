import { Icons } from './icons';

export class HUD {
  private element: HTMLElement;
  private cardElement: HTMLDivElement;
  private fpsDisplay: HTMLSpanElement;
  private handsDisplay: HTMLSpanElement;
  private gestureDisplay: HTMLSpanElement;
  private stringsDisplay: HTMLSpanElement;
  private audioStatusDisplay: HTMLSpanElement;
  private lastPluckDisplay: HTMLSpanElement;
  private statusDisplay: HTMLDivElement;
  private audioBtn: HTMLButtonElement;
  private isAudioUnlocked = false;
  private isExpanded = false;
  private onToggleStateChange?: (expanded: boolean) => void;

  constructor(
    container: HTMLElement,
    onAudioUnlock?: () => void,
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
            ${Icons.activity(15)}
            <h2 class="drawer-title">System metrics</h2>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button id="hud-audio-btn" class="hud-audio-btn" type="button" data-active="false">
              ${Icons.volumeOff(13)}
              <span>Muted</span>
            </button>
            <button id="hud-close-card-btn" class="drawer-close-btn" type="button" aria-label="Close System Metrics">
              ${Icons.close(15)}
            </button>
          </div>
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
          <span class="hud-metric-key">Audio</span>
          <span id="hud-audio-status" class="hud-metric-val" style="color: var(--accent-amber);">Muted</span>
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

    this.cardElement = this.element.querySelector('#hud-card')!;
    this.fpsDisplay = this.element.querySelector('#hud-fps')!;
    this.handsDisplay = this.element.querySelector('#hud-hands')!;
    this.gestureDisplay = this.element.querySelector('#hud-gesture')!;
    this.stringsDisplay = this.element.querySelector('#hud-strings')!;
    this.audioStatusDisplay = this.element.querySelector('#hud-audio-status')!;
    this.lastPluckDisplay = this.element.querySelector('#hud-last-pluck')!;
    this.statusDisplay = this.element.querySelector('#hud-status')!;
    this.audioBtn = this.element.querySelector('#hud-audio-btn')!;
    const closeCardBtn = this.element.querySelector('#hud-close-card-btn')!;

    closeCardBtn.addEventListener('click', () => this.setCardExpanded(false));

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyD') {
        this.toggleCard();
      }
    });

    if (onAudioUnlock) {
      this.audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAudioUnlock();
      });
    }
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

  public setAudioActive(active: boolean): void {
    this.isAudioUnlocked = active;
    this.audioBtn.dataset.active = String(active);
    if (active) {
      this.audioBtn.innerHTML = `${Icons.volumeOn(13)}<span>Active</span>`;
      this.audioStatusDisplay.textContent = 'Active';
      this.audioStatusDisplay.style.color = 'var(--accent-mint)';
    } else {
      this.audioBtn.innerHTML = `${Icons.volumeOff(13)}<span>Enable</span>`;
      this.audioStatusDisplay.textContent = 'Muted';
      this.audioStatusDisplay.style.color = 'var(--accent-amber)';
    }
  }

  public updateAudioPreset(presetLabel: string): void {
    if (!this.isAudioUnlocked) return;
    this.audioStatusDisplay.textContent = `Active (${presetLabel})`;
    this.audioStatusDisplay.style.color = 'var(--accent-mint)';
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
    this.fpsDisplay.style.color =
      fps >= 30 ? 'var(--accent-mint)' : fps >= 20 ? 'var(--accent-amber)' : 'var(--accent-coral)';

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
      this.statusDisplay.textContent = 'Release pinch to anchor this string in mid-air.';
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
