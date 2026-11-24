import { HandInteractionMode } from '../types/instruments';
import { PitchMode } from '../types/audio';
import { PerformanceMode, PerformanceTier } from '../core/performance';

export interface SettingsPanelOptions {
  initialHandMode?: HandInteractionMode;
  initialPitchMode?: PitchMode;
  initialPerformanceMode?: PerformanceMode;
  activePerformanceTier?: PerformanceTier;
  initialShowLiveHints?: boolean;
  onHandModeChange?: (mode: HandInteractionMode) => void;
  onPitchModeChange?: (mode: PitchMode) => void;
  onPerformanceModeChange?: (mode: PerformanceMode) => void;
  onShowLiveHintsChange?: (enabled: boolean) => void;
  onClose?: () => void;
}

export class SettingsPanel {
  private element: HTMLDivElement;
  private oneHandBtn: HTMLButtonElement;
  private twoHandBtn: HTMLButtonElement;
  private modeDescEl: HTMLDivElement;
  private frettedBtn: HTMLButtonElement;
  private classicBtn: HTMLButtonElement;
  private pitchDescEl: HTMLDivElement;
  private perfAutoBtn: HTMLButtonElement;
  private perfMobileBtn: HTMLButtonElement;
  private perfHighBtn: HTMLButtonElement;
  private perfDescEl: HTMLDivElement;
  private hintsCheckbox: HTMLInputElement;
  private closeBtn: HTMLButtonElement;
  private currentMode: HandInteractionMode;
  private currentPitchMode: PitchMode;
  private currentPerformanceMode: PerformanceMode;
  private activePerformanceTier: PerformanceTier;
  private perfReloadRequired = false;
  private isOpen = false;

