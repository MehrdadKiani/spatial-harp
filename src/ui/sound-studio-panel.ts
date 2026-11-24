import {
  AudioFxParams,
  DelayTimeDivision,
  MusicalScaleId,
  SoundPresetId,
} from '../types/audio';
import { DELAY_TIME_OPTIONS, PRESETS } from '../audio/audio-engine';
import { SCALES } from '../audio/scale-mapper';

export interface SoundStudioPanelOptions {
  onPresetChange?: (preset: SoundPresetId) => void;
  onScaleChange?: (scale: MusicalScaleId) => void;
  onFxChange?: (patch: Partial<AudioFxParams>) => void;
  onFxReset?: () => void;
  onClose?: () => void;
}

export class SoundStudioPanel {
  private element: HTMLDivElement;
  private presetSelect: HTMLSelectElement;
  private scaleSelect: HTMLSelectElement;
  private reverbSlider: HTMLInputElement;
  private reverbValue: HTMLSpanElement;
  private delayWetSlider: HTMLInputElement;
  private delayWetValue: HTMLSpanElement;
  private delayFeedbackSlider: HTMLInputElement;
  private delayFeedbackValue: HTMLSpanElement;
  private delayTimeSelect: HTMLSelectElement;
  private fxResetBtn: HTMLButtonElement;
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
      maxHeight: 'calc(100dvh - 96px)',
      overflowY: 'auto',
      zIndex: '30',
      background: 'rgba(10, 15, 28, 0.90)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(0, 240, 255, 0.35)',
      borderRadius: '16px',
      padding: '18px 20px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 25px rgba(0, 240, 255, 0.15)',
      fontFamily: 'var(--font-primary)',
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

    const delayTimeOptions = DELAY_TIME_OPTIONS
      .map((d) => `<option value="${d.value}">${d.label}</option>`)
      .join('');

    this.element.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🎹</span>
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

        <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 12px; margin-top: 2px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="color: #00f0ff; font-weight: 600; letter-spacing: 0.4px;">Effects Rack (FX)</span>
            <button id="studio-fx-reset-btn" style="background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.35); border-radius: 6px; color: #00f0ff; font-family: inherit; font-size: 10px; font-weight: 600; padding: 3px 8px; cursor: pointer; transition: background 0.2s;">Reset FX</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label for="studio-reverb-slider" style="display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.85);">
              <span>Reverb Mix</span>
              <span id="studio-reverb-val" style="color: #00f0ff; font-weight: 600;">30%</span>
            </label>
            <input id="studio-reverb-slider" type="range" min="0" max="100" step="1" value="30" style="width: 100%; accent-color: #00f0ff; cursor: pointer;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label for="studio-delay-wet-slider" style="display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.85);">
              <span>Delay Mix</span>
              <span id="studio-delay-wet-val" style="color: #00f0ff; font-weight: 600;">12%</span>
            </label>
            <input id="studio-delay-wet-slider" type="range" min="0" max="100" step="1" value="12" style="width: 100%; accent-color: #00f0ff; cursor: pointer;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label for="studio-delay-feedback-slider" style="display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.85);">
              <span>Delay Feedback</span>
              <span id="studio-delay-feedback-val" style="color: #00f0ff; font-weight: 600;">22%</span>
            </label>
            <input id="studio-delay-feedback-slider" type="range" min="0" max="85" step="1" value="22" style="width: 100%; accent-color: #00f0ff; cursor: pointer;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label for="studio-delay-time-select" style="display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.85);">
              <span>Delay Time</span>
              <span style="color: rgba(255,255,255,0.4); font-size: 10px;">Tempo Sync</span>
            </label>
            <select id="studio-delay-time-select" style="background: rgba(14, 24, 44, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 8px; color: #ffffff; font-size: 11px; padding: 6px 8px; cursor: pointer; outline: none; width: 100%;">
              ${delayTimeOptions}
            </select>
          </div>
        </div>

        <div style="margin-top: 4px; background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; padding: 10px; font-size: 11px; color: rgba(255, 255, 255, 0.65); line-height: 1.4;">
          💡 Tip: FX tweaks are saved per preset. Use <strong>Reset FX</strong> anytime to restore the preset's factory defaults.
        </div>
      </div>
    `;

    container.appendChild(this.element);

    this.presetSelect = this.element.querySelector('#studio-preset-select')!;
    this.scaleSelect = this.element.querySelector('#studio-scale-select')!;
    this.reverbSlider = this.element.querySelector('#studio-reverb-slider')!;
    this.reverbValue = this.element.querySelector('#studio-reverb-val')!;
    this.delayWetSlider = this.element.querySelector('#studio-delay-wet-slider')!;
    this.delayWetValue = this.element.querySelector('#studio-delay-wet-val')!;
    this.delayFeedbackSlider = this.element.querySelector('#studio-delay-feedback-slider')!;
    this.delayFeedbackValue = this.element.querySelector('#studio-delay-feedback-val')!;
    this.delayTimeSelect = this.element.querySelector('#studio-delay-time-select')!;
    this.fxResetBtn = this.element.querySelector('#studio-fx-reset-btn')!;
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

    this.fxResetBtn.addEventListener('mouseenter', () => {
      this.fxResetBtn.style.background = 'rgba(0, 240, 255, 0.22)';
    });
    this.fxResetBtn.addEventListener('mouseleave', () => {
      this.fxResetBtn.style.background = 'rgba(0, 240, 255, 0.1)';
    });
    this.fxResetBtn.addEventListener('click', () => {
      if (options.onFxReset) options.onFxReset();
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

    this.reverbSlider.addEventListener('input', () => {
      const pct = Number(this.reverbSlider.value);
      this.reverbValue.textContent = `${pct}%`;
      if (options.onFxChange) options.onFxChange({ reverbWet: pct / 100 });
    });

    this.delayWetSlider.addEventListener('input', () => {
      const pct = Number(this.delayWetSlider.value);
      this.delayWetValue.textContent = `${pct}%`;
      if (options.onFxChange) options.onFxChange({ delayWet: pct / 100 });
    });

    this.delayFeedbackSlider.addEventListener('input', () => {
      const pct = Number(this.delayFeedbackSlider.value);
      this.delayFeedbackValue.textContent = `${pct}%`;
      if (options.onFxChange) options.onFxChange({ delayFeedback: pct / 100 });
    });

    this.delayTimeSelect.addEventListener('change', () => {
      if (options.onFxChange) {
        options.onFxChange({ delayTime: this.delayTimeSelect.value as DelayTimeDivision });
      }
    });
  }

  public setSelectedPreset(preset: SoundPresetId): void {
    this.presetSelect.value = preset;
  }

  public setSelectedScale(scale: MusicalScaleId): void {
    this.scaleSelect.value = scale;
  }

  public setFxParams(fx: AudioFxParams): void {
    const reverbPct = Math.round(fx.reverbWet * 100);
    const delayWetPct = Math.round(fx.delayWet * 100);
    const feedbackPct = Math.round(fx.delayFeedback * 100);

    this.reverbSlider.value = String(reverbPct);
    this.reverbValue.textContent = `${reverbPct}%`;

    this.delayWetSlider.value = String(delayWetPct);
    this.delayWetValue.textContent = `${delayWetPct}%`;

    this.delayFeedbackSlider.value = String(feedbackPct);
    this.delayFeedbackValue.textContent = `${feedbackPct}%`;

    this.delayTimeSelect.value = fx.delayTime;
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
