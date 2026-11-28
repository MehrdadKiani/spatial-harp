import { HandInteractionMode } from '../types/instruments';
import { PitchMode } from '../types/audio';
import { PerformanceMode, PerformanceTier } from '../core/performance';
import { Icons } from './icons';

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
  private element: HTMLElement;
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

    this.element = document.createElement('aside');
    this.element.id = 'settings-panel';
    this.element.className = 'app-drawer studio-drawer';
    this.element.dataset.open = 'false';
    this.element.setAttribute('aria-labelledby', 'settings-title');

    this.element.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-group">
          ${Icons.settings(16)}
          <h2 id="settings-title" class="drawer-title">Settings</h2>
        </div>
        <button id="settings-close-btn" class="drawer-close-btn" type="button" aria-label="Close Settings">
          ${Icons.close(16)}
        </button>
      </div>

      <div class="drawer-stack">
        <div class="drawer-section">
          <div class="section-heading-row">
            <span class="section-label">Hand mode</span>
            <span class="section-meta">String creation</span>
          </div>
          <div class="segmented-control" role="group" aria-label="Hand mode">
            <button id="settings-mode-one" class="seg-btn" type="button" aria-pressed="true">
              ${Icons.hand(15)}
              <span>One-Hand</span>
            </button>
            <button id="settings-mode-two" class="seg-btn" type="button" aria-pressed="false">
              ${Icons.hands(15)}
              <span>Two-Hand</span>
            </button>
          </div>
          <div id="settings-mode-desc" class="section-note"></div>
        </div>

        <div class="drawer-section">
          <div class="section-heading-row">
            <span class="section-label">Pitch mode</span>
            <span class="section-meta">Note mapping</span>
          </div>
          <div class="segmented-control" role="group" aria-label="Pitch mode">
            <button id="settings-pitch-fretted" class="seg-btn" type="button" aria-pressed="true">
              ${Icons.fret(14)}
              <span>Fretted</span>
            </button>
            <button id="settings-pitch-length" class="seg-btn" type="button" aria-pressed="false">
              ${Icons.music(14)}
              <span>Classic</span>
            </button>
          </div>
          <div id="settings-pitch-desc" class="section-note"></div>
        </div>

        <div class="drawer-section">
          <div class="section-heading-row">
            <span class="section-label">Performance profile</span>
            <span class="section-meta">FPS / Graphics</span>
          </div>
          <div class="segmented-control segmented-control--3" role="group" aria-label="Performance profile">
            <button id="settings-perf-auto" class="seg-btn" type="button" aria-pressed="true">
              <span>Auto</span>
            </button>
            <button id="settings-perf-mobile" class="seg-btn" type="button" aria-pressed="false">
              ${Icons.bolt(13)}
              <span>Fast</span>
            </button>
            <button id="settings-perf-high" class="seg-btn" type="button" aria-pressed="false">
              ${Icons.sparkle(13)}
              <span>High</span>
            </button>
          </div>
          <div id="settings-perf-desc" class="section-note"></div>
        </div>

        <label for="settings-hints-toggle" class="toggle-row">
          <span class="toggle-copy">
            <span class="toggle-title">Live coaching hints</span>
            <span class="toggle-sub">Step-by-step on-screen gesture prompts</span>
          </span>
          <input id="settings-hints-toggle" class="studio-switch" type="checkbox" role="switch" />
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

    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        if (options.onClose) options.onClose();
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
    this.perfAutoBtn.setAttribute('aria-pressed', String(this.currentPerformanceMode === 'auto'));
    this.perfMobileBtn.setAttribute('aria-pressed', String(this.currentPerformanceMode === 'mobile'));
    this.perfHighBtn.setAttribute('aria-pressed', String(this.currentPerformanceMode === 'high'));

    const activeLabel = this.activePerformanceTier === 'mobile' ? 'Fast (Mobile)' : 'High Quality';
    const reloadHint = this.perfReloadRequired
      ? ' Reload the page to apply full camera and WebGL changes.'
      : '';

    if (this.currentPerformanceMode === 'auto') {
      this.perfDescEl.textContent = `Detected: ${activeLabel}. Balances camera resolution, string segments, and effects for steady 30–60 FPS.${reloadHint}`;
    } else if (this.currentPerformanceMode === 'mobile') {
      this.perfDescEl.textContent = `Fast mode: 640×480 camera, 32-segment strings, lighter particles, and no blur overhead.${reloadHint}`;
    } else {
      this.perfDescEl.textContent = `High quality: 720p camera, 64-segment strings, full particle trails, and frosted glass blur.${reloadHint}`;
    }
  }

  private renderModeSelection(): void {
    const isOneHand = this.currentMode === 'one-hand';
    this.oneHandBtn.setAttribute('aria-pressed', String(isOneHand));
    this.twoHandBtn.setAttribute('aria-pressed', String(!isOneHand));

    this.modeDescEl.textContent = isOneHand
      ? 'Hold pinch steady to pop-lock Point A, drag to stretch, and release with one hand.'
      : 'Hold dual pinch steady to stretch with both hands. Showing one hand for 3s auto-switches to One-Hand mode.';
  }

  private renderPitchSelection(): void {
    const isFretted = this.currentPitchMode === 'fretted';
    this.frettedBtn.setAttribute('aria-pressed', String(isFretted));
    this.classicBtn.setAttribute('aria-pressed', String(!isFretted));

    this.pitchDescEl.textContent = isFretted
      ? 'Pluck different positions along a string (left to right) to play 5 notes per string.'
      : 'Classic harp: each string plays one pure note based on its 3D length (shorter = higher).';
  }

  public open(): void {
    this.isOpen = true;
    this.element.dataset.open = 'true';
  }

  public close(): void {
    this.isOpen = false;
    this.element.dataset.open = 'false';
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }
}
