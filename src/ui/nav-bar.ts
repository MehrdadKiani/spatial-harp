/**
 * Glassmorphic Top Navigation Bar Component (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Provides a top navigation header with an AR instrument logo and page/tab routing placeholders.
 */

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
}

export interface NavBarOptions {
  onTabChange?: (tabId: string) => void;
  onToggleDiagnostics?: () => void;
  onToggleLock?: () => void;
  onClearStrings?: () => void;
}

export class NavBar {
  private element: HTMLElement;
  private logoContainer: HTMLDivElement;
  private navItemsContainer: HTMLDivElement;
  private lockBtn: HTMLButtonElement;
  private diagBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private activeTabId: string = 'instrument';
  private isDiagActive = false;
  private isLocked = false;
  private onTabChange?: (tabId: string) => void;
  private onToggleDiagnostics?: () => void;
  private onToggleLock?: () => void;
  private onClearStrings?: () => void;

  constructor(container: HTMLElement, options: NavBarOptions = {}) {
    this.onTabChange = options.onTabChange;
    this.onToggleDiagnostics = options.onToggleDiagnostics;
    this.onToggleLock = options.onToggleLock;
    this.onClearStrings = options.onClearStrings;

    this.element = document.createElement('header');
    this.element.id = 'app-navbar';

    Object.assign(this.element.style, {
      position: 'absolute',
      top: '12px',
      left: '16px',
      right: '16px',
      height: '52px',
      zIndex: '20',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 18px',
      background: 'rgba(10, 15, 28, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(0, 240, 255, 0.28)',
      borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55), 0 0 20px rgba(0, 240, 255, 0.08)',
      fontFamily: 'var(--font-primary)',
      pointerEvents: 'none',
      userSelect: 'none',
      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    });

    // 1. Logo & Brand Container
    this.logoContainer = document.createElement('div');
    this.logoContainer.className = 'navbar-logo-container';
    this.logoContainer.style.display = 'flex';
    this.logoContainer.style.alignItems = 'center';
    this.logoContainer.style.gap = '12px';
    this.logoContainer.style.pointerEvents = 'auto';
    this.logoContainer.style.cursor = 'pointer';

    // Futuristic Neon Spatial Harp Logo with JetBrains Mono font
    this.logoContainer.innerHTML = `
      <img class="navbar-logo-svg" src="/icon-128.png" width="38" height="38" alt="Spatial Harp Logo" style="filter: drop-shadow(0 0 10px rgba(0, 240, 255, 0.85)); flex-shrink: 0; object-fit: contain;" />
      <div class="navbar-brand-text" style="display: flex; flex-direction: column; line-height: 1.15; white-space: nowrap;">
        <span class="navbar-brand-title" style="font-family: var(--font-display); font-weight: 800; font-size: 15px; letter-spacing: 2.2px; color: #ffffff; text-transform: uppercase;">
          <span style="color: #00f0ff; text-shadow: 0 0 10px rgba(0,240,255,0.75);">SPATIAL</span><span class="navbar-brand-tail"> HARP</span>
        </span>
        <span class="navbar-brand-sub" style="font-family: var(--font-primary); font-size: 10px; letter-spacing: 1.8px; color: rgba(255, 255, 255, 0.55); font-weight: 700; text-transform: uppercase;">AR AUDIO-VISUAL LAB</span>
      </div>
    `;

