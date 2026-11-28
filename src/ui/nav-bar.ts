/**
 * Optical Studio Floating Top Islands (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Split into a minimal top-left brand/telemetry island and a top-right action island
 * so the live AR camera feed stays unobstructed.
 */

import { Icons } from './icons';

export interface NavBarOptions {
  onTabChange?: (tabId: string) => void;
  onToggleDiagnostics?: () => void;
  onClearStrings?: () => void;
  onOpenGuide?: () => void;
  onOpenAbout?: (opener: HTMLElement) => void;
}

export class NavBar {
  private element: HTMLElement;
  private brandBtn: HTMLButtonElement;
  private studioBtn: HTMLButtonElement;
  private settingsBtn: HTMLButtonElement;
  private diagBtn: HTMLButtonElement;
  private helpBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private stringPill: HTMLDivElement;
  private stringCountEl: HTMLSpanElement;

  private activeTabId = 'instrument';
  private lastStringCount = -1;
  private lastMaxStrings = -1;

  private onTabChange?: (tabId: string) => void;
  private onToggleDiagnostics?: () => void;
  private onClearStrings?: () => void;
  private onOpenGuide?: () => void;
  private onOpenAbout?: (opener: HTMLElement) => void;

  constructor(container: HTMLElement, options: NavBarOptions = {}) {
    this.onTabChange = options.onTabChange;
    this.onToggleDiagnostics = options.onToggleDiagnostics;
    this.onClearStrings = options.onClearStrings;
    this.onOpenGuide = options.onOpenGuide;
    this.onOpenAbout = options.onOpenAbout;

    this.element = document.createElement('header');
    this.element.id = 'app-navbar';

    this.element.innerHTML = `
      <div class="hud-island hud-island--brand">
        <button id="navbar-brand-btn" class="navbar-brand" type="button" title="About Spatial Harp" aria-label="About Spatial Harp">
          <img class="navbar-logo-img" src="/icon-128.png" width="30" height="30" alt="" />
          <span class="navbar-brand-title">Spatial Harp</span>
        </button>
        <div id="navbar-string-pill" class="navbar-string-pill" data-active="false" title="Active strings in air">
          <span class="navbar-string-dot" aria-hidden="true"></span>
          <span id="navbar-string-count">0 / 12</span>
        </div>
        <button id="navbar-diag-btn" class="island-btn island-btn--icon" type="button" aria-expanded="false" aria-controls="hud-card" title="System metrics [D]" aria-label="System metrics">
          ${Icons.activity(16)}
        </button>
      </div>

      <nav class="hud-island hud-island--controls" aria-label="Instrument controls">
        <button id="navbar-studio-btn" class="island-btn" type="button" data-tab-id="studio" aria-expanded="false" aria-controls="sound-studio-panel" title="Sound Studio">
          ${Icons.sliders(16)}
          <span class="navbar-btn-label">Studio</span>
        </button>
        <button id="navbar-settings-btn" class="island-btn" type="button" data-tab-id="settings" aria-expanded="false" aria-controls="settings-panel" title="Settings">
          ${Icons.settings(16)}
          <span class="navbar-btn-label">Settings</span>
        </button>
        <span class="island-divider" aria-hidden="true"></span>
        <button id="navbar-help-btn" class="island-btn island-btn--icon" type="button" title="Interactive guide" aria-label="Interactive guide">
          ${Icons.help(16)}
        </button>
        <button id="navbar-clear-btn" class="island-btn island-btn--icon island-btn--danger" type="button" title="Clear all strings [C]" aria-label="Clear all strings">
          ${Icons.trash(16)}
        </button>
      </nav>
    `;

    this.brandBtn = this.element.querySelector('#navbar-brand-btn') as HTMLButtonElement;
    this.stringPill = this.element.querySelector('#navbar-string-pill') as HTMLDivElement;
    this.stringCountEl = this.element.querySelector('#navbar-string-count') as HTMLSpanElement;
    this.diagBtn = this.element.querySelector('#navbar-diag-btn') as HTMLButtonElement;
    this.studioBtn = this.element.querySelector('#navbar-studio-btn') as HTMLButtonElement;
    this.settingsBtn = this.element.querySelector('#navbar-settings-btn') as HTMLButtonElement;
    this.helpBtn = this.element.querySelector('#navbar-help-btn') as HTMLButtonElement;
    this.clearBtn = this.element.querySelector('#navbar-clear-btn') as HTMLButtonElement;

    this.brandBtn.addEventListener('click', () => {
      if (this.onOpenAbout) {
        this.onOpenAbout(this.brandBtn);
      }
    });

    this.helpBtn.addEventListener('click', () => {
      if (this.onOpenGuide) {
        this.onOpenGuide();
      }
    });

    this.studioBtn.addEventListener('click', () => {
      this.setActiveTab(this.activeTabId === 'studio' ? 'instrument' : 'studio');
    });

    this.settingsBtn.addEventListener('click', () => {
      this.setActiveTab(this.activeTabId === 'settings' ? 'instrument' : 'settings');
    });

    this.diagBtn.addEventListener('click', () => {
      if (this.onToggleDiagnostics) {
        this.onToggleDiagnostics();
      }
    });

    this.clearBtn.addEventListener('click', () => {
      if (this.onClearStrings) {
        this.onClearStrings();
      }
    });

    container.appendChild(this.element);
  }

  public setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    this.studioBtn.setAttribute('aria-expanded', String(tabId === 'studio'));
    this.settingsBtn.setAttribute('aria-expanded', String(tabId === 'settings'));

    if (this.onTabChange) {
      this.onTabChange(tabId);
    }
  }

  public setDiagnosticsActive(active: boolean): void {
    this.diagBtn.setAttribute('aria-expanded', String(active));
  }

  /**
   * Zero-GC per-frame string counter updater (only mutates DOM when counts change).
   */
  public setStringCount(count: number, max: number): void {
    if (count === this.lastStringCount && max === this.lastMaxStrings) return;
    this.lastStringCount = count;
    this.lastMaxStrings = max;
    this.stringCountEl.textContent = `${count} / ${max}`;
    this.stringPill.dataset.active = String(count > 0);
  }

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'flex' : 'none';
  }
}
