export class HUD {
  private element: HTMLDivElement;
  private fpsDisplay: HTMLSpanElement;
  private handsDisplay: HTMLSpanElement;
  private gestureDisplay: HTMLSpanElement;
  private stringsDisplay: HTMLSpanElement;
  private statusDisplay: HTMLDivElement;
  private clearBtn: HTMLButtonElement;

  constructor(container: HTMLElement, onClear?: () => void) {
    this.element = document.createElement('div');
    this.element.id = 'hud-overlay';

    Object.assign(this.element.style, {
      position: 'absolute',
      top: '16px',
      left: '16px',
      zIndex: '10',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
      fontSize: '13px',
      pointerEvents: 'none',
      userSelect: 'none',
    });

    this.element.innerHTML = `
      <div style="background: rgba(10, 15, 25, 0.85); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 12px 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4); min-width: 270px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.5px; color: #00ffaa; text-transform: uppercase;">Spatial Laser Harp</span>
          <span style="background: rgba(0, 255, 170, 0.15); color: #00ffaa; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 600;">STEP 3</span>
        </div>
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; color: #b0c4de;">
          <span>FPS:</span>
          <span id="hud-fps" style="font-weight: 600; color: #ffffff;">--</span>
          <span>Hands:</span>
          <span id="hud-hands" style="font-weight: 600; color: #ffffff;">Searching...</span>
          <span>Gesture:</span>
          <span id="hud-gesture" style="font-weight: 600; color: #ffffff;">None</span>
          <span>Strings:</span>
          <span id="hud-strings" style="font-weight: 600; color: #00f0ff;">0 / 12</span>
        </div>
        <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px;">
          <div id="hud-status" style="font-size: 12px; color: #9ab; flex: 1; padding-right: 8px;">
            Pinch thumb & index on both hands to stretch a string
          </div>
          <button id="hud-clear-btn" style="background: rgba(255, 68, 68, 0.18); border: 1px solid rgba(255, 68, 68, 0.35); color: #ff8888; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer; pointer-events: auto; white-space: nowrap; transition: background 0.2s;">
            Clear [C]
          </button>
        </div>
      </div>
    `;

    container.appendChild(this.element);

    this.fpsDisplay = this.element.querySelector('#hud-fps')!;
    this.handsDisplay = this.element.querySelector('#hud-hands')!;
    this.gestureDisplay = this.element.querySelector('#hud-gesture')!;
    this.stringsDisplay = this.element.querySelector('#hud-strings')!;
    this.statusDisplay = this.element.querySelector('#hud-status')!;
    this.clearBtn = this.element.querySelector('#hud-clear-btn')!;

    if (onClear) {
      this.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClear();
      });
    }

    this.clearBtn.addEventListener('mouseenter', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.35)';
    });
    this.clearBtn.addEventListener('mouseleave', () => {
      this.clearBtn.style.background = 'rgba(255, 68, 68, 0.18)';
    });
  }

  public update(
    fps: number,
    handsCount: number,
    handDetails: string[],
    isDualPinching: boolean,
    singlePinchHand: string | null,
    stringsCount: number,
    maxStrings: number,
    isGrabbingEndpoint: boolean = false
  ): void {
    this.fpsDisplay.textContent = `${fps}`;
    this.fpsDisplay.style.color = fps >= 30 ? '#00ffaa' : fps >= 20 ? '#ffaa00' : '#ff4444';

    this.stringsDisplay.textContent = `${stringsCount} / ${maxStrings}`;
    this.stringsDisplay.style.color = stringsCount > 0 ? '#00f0ff' : '#8899aa';

    if (handsCount === 0) {
      this.handsDisplay.textContent = 'None detected';
      this.handsDisplay.style.color = '#ff6666';
      this.gestureDisplay.textContent = 'None';
      this.statusDisplay.textContent = stringsCount > 0
        ? `${stringsCount} string(s) anchored in space. Raise hands to stretch or adjust.`
        : 'Raise your hands in front of the camera';
      return;
    }

    this.handsDisplay.textContent = `${handsCount} (${handDetails.join(', ')})`;
    this.handsDisplay.style.color = '#00ffaa';

    if (isGrabbingEndpoint) {
      this.gestureDisplay.textContent = 'Grabbing String Tip';
      this.gestureDisplay.style.color = '#ffdd00';
      this.statusDisplay.textContent = '🎯 Dragging string endpoint — move hand to reposition, release to lock';
    } else if (isDualPinching) {
      this.gestureDisplay.textContent = 'Dual Pinch (Stretching)';
      this.gestureDisplay.style.color = '#00ffff';
      this.statusDisplay.textContent = '⚡ Release pinch to anchor this string in mid-air!';
    } else if (singlePinchHand) {
      this.gestureDisplay.textContent = `Pinch (${singlePinchHand})`;
      this.gestureDisplay.style.color = '#ffcc00';
      this.statusDisplay.textContent = stringsCount > 0
        ? 'Pinch near any string tip to grab & move it, or pinch other hand to add a string'
        : 'Pinch with other hand to connect the laser string';
    } else {
      this.gestureDisplay.textContent = 'Open Hand';
      this.gestureDisplay.style.color = '#b0c4de';
      this.statusDisplay.textContent = stringsCount > 0
        ? `Harp active (${stringsCount} strings). Pinch a tip to reposition, or both hands to add another.`
        : 'Pinch thumb & index finger on both hands to stretch a string';
    }
  }

  public setMessage(msg: string): void {
    this.statusDisplay.textContent = msg;
  }
}
