import {
  AudioFxParams,
  DelayTimeDivision,
  SoundPresetId,
} from '../types/audio';
import { DELAY_TIME_OPTIONS, PRESETS } from '../audio/audio-engine';
import { Icons } from './icons';

export interface SoundStudioPanelOptions {
  onPresetChange?: (preset: SoundPresetId) => void;
  onFxChange?: (patch: Partial<AudioFxParams>) => void;
  onFxReset?: () => void;
  onClose?: () => void;
}

const PATCH_META: Record<SoundPresetId, { name: string; tag: string }> = {
  harp: { name: 'Plucked Harp', tag: 'Acoustic' },
  laser: { name: 'Laser Synth', tag: 'Sci-Fi' },
  chime: { name: 'Ambient Chime', tag: 'FM Bell' },
  retro8bit: { name: 'Retro 8-Bit', tag: 'Arcade' },
};

export class SoundStudioPanel {
  private element: HTMLElement;
  private patchButtons = new Map<SoundPresetId, HTMLButtonElement>();
  private reverbSlider: HTMLInputElement;
  private reverbValue: HTMLSpanElement;
  private delayWetSlider: HTMLInputElement;
  private delayWetValue: HTMLSpanElement;
  private delayFeedbackSlider: HTMLInputElement;
  private delayFeedbackValue: HTMLSpanElement;
  private delayTimeSelect: HTMLSelectElement;
  private fxResetBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private selectedPreset: SoundPresetId = 'harp';
  private isOpen = false;

