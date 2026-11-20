export class VideoBackground {
  public videoElement: HTMLVideoElement;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.videoElement = document.createElement('video');
    this.videoElement.id = 'webcam-feed';
    this.videoElement.setAttribute('playsinline', '');
    this.videoElement.setAttribute('webkit-playsinline', '');
    this.videoElement.muted = true;
    this.videoElement.autoplay = true;

    // Styling: Mirrored, centered, fitting container
    Object.assign(this.videoElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      transform: 'scaleX(-1)', // Mirrored for intuitive selfie interaction
      zIndex: '0',
      backgroundColor: '#0a0a0f',
    });

    this.container.prepend(this.videoElement);
  }

  /**
   * Returns the rendered on-screen rectangle of the video taking object-fit: contain into account.
   */
  public getVideoRect(): { left: number; top: number; width: number; height: number } {
    const contW = this.container.clientWidth;
    const contH = this.container.clientHeight;
    const vidW = this.videoElement.videoWidth || 1280;
    const vidH = this.videoElement.videoHeight || 720;

    const contAspect = contW / contH;
    const vidAspect = vidW / vidH;

    let renderW = contW;
    let renderH = contH;
    let left = 0;
    let top = 0;

    if (contAspect > vidAspect) {
      // Container wider than video -> pillarbox left/right
      renderH = contH;
      renderW = contH * vidAspect;
      left = (contW - renderW) / 2;
    } else {
      // Container taller than video -> letterbox top/bottom
      renderW = contW;
      renderH = contW / vidAspect;
      top = (contH - renderH) / 2;
    }

    return { left, top, width: renderW, height: renderH };
  }
}
