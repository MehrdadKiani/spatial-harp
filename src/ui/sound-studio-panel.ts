import { SoundPresetId, MusicalScaleId } from '../types/audio';
import { PRESETS } from '../audio/audio-engine';
import { SCALES } from '../audio/scale-mapper';

export interface SoundStudioPanelOptions {
  onPresetChange?: (preset: SoundPresetId) => void;
  onScaleChange?: (scale: MusicalScaleId) => void;
  onClose?: () => void;
}

export class SoundStudioPanel {
  private element: HTMLDivElement;
  private presetSelect: HTMLSelectElement;
  private scaleSelect: HTMLSelectElement;
  private closeBtn: HTMLButtonElement;
  private isOpen = false;

  constructor(container: HTMLElement, options: SoundStudioPanelOptions = {}) {
    this.element = document.createElement('div');
    this.element.id = 'sound-studio-panel';

    Object.assign(this.element.style, {
      position: 'absolute',
      top: '72px',
      right: '16px',
      width: '320px',
      zIndex: '30',
      background: 'rgba(10, 15, 28, 0.90)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(0, 240, 255, 0.35)',
      borderRadius: '16px',
      padding: '18px 20px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 25px rgba(0, 240, 255, 0.15)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      color: '#ffffff',
      userSelect: 'none',
      display: 'none',
      opacity: '0',
      transform: 'translateY(-8px)',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
    });

    const presetOptions = Object.values(PRESETS)
      .map((p) => `<option value="${p.id}">${p.label}</option>`)
      .join('');

    const scaleOptions = Object.values(SCALES)
      .map((s) => `<option value="${s.id}">${s.label}</option>`)
      .join('');

    this.element.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🎛️</span>
          <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.8px; color: #00f0ff; text-transform: uppercase;">Sound Studio</span>
        </div>
        <button id="studio-close-btn" style="background: transparent; border: none; color: rgba(255, 255, 255, 0.6); font-size: 18px; cursor: pointer; padding: 2px 6px; line-height: 1; border-radius: 4px; transition: color 0.2s;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 12px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="color: #00f0ff; font-weight: 600; display: flex; justify-content: space-between;">
            <span>Synthesizer Preset</span>
            <span style="color: rgba(255,255,255,0.4); font-size: 11px;">Tone.js Engine</span>
          </label>
          <select id="studio-preset-select" style="background: rgba(14, 24, 44, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 8px; color: #ffffff; font-size: 12px; padding: 8px 10px; cursor: pointer; outline: none; width: 100%;">
            ${presetOptions}
          </select>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="color: #00f0ff; font-weight: 600; display: flex; justify-content: space-between;">
            <span>Musical Scale</span>
            <span style="color: rgba(255,255,255,0.4); font-size: 11px;">Spatial Mapping</span>
          </label>
          <select id="studio-scale-select" style="background: rgba(14, 24, 44, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 8px; color: #ffffff; font-size: 12px; padding: 8px 10px; cursor: pointer; outline: none; width: 100%;">
            ${scaleOptions}
          </select>
        </div>

        <div style="margin-top: 6px; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; padding: 10px; font-size: 11px; color: rgba(255, 255, 255, 0.65); line-height: 1.4;">
          💡 Tip: Shorter strings produce higher notes; longer strings produce deeper bass notes according to the chosen scale.
        </div>
      </div>
    `;

    container.appendChild(this.element);

    this.presetSelect = this.element.querySelector('#studio-preset-select')!;
    this.scaleSelect = this.element.querySelector('#studio-scale-select')!;
    this.closeBtn = this.element.querySelector('#studio-close-btn')!;

    this.closeBtn.addEventListener('mouseenter', () => {
      this.closeBtn.style.color = '#ffffff';
    });
    this.closeBtn.addEventListener('mouseleave', () => {
      this.closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    });
    this.closeBtn.addEventListener('click', () => {
      this.close();
      if (options.onClose) options.onClose();
    });

    if (options.onPresetChange) {
      this.presetSelect.addEventListener('change', () => {
        options.onPresetChange!(this.presetSelect.value as SoundPresetId);
      });
    }

    if (options.onScaleChange) {
      this.scaleSelect.addEventListener('change', () => {
        options.onScaleChange!(this.scaleSelect.value as MusicalScaleId);
      });
    }
  }

  public setSelectedPreset(preset: SoundPresetId): void {
    this.presetSelect.value = preset;
  }

  public setSelectedScale(scale: MusicalScaleId): void {
    this.scaleSelect.value = scale;
  }

  public open(): void {
    this.isOpen = true;
    this.element.style.display = 'block';
    requestAnimationFrame(() => {
      this.element.style.opacity = '1';
      this.element.style.transform = 'translateY(0)';
    });
  }

  public close(): void {
    this.isOpen = false;
    this.element.style.opacity = '0';
    this.element.style.transform = 'translateY(-8px)';
    setTimeout(() => {
      if (!this.isOpen) {
        this.element.style.display = 'none';
      }
    }, 250);
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }
}
