import { SoundPresetId, MusicalScaleId } from '../types/audio';
import { PRESETS } from '../audio/audio-engine';
import { SCALES } from '../audio/scale-mapper';

export class HUD {
  private element: HTMLDivElement;
  private fpsDisplay: HTMLSpanElement;
  private handsDisplay: HTMLSpanElement;
  private gestureDisplay: HTMLSpanElement;
  private stringsDisplay: HTMLSpanElement;
  private audioStatusDisplay: HTMLSpanElement;
  private lastPluckDisplay: HTMLSpanElement;
  private statusDisplay: HTMLDivElement;
  private audioBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private presetSelect: HTMLSelectElement;
  private scaleSelect: HTMLSelectElement;
  private isAudioUnlocked = false;

  constructor(
    container: HTMLElement,
    onClear?: () => void,
    onAudioUnlock?: () => void,
    onPresetChange?: (preset: SoundPresetId) => void,
    onScaleChange?: (scale: MusicalScaleId) => void
  ) {
    this.element = document.createElement('div');
    this.element.id = 'hud-overlay';

    Object.assign(this.element.style, {
      position: 'absolute',
      top: '16px',
      left: '16px',
      zIndex: '10',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      fontSize: '13px',
      pointerEvents: 'none',
      userSelect: 'none',
    });

    const presetOptions = Object.values(PRESETS)
      .map((p) => `<option value="${p.id}">${p.label}</option>`)
      .join('');

    const scaleOptions = Object.values(SCALES)
      .map((s) => `<option value="${s.id}">${s.label}</option>`)
      .join('');

    this.element.innerHTML = `
      <div style="background: rgba(10, 15, 25, 0.88); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 12px 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4); min-width: 310px; max-width: 360px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px; color: #00ffaa; text-transform: uppercase;">Spatial Laser Harp</span>
          <div style="display: flex; gap: 6px;">
            <button id="hud-audio-btn" style="background: rgba(255, 170, 0, 0.2); border: 1px solid rgba(255, 170, 0, 0.4); color: #ffbb33; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 600; cursor: pointer; pointer-events: auto; transition: background 0.2s;">🔇 Audio: Click to Enable</button>
            <span style="background: rgba(0, 255, 170, 0.15); color: #00ffaa; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 600;">STEP 7</span>
          </div>
        </div>

        <!-- Instrument Settings Controls -->
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 11px;">
          <label style="color: #00f0ff; font-weight: 600;">Preset:</label>
          <select id="hud-preset-select" style="background: rgba(10, 20, 35, 0.9); border: 1px solid rgba(0, 240, 255, 0.35); border-radius: 4px; color: #ffffff; font-size: 11px; padding: 3px 6px; cursor: pointer; pointer-events: auto; outline: none; width: 100%;">
            ${presetOptions}
          </select>
          <label style="color: #00f0ff; font-weight: 600;">Scale:</label>
          <select id="hud-scale-select" style="background: rgba(10, 20, 35, 0.9); border: 1px solid rgba(0, 240, 255, 0.35); border-radius: 4px; color: #ffffff; font-size: 11px; padding: 3px 6px; cursor: pointer; pointer-events: auto; outline: none; width: 100%;">
            ${scaleOptions}
          </select>
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
          <span id="hud-audio-status" style="font-weight: 600; color: #ffaa00;">Muted (Click anywhere)</span>
          <span>Last Pluck:</span>
          <span id="hud-last-pluck" style="font-weight: 600; color: #00ffff;">--</span>
        </div>

        <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px;">
          <div id="hud-status" style="font-size: 12px; color: #9ab; flex: 1; padding-right: 8px;">
            Pinch thumb & index on both hands to stretch a string
          </div>
          <button id="hud-clear-btn" style="background: rgba(255, 68, 68, 0.18); border: 1px solid rgba(255, 68, 68, 0.35); color: #ff8888; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer; pointer-events: auto; white-space: nowrap; transition: background 0.2s;">
            Clear [C]
          </button>
        </div>
      </div>
    `;

    container.appendChild(this.element);

    this.fpsDisplay = this.element.querySelector('#hud-fps')!;
    this.handsDisplay = this.element.querySelector('#hud-hands')!;
    this.gestureDisplay = this.element.querySelector('#hud-gesture')!;
    this.stringsDisplay = this.element.querySelector('#hud-strings')!;
    this.audioStatusDisplay = this.element.querySelector('#hud-audio-status')!;
    this.lastPluckDisplay = this.element.querySelector('#hud-last-pluck')!;
    this.statusDisplay = this.element.querySelector('#hud-status')!;
    this.audioBtn = this.element.querySelector('#hud-audio-btn')!;
    this.clearBtn = this.element.querySelector('#hud-clear-btn')!;
    this.presetSelect = this.element.querySelector('#hud-preset-select')!;
    this.scaleSelect = this.element.querySelector('#hud-scale-select')!;

    if (onClear) {
      this.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClear();
      });
    }

    if (onAudioUnlock) {
      this.audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAudioUnlock();
      });
    }

    if (onPresetChange) {
      this.presetSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        const selected = this.presetSelect.value as SoundPresetId;
        onPresetChange(selected);
        this.updateAudioStatusText();
      });
    }

    if (onScaleChange) {
      this.scaleSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        const selected = this.scaleSelect.value as MusicalScaleId;
        onScaleChange(selected);
      });
    }

    this.clearBtn.addEventListener('mouseenter', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.35)';
    });
    this.clearBtn.addEventListener('mouseleave', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.18)';
    });
  }

  public setAudioActive(active: boolean): void {
    this.isAudioUnlocked = active;
    if (active) {
      this.audioBtn.textContent = '🔊 Audio: Active';
      this.audioBtn.style.background = 'rgba(0, 255, 170, 0.2)';
      this.audioBtn.style.borderColor = 'rgba(0, 255, 170, 0.4)';
      this.audioBtn.style.color = '#00ffaa';
      this.updateAudioStatusText();
    } else {
      this.audioBtn.textContent = '🔇 Audio: Click to Enable';
      this.audioBtn.style.background = 'rgba(255, 170, 0, 0.2)';
      this.audioBtn.style.borderColor = 'rgba(255, 170, 0, 0.4)';
      this.audioBtn.style.color = '#ffbb33';
      this.audioStatusDisplay.textContent = 'Muted (Click anywhere)';
      this.audioStatusDisplay.style.color = '#ffaa00';
    }
  }

  private updateAudioStatusText(): void {
    if (!this.isAudioUnlocked) return;
    const presetId = this.presetSelect.value as SoundPresetId;
    const presetLabel = PRESETS[presetId]?.label || 'Active';
    this.audioStatusDisplay.textContent = `Ready (${presetLabel})`;
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
    isGrabbingEndpoint: boolean = false
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
      this.gestureDisplay.textContent = 'Grabbing String Tip';
      this.gestureDisplay.style.color = '#ffdd00';
      this.statusDisplay.textContent = '🎯 Dragging string endpoint — move hand to reposition, release to lock';
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
