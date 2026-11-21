export class HUD {
  private element: HTMLDivElement;
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
    this.element = document.createElement('div');
    this.element.id = 'hud-overlay';

    Object.assign(this.element.style, {
      position: 'absolute',
      top: '72px',
      left: '16px',
      zIndex: '15',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      fontSize: '12px',
      userSelect: 'none',
      pointerEvents: 'none',
    });

    this.element.innerHTML = `
      <!-- Diagnostics HUD Card (Hidden by default, toggled via NavBar) -->
      <div id="hud-card" style="
        display: none;
        background: rgba(10, 15, 25, 0.92);
        backdrop-filter: blur(12px);
        WebkitBackdropFilter: blur(12px);
        border: 1px solid rgba(0, 240, 255, 0.28);
        border-radius: 12px;
        padding: 14px 16px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 240, 255, 0.12);
        min-width: 290px;
        max-width: 340px;
        pointer-events: auto;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 6px;">
          <span style="font-weight: 700; font-size: 12px; letter-spacing: 0.8px; color: #00ffaa; text-transform: uppercase;">System Metrics</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button id="hud-audio-btn" style="background: rgba(255, 170, 0, 0.2); border: 1px solid rgba(255, 170, 0, 0.4); color: #ffbb33; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.2s;">🔇 Audio</button>
            <button id="hud-close-card-btn" style="background: transparent; border: none; color: rgba(255, 255, 255, 0.5); font-size: 14px; cursor: pointer; padding: 0 4px; line-height: 1;">✕</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; color: #b0c4de;">
          <span>FPS:</span>
          <span id="hud-fps" style="font-weight: 600; color: #ffffff;">--</span>
          <span>Hands:</span>
          <span id="hud-hands" style="font-weight: 600; color: #ffffff;">Searching...</span>
          <span>Gesture:</span>
          <span id="hud-gesture" style="font-weight: 600; color: #ffffff;">None</span>
          <span>Strings:</span>
          <span id="hud-strings" style="font-weight: 600; color: #00f0ff;">0 / 12</span>
          <span>Audio:</span>
          <span id="hud-audio-status" style="font-weight: 600; color: #ffaa00;">Muted</span>
          <span>Last Pluck:</span>
          <span id="hud-last-pluck" style="font-weight: 600; color: #00ffff;">--</span>
        </div>

        <div style="margin-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px;">
          <div id="hud-status" style="font-size: 11px; color: #9ab; line-height: 1.3;">
            Pinch thumb & index on both hands to stretch a string
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
    this.cardElement.style.display = expanded ? 'block' : 'none';
    if (this.onToggleStateChange) {
      this.onToggleStateChange(expanded);
    }
  }

  public getIsExpanded(): boolean {
    return this.isExpanded;
  }

  public setAudioActive(active: boolean): void {
    this.isAudioUnlocked = active;
    if (active) {
      this.audioBtn.textContent = '🔊 Active';
      this.audioBtn.style.background = 'rgba(0, 255, 170, 0.2)';
      this.audioBtn.style.borderColor = 'rgba(0, 255, 170, 0.4)';
      this.audioBtn.style.color = '#00ffaa';
      this.audioStatusDisplay.textContent = 'Active';
      this.audioStatusDisplay.style.color = '#00ffaa';
    } else {
      this.audioBtn.textContent = '🔇 Enable';
      this.audioBtn.style.background = 'rgba(255, 170, 0, 0.2)';
      this.audioBtn.style.borderColor = 'rgba(255, 170, 0, 0.4)';
      this.audioBtn.style.color = '#ffbb33';
      this.audioStatusDisplay.textContent = 'Muted';
      this.audioStatusDisplay.style.color = '#ffaa00';
    }
  }

  public updateAudioPreset(presetLabel: string): void {
    if (!this.isAudioUnlocked) return;
    this.audioStatusDisplay.textContent = `Active (${presetLabel})`;
    this.audioStatusDisplay.style.color = '#00ffaa';
  }

  public setLastPluck(note: string, velocity: number): void {
    const pct = Math.round(velocity * 100);
    this.lastPluckDisplay.textContent = `${note} (${pct}%)`;
    this.lastPluckDisplay.style.color = '#ffffff';

    // Flash cyan on pluck
    setTimeout(() => {
      if (this.lastPluckDisplay) {
        this.lastPluckDisplay.style.color = '#00f0ff';
      }
    }, 150);
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
    this.fpsDisplay.textContent = `${fps}`;
    this.fpsDisplay.style.color = fps >= 30 ? '#00ffaa' : fps >= 20 ? '#ffaa00' : '#ff4444';

    this.stringsDisplay.textContent = `${stringsCount} / ${maxStrings}`;
    this.stringsDisplay.style.color = stringsCount > 0 ? '#00f0ff' : '#8899aa';

    if (handsCount === 0) {
      this.handsDisplay.textContent = 'None detected';
      this.handsDisplay.style.color = '#ff6666';
      this.gestureDisplay.textContent = 'None';
      this.statusDisplay.textContent = stringsCount > 0
        ? `${stringsCount} string(s) ready to pluck! Raise hands to play or stretch more.`
        : 'Raise your hands in front of the camera';
      return;
    }

    this.handsDisplay.textContent = `${handsCount} (${handDetails.join(', ')})`;
    this.handsDisplay.style.color = '#00ffaa';

    if (isGrabbingEndpoint) {
      const pitchLabel = grabbedStringNote ? ` → Note: ${grabbedStringNote}` : '';
      this.gestureDisplay.textContent = `Resizing String${pitchLabel}`;
      this.gestureDisplay.style.color = '#ffdd00';
      this.statusDisplay.textContent = `🎯 Dragging string endpoint${pitchLabel} — stretch/shrink to tune pitch, release to lock`;
    } else if (isDualPinching) {
      this.gestureDisplay.textContent = 'Dual Pinch (Stretching)';
      this.gestureDisplay.style.color = '#00ffff';
      this.statusDisplay.textContent = '⚡ Release pinch to anchor this string in mid-air!';
    } else if (singlePinchHand) {
      this.gestureDisplay.textContent = `Pinch (${singlePinchHand})`;
      this.gestureDisplay.style.color = '#ffcc00';
      this.statusDisplay.textContent = stringsCount > 0
        ? 'Pinch near any string tip to grab & move it, or pinch other hand to add a string'
        : 'Pinch with other hand to connect the laser string';
    } else {
      this.gestureDisplay.textContent = 'Open Hand (Plucking)';
      this.gestureDisplay.style.color = '#00ffaa';
      this.statusDisplay.textContent = stringsCount > 0
        ? `🎶 Swipe fingertips across the strings to play! (${stringsCount} strings active)`
        : 'Pinch thumb & index finger on both hands to stretch a string';
    }
  }

  public setMessage(msg: string): void {
    this.statusDisplay.textContent = msg;
  }
}