    // 2. Navigation Items / Tabs (Placeholder for future pages)
    this.navItemsContainer = document.createElement('div');
    this.navItemsContainer.className = 'navbar-items-container';
    Object.assign(this.navItemsContainer.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'auto',
    });

    const defaultItems: NavItem[] = [
      { id: 'instrument', label: 'Instrument', icon: '🎸', active: true },
      { id: 'studio', label: 'Sound Studio', icon: '🎹' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    defaultItems.forEach((item) => {
      const btn = this.createNavButton(item);
      this.navItemsContainer.appendChild(btn);
    });

    // 3. Right Container: Diagnostics & Clear Strings
    const rightContainer = document.createElement('div');
    rightContainer.className = 'navbar-right-container';
    rightContainer.style.display = 'flex';
    rightContainer.style.alignItems = 'center';
    rightContainer.style.gap = '10px';
    rightContainer.style.pointerEvents = 'auto';

    // Diagnostics Button in NavBar (clean, fancy font styling)
    this.diagBtn = document.createElement('button');
    this.diagBtn.id = 'navbar-diag-btn';
    this.diagBtn.title = 'Toggle System Metrics & Diagnostics HUD';
    Object.assign(this.diagBtn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(0, 240, 255, 0.08)',
      border: '1px solid rgba(0, 240, 255, 0.35)',
      color: '#00f0ff',
      borderRadius: '8px',
      padding: '6px 14px',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    });
    this.diagBtn.innerHTML = `<span>📊</span><span class="navbar-btn-label">Diagnostics</span>`;

    this.diagBtn.addEventListener('mouseenter', () => {
      this.diagBtn.style.background = 'rgba(0, 240, 255, 0.22)';
      this.diagBtn.style.boxShadow = '0 0 14px rgba(0, 240, 255, 0.4)';
      this.diagBtn.style.transform = 'translateY(-1px)';
    });
    this.diagBtn.addEventListener('mouseleave', () => {
      if (!this.isDiagActive) {
        this.diagBtn.style.background = 'rgba(0, 240, 255, 0.08)';
        this.diagBtn.style.boxShadow = 'none';
        this.diagBtn.style.transform = 'translateY(0)';
      }
    });
    this.diagBtn.addEventListener('click', () => {
      if (this.onToggleDiagnostics) {
        this.onToggleDiagnostics();
      }
    });

    // Dedicated Clear Strings Button in NavBar
    this.clearBtn = document.createElement('button');
    this.clearBtn.id = 'navbar-clear-btn';
    this.clearBtn.title = 'Clear all active strings in mid-air [C]';
    Object.assign(this.clearBtn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255, 68, 68, 0.12)',
      border: '1px solid rgba(255, 68, 68, 0.35)',
      color: '#ff8888',
      borderRadius: '8px',
      padding: '6px 14px',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    });
    this.clearBtn.innerHTML = `<span>🗑️</span><span class="navbar-btn-label">Clear</span>`;

    this.clearBtn.addEventListener('mouseenter', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.25)';
      this.clearBtn.style.boxShadow = '0 0 14px rgba(255, 68, 68, 0.45)';
      this.clearBtn.style.color = '#ffffff';
      this.clearBtn.style.transform = 'translateY(-1px)';
    });
    this.clearBtn.addEventListener('mouseleave', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.12)';
      this.clearBtn.style.boxShadow = 'none';
      this.clearBtn.style.color = '#ff8888';
      this.clearBtn.style.transform = 'translateY(0)';
    });
    this.clearBtn.addEventListener('click', () => {
      if (this.onClearStrings) {
        this.onClearStrings();
      }
    });

    // Lock Harp (Play Mode) Toggle Button in NavBar
    this.lockBtn = document.createElement('button');
    this.lockBtn.id = 'navbar-lock-btn';
    this.lockBtn.title = 'Lock harp to play freely without creating or moving strings [L]';
    Object.assign(this.lockBtn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.22)',
      color: 'rgba(255, 255, 255, 0.85)',
      borderRadius: '8px',
      padding: '6px 14px',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    });
    this.lockBtn.innerHTML = `<span>🔓</span><span class="navbar-btn-label">Lock</span>`;

    this.lockBtn.addEventListener('mouseenter', () => {
      if (!this.isLocked) {
        this.lockBtn.style.background = 'rgba(255, 170, 0, 0.16)';
        this.lockBtn.style.borderColor = 'rgba(255, 170, 0, 0.55)';
        this.lockBtn.style.color = '#ffaa00';
      }
      this.lockBtn.style.transform = 'translateY(-1px)';
    });
    this.lockBtn.addEventListener('mouseleave', () => {
      this.applyLockStyle();
      this.lockBtn.style.transform = 'translateY(0)';
    });
    this.lockBtn.addEventListener('click', () => {
      if (this.onToggleLock) {
        this.onToggleLock();
      }
    });

    rightContainer.appendChild(this.lockBtn);
    rightContainer.appendChild(this.diagBtn);
    rightContainer.appendChild(this.clearBtn);

    // Assemble components into element
    this.element.appendChild(this.logoContainer);
    this.element.appendChild(this.navItemsContainer);
    this.element.appendChild(rightContainer);

    container.appendChild(this.element);
  }

  private createNavButton(item: NavItem): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'navbar-item-btn';
    btn.dataset.tabId = item.id;
    btn.title = item.label;

    const isActive = item.active || item.id === this.activeTabId;

    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: isActive ? 'rgba(0, 240, 255, 0.18)' : 'transparent',
      border: isActive ? '1px solid rgba(0, 240, 255, 0.55)' : '1px solid transparent',
      color: isActive ? '#00f0ff' : 'rgba(255, 255, 255, 0.70)',
      borderRadius: '8px',
      padding: '6px 14px',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '1.0px',
      textTransform: 'uppercase',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      textShadow: isActive ? '0 0 10px rgba(0, 240, 255, 0.5)' : 'none',
      whiteSpace: 'nowrap',
    });

    btn.innerHTML = `${item.icon ? `<span style="font-size: 14px;">${item.icon}</span>` : ''}<span class="navbar-btn-label">${item.label}</span>`;

    btn.addEventListener('mouseenter', () => {
      if (btn.dataset.tabId !== this.activeTabId) {
        btn.style.background = 'rgba(255, 255, 255, 0.08)';
        btn.style.color = '#ffffff';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (btn.dataset.tabId !== this.activeTabId) {
        btn.style.background = 'transparent';
        btn.style.color = 'rgba(255, 255, 255, 0.70)';
      }
    });

    btn.addEventListener('click', () => {
      this.setActiveTab(item.id);
    });

    return btn;
  }

  public setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    const buttons = this.navItemsContainer.querySelectorAll<HTMLButtonElement>('button');
    buttons.forEach((btn) => {
      const isCurrent = btn.dataset.tabId === tabId;
      btn.style.background = isCurrent ? 'rgba(0, 240, 255, 0.18)' : 'transparent';
      btn.style.border = isCurrent ? '1px solid rgba(0, 240, 255, 0.5)' : '1px solid transparent';
      btn.style.color = isCurrent ? '#00f0ff' : 'rgba(255, 255, 255, 0.70)';
      btn.style.textShadow = isCurrent ? '0 0 8px rgba(0, 240, 255, 0.4)' : 'none';
    });

    if (this.onTabChange) {
      this.onTabChange(tabId);
    }
  }

  public setDiagnosticsActive(active: boolean): void {
    this.isDiagActive = active;
    this.diagBtn.style.background = active ? 'rgba(0, 240, 255, 0.28)' : 'rgba(0, 240, 255, 0.08)';
    this.diagBtn.style.borderColor = active ? '#00f0ff' : 'rgba(0, 240, 255, 0.35)';
    this.diagBtn.style.boxShadow = active ? '0 0 12px rgba(0, 240, 255, 0.45)' : 'none';
  }

  public setLocked(locked: boolean): void {
    this.isLocked = locked;
    this.lockBtn.innerHTML = locked
      ? `<span>🔒</span><span class="navbar-btn-label">Locked</span>`
      : `<span>🔓</span><span class="navbar-btn-label">Lock</span>`;
    this.applyLockStyle();
  }

  private applyLockStyle(): void {
    if (this.isLocked) {
      this.lockBtn.style.background = 'rgba(255, 170, 0, 0.24)';
      this.lockBtn.style.borderColor = '#ffaa00';
      this.lockBtn.style.color = '#ffca44';
      this.lockBtn.style.boxShadow = '0 0 14px rgba(255, 170, 0, 0.45)';
    } else {
      this.lockBtn.style.background = 'rgba(255, 255, 255, 0.06)';
      this.lockBtn.style.borderColor = 'rgba(255, 255, 255, 0.22)';
      this.lockBtn.style.color = 'rgba(255, 255, 255, 0.85)';
      this.lockBtn.style.boxShadow = 'none';
    }
  }

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'flex' : 'none';
  }
}
