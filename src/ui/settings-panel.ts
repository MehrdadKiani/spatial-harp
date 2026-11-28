import { PitchMode } from '../types/audio';
import { Icons } from './icons';

export interface SettingsPanelOptions {
  initialPitchMode?: PitchMode;
  onPitchModeChange?: (mode: PitchMode) => void;
  onClose?: () => void;
}

export class SettingsPanel {
  private element: HTMLElement;
  private frettedBtn: HTMLButtonElement;
  private classicBtn: HTMLButtonElement;
  private pitchDescEl: HTMLDivElement;
  private closeBtn: HTMLButtonElement;
  private currentPitchMode: PitchMode;
  private isOpen = false;

  constructor(container: HTMLElement, options: SettingsPanelOptions = {}) {
    this.currentPitchMode = options.initialPitchMode ?? 'fretted';

    this.element = document.createElement('aside');
    this.element.id = 'settings-panel';
    this.element.className = 'app-drawer studio-drawer';
    this.element.dataset.open = 'false';
    this.element.setAttribute('aria-labelledby', 'settings-title');

    this.element.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-group">
          ${Icons.settings(17)}
          <h2 id="settings-title" class="drawer-title">Settings</h2>
        </div>
        <button id="settings-close-btn" class="drawer-close-btn" type="button" aria-label="Close Settings">
          ${Icons.close(17)}
        </button>
      </div>

      <div class="drawer-stack">
        <div class="drawer-section">
          <div class="section-heading-row">
            <span class="section-label">Pitch mode</span>
            <span class="section-meta">Note mapping</span>
          </div>
          <div class="segmented-control" role="group" aria-label="Pitch mode">
            <button id="settings-pitch-fretted" class="seg-btn" type="button" aria-pressed="true">
              ${Icons.fret(15)}
              <span>Fretted</span>
            </button>
            <button id="settings-pitch-length" class="seg-btn" type="button" aria-pressed="false">
              ${Icons.music(15)}
              <span>Classic</span>
            </button>
          </div>
          <div id="settings-pitch-desc" class="section-note"></div>
        </div>
      </div>
    `;

    container.appendChild(this.element);

    this.frettedBtn = this.element.querySelector('#settings-pitch-fretted') as HTMLButtonElement;
    this.classicBtn = this.element.querySelector('#settings-pitch-length') as HTMLButtonElement;
    this.pitchDescEl = this.element.querySelector('#settings-pitch-desc') as HTMLDivElement;
    this.closeBtn = this.element.querySelector('#settings-close-btn') as HTMLButtonElement;

    this.renderPitchSelection();

    this.closeBtn.addEventListener('click', () => {
      this.close();
      if (options.onClose) options.onClose();
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

    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        if (options.onClose) options.onClose();
      }
    });
  }

  public setPitchMode(mode: PitchMode): void {
    this.currentPitchMode = mode;
    this.renderPitchSelection();
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