  constructor(container: HTMLElement, options: SettingsPanelOptions = {}) {
    this.currentMode = options.initialHandMode ?? 'one-hand';
    this.currentPitchMode = options.initialPitchMode ?? (this.currentMode === 'one-hand' ? 'fretted' : 'length');
    this.currentPerformanceMode = options.initialPerformanceMode ?? 'auto';
    this.activePerformanceTier = options.activePerformanceTier ?? 'high';

    this.element = document.createElement('div');
    this.element.id = 'settings-panel';

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
      fontFamily: 'var(--font-primary)',
      color: '#ffffff',
      userSelect: 'none',
      display: 'none',
      opacity: '0',
      transform: 'translateY(-8px)',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
    });

    this.element.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">⚙️</span>
          <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.8px; color: #00f0ff; text-transform: uppercase;">Settings & Accessibility</span>
        </div>
        <button id="settings-close-btn" style="background: transparent; border: none; color: rgba(255, 255, 255, 0.6); font-size: 18px; cursor: pointer; padding: 2px 6px; line-height: 1; border-radius: 4px; transition: color 0.2s;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 12px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="color: #00f0ff; font-weight: 600; display: flex; justify-content: space-between;">
            <span>Hand Mode</span>
            <span style="color: rgba(255,255,255,0.45); font-size: 11px;">String Creation</span>
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="settings-mode-one" type="button" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px; border-radius: 9px; font-family: var(--font-primary); font-size: 12px; font-weight: 700; cursor: pointer; outline: none; transition: all 0.2s ease;">
              <span>✋</span><span>One-Hand</span>
            </button>
            <button id="settings-mode-two" type="button" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px; border-radius: 9px; font-family: var(--font-primary); font-size: 12px; font-weight: 700; cursor: pointer; outline: none; transition: all 0.2s ease;">
              <span>👐</span><span>Two-Hand</span>
            </button>
          </div>
          <div id="settings-mode-desc" style="background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; padding: 9px 10px; font-size: 11px; color: rgba(255, 255, 255, 0.72); line-height: 1.45;"></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px;">
          <label style="color: #00f0ff; font-weight: 600; display: flex; justify-content: space-between;">
            <span>String Pitch Mode</span>
            <span style="color: rgba(255,255,255,0.45); font-size: 11px;">Note Mapping</span>
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button id="settings-pitch-fretted" type="button" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px; border-radius: 9px; font-family: var(--font-primary); font-size: 12px; font-weight: 700; cursor: pointer; outline: none; transition: all 0.2s ease;">
              <span>🎸</span><span>Fretted</span>
            </button>
            <button id="settings-pitch-length" type="button" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px; border-radius: 9px; font-family: var(--font-primary); font-size: 12px; font-weight: 700; cursor: pointer; outline: none; transition: all 0.2s ease;">
              <span>🎵</span><span>Classic</span>
            </button>
          </div>
          <div id="settings-pitch-desc" style="background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; padding: 9px 10px; font-size: 11px; color: rgba(255, 255, 255, 0.72); line-height: 1.45;"></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px;">
          <label style="color: #00f0ff; font-weight: 600; display: flex; justify-content: space-between;">
            <span>Performance Profile</span>
            <span style="color: rgba(255,255,255,0.45); font-size: 11px;">FPS / Graphics</span>
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
            <button id="settings-perf-auto" type="button" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px; border-radius: 9px; font-family: var(--font-primary); font-size: 11px; font-weight: 700; cursor: pointer; outline: none; transition: all 0.2s ease;">
              <span>Auto</span>
            </button>
            <button id="settings-perf-mobile" type="button" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px; border-radius: 9px; font-family: var(--font-primary); font-size: 11px; font-weight: 700; cursor: pointer; outline: none; transition: all 0.2s ease;">
              <span>⚡ Fast</span>
            </button>
            <button id="settings-perf-high" type="button" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px; border-radius: 9px; font-family: var(--font-primary); font-size: 11px; font-weight: 700; cursor: pointer; outline: none; transition: all 0.2s ease;">
              <span>✨ High</span>
            </button>
          </div>
          <div id="settings-perf-desc" style="background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 8px; padding: 8px 10px; font-size: 11px; color: rgba(255, 255, 255, 0.72); line-height: 1.45;"></div>
        </div>

        <label style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 9px; cursor: pointer;">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 600; color: #ffffff; font-size: 12px;">Live Coaching Hints</span>
            <span style="font-size: 10.5px; color: rgba(255, 255, 255, 0.55);">Step-by-step on-screen gesture prompts</span>
          </div>
          <input id="settings-hints-toggle" type="checkbox" style="width: 16px; height: 16px; accent-color: #00f0ff; cursor: pointer;" />
        </label>
      </div>
    `;

    container.appendChild(this.element);

    this.oneHandBtn = this.element.querySelector('#settings-mode-one') as HTMLButtonElement;
    this.twoHandBtn = this.element.querySelector('#settings-mode-two') as HTMLButtonElement;
    this.modeDescEl = this.element.querySelector('#settings-mode-desc') as HTMLDivElement;
    this.frettedBtn = this.element.querySelector('#settings-pitch-fretted') as HTMLButtonElement;
    this.classicBtn = this.element.querySelector('#settings-pitch-length') as HTMLButtonElement;
    this.pitchDescEl = this.element.querySelector('#settings-pitch-desc') as HTMLDivElement;
    this.perfAutoBtn = this.element.querySelector('#settings-perf-auto') as HTMLButtonElement;
    this.perfMobileBtn = this.element.querySelector('#settings-perf-mobile') as HTMLButtonElement;
    this.perfHighBtn = this.element.querySelector('#settings-perf-high') as HTMLButtonElement;
    this.perfDescEl = this.element.querySelector('#settings-perf-desc') as HTMLDivElement;
    this.hintsCheckbox = this.element.querySelector('#settings-hints-toggle') as HTMLInputElement;
    this.closeBtn = this.element.querySelector('#settings-close-btn') as HTMLButtonElement;

    this.hintsCheckbox.checked = options.initialShowLiveHints ?? true;
    this.renderModeSelection();
    this.renderPitchSelection();
    this.renderPerformanceSelection();

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

    this.oneHandBtn.addEventListener('click', () => {
      if (this.currentMode !== 'one-hand') {
        this.setHandMode('one-hand');
        if (options.onHandModeChange) options.onHandModeChange('one-hand');
      }
    });

    this.twoHandBtn.addEventListener('click', () => {
      if (this.currentMode !== 'two-hand') {
        this.setHandMode('two-hand');
        if (options.onHandModeChange) options.onHandModeChange('two-hand');
      }
    });

    this.frettedBtn.addEventListener('click', () => {
      if (this.currentPitchMode !== 'fretted') {
        this.setPitchMode('fretted');
        if (options.onPitchModeChange) options.onPitchModeChange('fretted');
      }
    });

    this.classicBtn.addEventListener('click', () => {
      if (this.currentPitchMode !== 'length') {
        this.setPitchMode('length');
        if (options.onPitchModeChange) options.onPitchModeChange('length');
      }
    });

    const handlePerfClick = (mode: PerformanceMode) => {
      if (this.currentPerformanceMode !== mode) {
        this.currentPerformanceMode = mode;
        this.perfReloadRequired = true;
        this.renderPerformanceSelection();
        if (options.onPerformanceModeChange) options.onPerformanceModeChange(mode);
      }
    };
    this.perfAutoBtn.addEventListener('click', () => handlePerfClick('auto'));
    this.perfMobileBtn.addEventListener('click', () => handlePerfClick('mobile'));
    this.perfHighBtn.addEventListener('click', () => handlePerfClick('high'));

    this.hintsCheckbox.addEventListener('change', () => {
      if (options.onShowLiveHintsChange) {
        options.onShowLiveHintsChange(this.hintsCheckbox.checked);
      }
    });
  }

  public setHandMode(mode: HandInteractionMode): void {
    this.currentMode = mode;
    this.renderModeSelection();
  }

  public setPitchMode(mode: PitchMode): void {
    this.currentPitchMode = mode;
    this.renderPitchSelection();
  }

  public setShowLiveHints(enabled: boolean): void {
    this.hintsCheckbox.checked = enabled;
  }

  public setPerformanceMode(mode: PerformanceMode, activeTier?: PerformanceTier): void {
    this.currentPerformanceMode = mode;
    if (activeTier) this.activePerformanceTier = activeTier;
    this.renderPerformanceSelection();
  }

  private renderPerformanceSelection(): void {
    this.applyToggleStyle(this.perfAutoBtn, this.currentPerformanceMode === 'auto');
    this.applyToggleStyle(this.perfMobileBtn, this.currentPerformanceMode === 'mobile');
    this.applyToggleStyle(this.perfHighBtn, this.currentPerformanceMode === 'high');

    const activeLabel = this.activePerformanceTier === 'mobile' ? 'Fast (Mobile)' : 'High Quality';
    const reloadHint = this.perfReloadRequired
      ? ' Refresh page to apply full camera & WebGL changes.'
      : '';

    if (this.currentPerformanceMode === 'auto') {
      this.perfDescEl.textContent = `Auto detected: ${activeLabel}. Optimizes camera, string segments & effects for smooth 30–60 FPS.${reloadHint}`;
    } else if (this.currentPerformanceMode === 'mobile') {
      this.perfDescEl.textContent = `⚡ Fast Mode: 640×480 camera, 32-seg strings, lighter particles & no blur overhead for high mobile FPS.${reloadHint}`;
    } else {
      this.perfDescEl.textContent = `✨ High Quality: 720p camera, 64-seg strings, full particle trails & glassmorphic blur.${reloadHint}`;
    }
  }

  private applyToggleStyle(btn: HTMLButtonElement, active: boolean): void {
    btn.style.background = active ? 'rgba(0, 240, 255, 0.22)' : 'rgba(14, 24, 44, 0.85)';
    btn.style.border = active ? '1px solid rgba(0, 240, 255, 0.75)' : '1px solid rgba(255, 255, 255, 0.16)';
    btn.style.color = active ? '#00f0ff' : 'rgba(255, 255, 255, 0.72)';
    btn.style.boxShadow = active ? '0 0 12px rgba(0, 240, 255, 0.25)' : 'none';
  }

  private renderModeSelection(): void {
    const isOneHand = this.currentMode === 'one-hand';
    this.applyToggleStyle(this.oneHandBtn, isOneHand);
    this.applyToggleStyle(this.twoHandBtn, !isOneHand);

    this.modeDescEl.textContent = isOneHand
      ? '✋ Hold pinch steady to pop-lock Point A, drag to stretch, and release with one hand.'
      : '👐 Hold dual pinch steady to pop-lock and stretch with both hands. Showing 1 hand for 3s starts a 3-2-1 auto-switch.';
  }

  private renderPitchSelection(): void {
    const isFretted = this.currentPitchMode === 'fretted';
    this.applyToggleStyle(this.frettedBtn, isFretted);
    this.applyToggleStyle(this.classicBtn, !isFretted);

    this.pitchDescEl.textContent = isFretted
      ? '🎸 Pluck different positions along a string (left → right) to play 5 notes per string — ideal for one-hand melodies.'
      : '🎵 Classic harp: each string plays one pure note based on its 3D length (shorter = higher, longer = deeper).';
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

  public getIsOpen(): boolean {
    return this.isOpen;
  }
}
