/**
 * Optical Studio About Modal (Zero UI Framework - Pure Vanilla DOM & TypeScript)
 * Uses native <dialog closedby="any"> with @starting-style transitions,
 * automatic focus trapping, opener focus restoration, and outside-click dismiss.
 */

import { Icons } from './icons';

export class AboutModal {
  private dialog: HTMLDialogElement;
  private card: HTMLDivElement;
  private closeBtn: HTMLButtonElement;
  private opener: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'about-modal-dialog';
    this.dialog.setAttribute('closedby', 'any');
    this.dialog.setAttribute('aria-labelledby', 'about-modal-title');

    this.card = document.createElement('div');
    this.card.className = 'about-modal-card';

    this.card.innerHTML = `
      <div class="drawer-header" style="margin-bottom: 0; padding-bottom: 14px;">
        <div class="drawer-title-group">
          ${Icons.info(16)}
          <span class="drawer-title">About</span>
        </div>
        <button id="about-close-btn" class="drawer-close-btn" type="button" aria-label="Close About">
          ${Icons.close(16)}
        </button>
      </div>

      <div class="about-hero">
        <div class="about-emblem">
          <img src="/icon-128.png" width="54" height="54" alt="Spatial Harp" />
        </div>
        <div class="about-hero-text">
          <div class="about-title-row">
            <h2 id="about-modal-title" class="about-title">Spatial Harp</h2>
            <span class="about-version-pill mono">v${__APP_VERSION__}</span>
          </div>
          <p class="about-tagline">
            An augmented-reality musical instrument played in mid-air. Draw glowing 3D strings with your hands, pluck Japanese Hirajōshi harmonics, and shape sound in real time.
          </p>
        </div>
      </div>

      <div class="about-section">
        <span class="section-label">Built with</span>
        <div class="about-tech-grid">
          <div class="about-tech-chip">
            <span class="about-tech-name">MediaPipe</span>
            <span class="about-tech-role">3D hand tracking</span>
          </div>
          <div class="about-tech-chip">
            <span class="about-tech-name">Three.js</span>
            <span class="about-tech-role">WebGL string physics</span>
          </div>
          <div class="about-tech-chip">
            <span class="about-tech-name">Tone.js</span>
            <span class="about-tech-role">Web Audio synthesis</span>
          </div>
        </div>
      </div>

      <div class="about-section">
        <span class="section-label">Shortcuts</span>
        <div class="about-shortcuts-grid">
          <div class="about-shortcut-item">
            <span class="about-shortcut-label">Clear strings</span>
            <span class="about-kbd-group"><kbd class="kbd-chip">C</kbd><kbd class="kbd-chip">Space</kbd></span>
          </div>
          <div class="about-shortcut-item">
            <span class="about-shortcut-label">System metrics</span>
            <kbd class="kbd-chip">D</kbd>
          </div>
          <div class="about-shortcut-item">
            <span class="about-shortcut-label">Close panels</span>
            <kbd class="kbd-chip">Esc</kbd>
          </div>
        </div>
      </div>

      <div class="about-section">
        <span class="section-label">Keep in touch</span>
        <div class="about-contact-row">
          <a class="about-email-link" href="mailto:mehrdad.kiani.eng@gmail.com">
            ${Icons.mail(15)}
            <span class="mono">mehrdad.kiani.eng@gmail.com</span>
          </a>
          <button id="about-copy-email-btn" class="about-copy-btn" type="button" aria-label="Copy email address">
            ${Icons.copy(14)}
            <span>Copy</span>
          </button>
        </div>
      </div>

      <div class="about-privacy-strip">
        ${Icons.shield(15)}
        <span>100% local in your browser — camera frames never leave your device.</span>
      </div>

      <div class="about-footer">
        <span>Created by <strong>Mehrdad Kiani</strong></span>
      </div>
    `;

    this.dialog.appendChild(this.card);
    container.appendChild(this.dialog);

    this.closeBtn = this.card.querySelector('#about-close-btn') as HTMLButtonElement;
    this.closeBtn.addEventListener('click', () => this.close());

    const copyBtn = this.card.querySelector('#about-copy-email-btn') as HTMLButtonElement;
    let copyTimer: number | null = null;
    copyBtn.addEventListener('click', async () => {
      const email = 'mehrdad.kiani.eng@gmail.com';
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = email;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      copyBtn.dataset.copied = 'true';
      copyBtn.innerHTML = `${Icons.check(14)}<span>Copied</span>`;
      if (copyTimer !== null) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        copyBtn.dataset.copied = 'false';
        copyBtn.innerHTML = `${Icons.copy(14)}<span>Copy</span>`;
      }, 2000);
    });

    // Progressive enhancement fallback for browsers without native <dialog closedby="any"> (e.g. Safari)
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e: PointerEvent): boolean => {
        const r = this.dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      this.dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = isOutside(e);
      });
      this.dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && isOutside(e)) {
          this.close();
        }
      });
    }

    // Restore focus to the trigger control when closed (WCAG Modal Dialog pattern)
    this.dialog.addEventListener('close', () => {
      if (this.opener && document.contains(this.opener)) {
        this.opener.focus();
      }
      this.opener = null;
    });
  }

  public open(opener?: HTMLElement | null): void {
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
    if (!this.dialog.open) {
      this.dialog.showModal();
    }
  }

  public close(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
  }

  public getIsOpen(): boolean {
    return this.dialog.open;
  }
}