  constructor(container: HTMLElement, options: SoundStudioPanelOptions = {}) {
    this.element = document.createElement('aside');
    this.element.id = 'sound-studio-panel';
    this.element.className = 'app-drawer studio-drawer';
    this.element.dataset.open = 'false';
    this.element.setAttribute('aria-labelledby', 'studio-title');

    const patchGridMarkup = (Object.keys(PRESETS) as SoundPresetId[])
      .map((id) => {
        const meta = PATCH_META[id];
        return `
          <button class="patch-btn" type="button" data-preset="${id}" aria-pressed="${id === this.selectedPreset}">
            <span class="patch-btn-name">${meta.name}</span>
            <span class="patch-btn-tag">${meta.tag}</span>
          </button>
        `;
      })
      .join('');

    const delayTimeOptions = DELAY_TIME_OPTIONS
      .map((d) => `<option value="${d.value}">${d.label}</option>`)
      .join('');

    this.element.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-group">
          ${Icons.sliders(17)}
          <h2 id="studio-title" class="drawer-title">Sound Studio</h2>
        </div>
        <button id="studio-close-btn" class="drawer-close-btn" type="button" aria-label="Close Sound Studio">
          ${Icons.close(17)}
        </button>
      </div>

      <div class="drawer-stack">
        <div class="drawer-section">
          <div class="section-heading-row">
            <span class="section-label">Instrument patch</span>
            <span class="section-meta">Tone.js</span>
          </div>
          <div class="patch-grid" role="group" aria-label="Instrument patch">
            ${patchGridMarkup}
          </div>
        </div>

        <div class="drawer-section">
          <div class="section-heading-row">
            <span class="section-label">Effects rack</span>
            <button id="studio-fx-reset-btn" class="ghost-btn" type="button">
              ${Icons.reset(13)}
              <span>Reset</span>
            </button>
          </div>

          <div class="fader-row">
            <label for="studio-reverb-slider" class="fader-label">
              <span>Reverb mix</span>
              <span id="studio-reverb-val" class="fader-value">30%</span>
            </label>
            <input id="studio-reverb-slider" class="studio-slider" type="range" min="0" max="100" step="1" value="30" aria-valuetext="30%" />
          </div>

          <div class="fader-row">
            <label for="studio-delay-wet-slider" class="fader-label">
              <span>Delay mix</span>
              <span id="studio-delay-wet-val" class="fader-value">12%</span>
            </label>
            <input id="studio-delay-wet-slider" class="studio-slider" type="range" min="0" max="100" step="1" value="12" aria-valuetext="12%" />
          </div>

          <div class="fader-row">
            <label for="studio-delay-feedback-slider" class="fader-label">
              <span>Delay feedback</span>
              <span id="studio-delay-feedback-val" class="fader-value">22%</span>
            </label>
            <input id="studio-delay-feedback-slider" class="studio-slider" type="range" min="0" max="85" step="1" value="22" aria-valuetext="22%" />
          </div>

          <div class="fader-row" style="margin-top: 4px; gap: 6px;">
            <label for="studio-delay-time-select" class="fader-label">
              <span>Delay time</span>
              <span class="section-meta">Tempo sync</span>
            </label>
            <select id="studio-delay-time-select" name="delayTime" class="studio-select">
              ${delayTimeOptions}
            </select>
          </div>
        </div>

        <div class="section-note">
          FX levels save automatically per patch. Use <strong>Reset</strong> anytime to restore defaults.
        </div>
      </div>
    `;

    container.appendChild(this.element);

    this.element.querySelectorAll<HTMLButtonElement>('.patch-btn').forEach((btn) => {
      const id = btn.dataset.preset as SoundPresetId;
      this.patchButtons.set(id, btn);
      btn.addEventListener('click', () => {
        if (this.selectedPreset !== id) {
          this.setSelectedPreset(id);
          if (options.onPresetChange) options.onPresetChange(id);
        }
      });
    });

    this.reverbSlider = this.element.querySelector('#studio-reverb-slider')!;
    this.reverbValue = this.element.querySelector('#studio-reverb-val')!;
    this.delayWetSlider = this.element.querySelector('#studio-delay-wet-slider')!;
    this.delayWetValue = this.element.querySelector('#studio-delay-wet-val')!;
    this.delayFeedbackSlider = this.element.querySelector('#studio-delay-feedback-slider')!;
    this.delayFeedbackValue = this.element.querySelector('#studio-delay-feedback-val')!;
    this.delayTimeSelect = this.element.querySelector('#studio-delay-time-select')!;
    this.fxResetBtn = this.element.querySelector('#studio-fx-reset-btn')!;
    this.closeBtn = this.element.querySelector('#studio-close-btn')!;

    this.syncSliderVars(this.reverbSlider);
    this.syncSliderVars(this.delayWetSlider);
    this.syncSliderVars(this.delayFeedbackSlider);

    this.closeBtn.addEventListener('click', () => {
      this.close();
      if (options.onClose) options.onClose();
    });

    this.fxResetBtn.addEventListener('click', () => {
      if (options.onFxReset) options.onFxReset();
    });

    this.reverbSlider.addEventListener('input', () => {
      const pct = Number(this.reverbSlider.value);
      this.reverbValue.textContent = `${pct}%`;
      this.syncSliderVars(this.reverbSlider);
      if (options.onFxChange) options.onFxChange({ reverbWet: pct / 100 });
    });

    this.delayWetSlider.addEventListener('input', () => {
      const pct = Number(this.delayWetSlider.value);
      this.delayWetValue.textContent = `${pct}%`;
      this.syncSliderVars(this.delayWetSlider);
      if (options.onFxChange) options.onFxChange({ delayWet: pct / 100 });
    });

    this.delayFeedbackSlider.addEventListener('input', () => {
      const pct = Number(this.delayFeedbackSlider.value);
      this.delayFeedbackValue.textContent = `${pct}%`;
      this.syncSliderVars(this.delayFeedbackSlider);
      if (options.onFxChange) options.onFxChange({ delayFeedback: pct / 100 });
    });

    this.delayTimeSelect.addEventListener('change', () => {
      if (options.onFxChange) {
        options.onFxChange({ delayTime: this.delayTimeSelect.value as DelayTimeDivision });
      }
    });

    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        if (options.onClose) options.onClose();
      }
    });
  }

  private syncSliderVars(slider: HTMLInputElement): void {
    slider.style.setProperty('--attr-min', slider.min || '0');
    slider.style.setProperty('--attr-max', slider.max || '100');
    slider.style.setProperty('--control-value', slider.value);
    slider.setAttribute('aria-valuetext', `${slider.value}%`);
  }

  public setSelectedPreset(preset: SoundPresetId): void {
    this.selectedPreset = preset;
    this.patchButtons.forEach((btn, id) => {
      btn.setAttribute('aria-pressed', String(id === preset));
    });
  }

  public setFxParams(fx: AudioFxParams): void {
    const reverbPct = Math.round(fx.reverbWet * 100);
    const delayWetPct = Math.round(fx.delayWet * 100);
    const feedbackPct = Math.round(fx.delayFeedback * 100);

    this.reverbSlider.value = String(reverbPct);
    this.reverbValue.textContent = `${reverbPct}%`;
    this.syncSliderVars(this.reverbSlider);

    this.delayWetSlider.value = String(delayWetPct);
    this.delayWetValue.textContent = `${delayWetPct}%`;
    this.syncSliderVars(this.delayWetSlider);

    this.delayFeedbackSlider.value = String(feedbackPct);
    this.delayFeedbackValue.textContent = `${feedbackPct}%`;
    this.syncSliderVars(this.delayFeedbackSlider);

    this.delayTimeSelect.value = fx.delayTime;
  }

  public open(): void {
    this.isOpen = true;
    this.element.dataset.open = 'true';
  }

  public close(): void {
    this.isOpen = false;
    this.element.dataset.open = 'false';
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
