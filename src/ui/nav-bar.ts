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

    // Futuristic Neon Spatial Harp SVG Logo with JetBrains Mono font
    this.logoContainer.innerHTML = `
      <svg class="navbar-logo-svg" width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 8px #00f0ff); flex-shrink: 0;">
        <!-- Outer Hex Shield -->
        <polygon points="16,2 29,9 29,23 16,30 3,23 3,9" stroke="#00f0ff" stroke-width="1.8" fill="rgba(0, 240, 255, 0.08)"/>
        <!-- Vertical Harp Strings -->
        <line x1="11" y1="8" x2="11" y2="24" stroke="#ff007f" stroke-width="1.5" stroke-linecap="round" />
        <line x1="16" y1="5" x2="16" y2="27" stroke="#00f0ff" stroke-width="1.8" stroke-linecap="round" />
        <line x1="21" y1="8" x2="21" y2="24" stroke="#38ef7d" stroke-width="1.5" stroke-linecap="round" />
        <!-- Contact Beam Spark Dot -->
        <circle cx="16" cy="14" r="2.2" fill="#ffffff" style="filter: drop-shadow(0 0 4px #ffffff);" />
      </svg>
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

    // 3. Right Container: Diagnostics Toggle Button & Live AR Indicator
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

    this.statusBadge = document.createElement('span');
    this.statusBadge.id = 'navbar-status-badge';
    Object.assign(this.statusBadge.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '7px',
      background: 'rgba(0, 255, 170, 0.12)',
      border: '1px solid rgba(0, 255, 170, 0.35)',
      color: '#00ffaa',
      borderRadius: '20px',
      padding: '4px 12px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '1.2px',
      textTransform: 'uppercase',
      flexShrink: '0',
    });
    this.statusBadge.innerHTML = `<span class="navbar-status-dot" style="width: 7px; height: 7px; border-radius: 50%; background: #00ffaa; box-shadow: 0 0 8px #00ffaa; animation: pulse 1.8s infinite; flex-shrink: 0;"></span><span class="navbar-status-text">LIVE AR</span>`;

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

  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'flex' : 'none';
  }
}
