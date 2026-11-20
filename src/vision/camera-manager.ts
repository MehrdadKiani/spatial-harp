export interface CameraConfig {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
}

export class CameraManager {
  public video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  public isReady = false;

  constructor(videoElement?: HTMLVideoElement) {
    if (videoElement) {
      this.video = videoElement;
    } else {
      this.video = document.createElement('video');
      this.video.setAttribute('playsinline', '');
      this.video.setAttribute('webkit-playsinline', '');
      this.video.muted = true;
      this.video.autoplay = true;
      this.video.style.display = 'none';
      document.body.appendChild(this.video);
    }
  }

  public async start(config: CameraConfig = {}): Promise<void> {
    const width = config.width || 1280;
    const height = config.height || 720;
    const facingMode = config.facingMode || 'user';

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: width },
        height: { ideal: height },
        facingMode,
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(() => {
            this.isReady = true;
            resolve();
          });
        };
      });
    } catch (err) {
      console.error('Camera access error:', err);
      throw new Error(`Failed to access camera: ${(err as Error).message}`);
    }
  }

  public stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.isReady = false;
  }

  public get videoWidth(): number {
    return this.video.videoWidth || 1280;
  }

  public get videoHeight(): number {
    return this.video.videoHeight || 720;
  }

  public get aspectRatio(): number {
    return this.videoWidth / this.videoHeight;
  }
}
