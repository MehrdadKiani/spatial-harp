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
  onClearStrings?: () => void;
}

export class NavBar {
  private element: HTMLElement;
  private logoContainer: HTMLDivElement;
  private navItemsContainer: HTMLDivElement;
  private diagBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private statusBadge: HTMLSpanElement;
  private activeTabId: string = 'instrument';
  private isDiagActive = false;
  private onTabChange?: (tabId: string) => void;
  private onToggleDiagnostics?: () => void;
  private onClearStrings?: () => void;

  constructor(container: HTMLElement, options: NavBarOptions = {}) {
    this.onTabChange = options.onTabChange;
    this.onToggleDiagnostics = options.onToggleDiagnostics;
    this.onClearStrings = options.onClearStrings;

    this.element = document.createElement('header');
    this.element.id = 'app-navbar';

    Object.assign(this.element.style, {
      position: 'absolute',
      top: '12px',
      left: '16px',
      right: '16px',
      height: '48px',
      zIndex: '20',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      background: 'rgba(10, 15, 28, 0.72)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(0, 240, 255, 0.22)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      pointerEvents: 'none',
      userSelect: 'none',
      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    });

    // 1. Logo & Brand Container
    this.logoContainer = document.createElement('div');
    this.logoContainer.style.display = 'flex';
    this.logoContainer.style.alignItems = 'center';
    this.logoContainer.style.gap = '10px';
    this.logoContainer.style.pointerEvents = 'auto';
    this.logoContainer.style.cursor = 'pointer';

    // Futuristic Neon Spatial Harp SVG Logo
    this.logoContainer.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 6px #00f0ff);">
        <!-- Outer Hex Shield -->
        <polygon points="16,2 29,9 29,23 16,30 3,23 3,9" stroke="#00f0ff" stroke-width="1.8" fill="rgba(0, 240, 255, 0.08)"/>
        <!-- Vertical Harp Strings -->
        <line x1="11" y1="8" x2="11" y2="24" stroke="#ff007f" stroke-width="1.5" stroke-linecap="round" />
        <line x1="16" y1="5" x2="16" y2="27" stroke="#00f0ff" stroke-width="1.8" stroke-linecap="round" />
        <line x1="21" y1="8" x2="21" y2="24" stroke="#38ef7d" stroke-width="1.5" stroke-linecap="round" />
        <!-- Contact Beam Spark Dot -->
        <circle cx="16" cy="14" r="2.2" fill="#ffffff" style="filter: drop-shadow(0 0 4px #ffffff);" />
      </svg>
      <div style="display: flex; flex-direction: column; line-height: 1.1;">
        <span style="font-weight: 800; font-size: 14px; letter-spacing: 1.2px; color: #ffffff; text-transform: uppercase;">
          <span style="color: #00f0ff; text-shadow: 0 0 8px rgba(0,240,255,0.7);">SPATIAL</span> HARP
        </span>
        <span style="font-size: 9px; letter-spacing: 0.8px; color: rgba(255, 255, 255, 0.45); font-weight: 600;">AR AUDIO-VISUAL LAB</span>
      </div>
    `;

    // 2. Navigation Items / Tabs (Placeholder for future pages)
    this.navItemsContainer = document.createElement('div');
    Object.assign(this.navItemsContainer.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'auto',
    });

    const defaultItems: NavItem[] = [
      { id: 'instrument', label: 'Instrument', icon: '🎸', active: true },
      { id: 'studio', label: 'Sound Studio', icon: '🎛️' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    defaultItems.forEach((item) => {
      const btn = this.createNavButton(item);
      this.navItemsContainer.appendChild(btn);
    });

    // 3. Right Container: Diagnostics Toggle Button & Live AR Indicator
    const rightContainer = document.createElement('div');
    rightContainer.style.display = 'flex';
    rightContainer.style.alignItems = 'center';
    rightContainer.style.gap = '10px';
    rightContainer.style.pointerEvents = 'auto';

    // Diagnostics Button in NavBar (clean, no [D] shortcut suffix)
    this.diagBtn = document.createElement('button');
    this.diagBtn.id = 'navbar-diag-btn';
    this.diagBtn.title = 'Toggle System Metrics & Diagnostics HUD';
    Object.assign(this.diagBtn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      background: 'rgba(0, 240, 255, 0.08)',
      border: '1px solid rgba(0, 240, 255, 0.35)',
      color: '#00f0ff',
      borderRadius: '8px',
      padding: '5px 11px',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s ease',
    });
    this.diagBtn.innerHTML = `<span>📊</span><span>Diagnostics</span>`;

    this.diagBtn.addEventListener('mouseenter', () => {
      this.diagBtn.style.background = 'rgba(0, 240, 255, 0.20)';
      this.diagBtn.style.boxShadow = '0 0 10px rgba(0, 240, 255, 0.3)';
    });
    this.diagBtn.addEventListener('mouseleave', () => {
      if (!this.isDiagActive) {
        this.diagBtn.style.background = 'rgba(0, 240, 255, 0.08)';
        this.diagBtn.style.boxShadow = 'none';
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
      gap: '5px',
      background: 'rgba(255, 68, 68, 0.12)',
      border: '1px solid rgba(255, 68, 68, 0.35)',
      color: '#ff8888',
      borderRadius: '8px',
      padding: '5px 11px',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s ease',
    });
    this.clearBtn.innerHTML = `<span>🗑️</span><span>Clear</span>`;

    this.clearBtn.addEventListener('mouseenter', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.25)';
      this.clearBtn.style.boxShadow = '0 0 10px rgba(255, 68, 68, 0.35)';
      this.clearBtn.style.color = '#ffffff';
    });
    this.clearBtn.addEventListener('mouseleave', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.12)';
      this.clearBtn.style.boxShadow = 'none';
      this.clearBtn.style.color = '#ff8888';
    });
    this.clearBtn.addEventListener('click', () => {
      if (this.onClearStrings) {
        this.onClearStrings();
      }
    });

    this.statusBadge = document.createElement('span');
    Object.assign(this.statusBadge.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(0, 255, 170, 0.12)',
      border: '1px solid rgba(0, 255, 170, 0.3)',
      color: '#00ffaa',
      borderRadius: '20px',
      padding: '3px 10px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.4px',
    });
    this.statusBadge.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #00ffaa; box-shadow: 0 0 6px #00ffaa; animation: pulse 1.8s infinite;"></span>LIVE AR`;

    rightContainer.appendChild(this.diagBtn);
    rightContainer.appendChild(this.clearBtn);
    rightContainer.appendChild(this.statusBadge);

    // Assemble components into element
    this.element.appendChild(this.logoContainer);
    this.element.appendChild(this.navItemsContainer);
    this.element.appendChild(rightContainer);

    container.appendChild(this.element);
  }

  private createNavButton(item: NavItem): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.dataset.tabId = item.id;

    const isActive = item.active || item.id === this.activeTabId;

    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: isActive ? 'rgba(0, 240, 255, 0.18)' : 'transparent',
      border: isActive ? '1px solid rgba(0, 240, 255, 0.5)' : '1px solid transparent',
      color: isActive ? '#00f0ff' : 'rgba(255, 255, 255, 0.70)',
      borderRadius: '8px',
      padding: '5px 12px',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s ease',
      textShadow: isActive ? '0 0 8px rgba(0, 240, 255, 0.4)' : 'none',
    });

    btn.innerHTML = `${item.icon ? `<span style="font-size: 13px;">${item.icon}</span>` : ''}<span>${item.label}</span>`;

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

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'flex' : 'none';
  }
}
