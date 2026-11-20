import * as Tone from 'tone';
import { AudioEngineConfig, PluckEvent } from '../types/audio';
import { globalBus } from '../core/event-bus';

export class AudioEngine {
  private isAudioStarted = false;
  private voicePool: Tone.PluckSynth[] = [];
  private poolSize: number;
  private nextVoice = 0;

  // Audio FX Chain
  private mainVolume: Tone.Volume;
  private delay: Tone.FeedbackDelay;
  private reverb: Tone.Reverb;
  private limiter: Tone.Limiter;

  constructor(config: AudioEngineConfig = {}) {
    this.poolSize = config.polyphony ?? 8;
    const volumeDb = config.volume ?? -4;
    const reverbWet = config.reverbWet ?? 0.3;
    const delayWet = config.delayWet ?? 0.12;

    // 1. Master Output FX Chain
    this.mainVolume = new Tone.Volume(volumeDb);
    this.delay = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.22,
      wet: delayWet,
    });
    this.reverb = new Tone.Reverb({
      decay: 2.6,
      preDelay: 0.01,
      wet: reverbWet,
    });
    this.limiter = new Tone.Limiter(-1.0);

    // Chain: MainVolume -> Delay -> Reverb -> Limiter -> Destination
    this.mainVolume.chain(this.delay, this.reverb, this.limiter, Tone.Destination);

    // 2. Pre-allocate Karplus-Strong Polyphonic PluckSynth Voice Pool
    for (let i = 0; i < this.poolSize; i++) {
      const synth = new Tone.PluckSynth({
        attackNoise: 1.0,
        dampening: 4200,
        resonance: 0.96,
      });
      synth.connect(this.mainVolume);
      this.voicePool.push(synth);
    }

    // 3. Subscribe to decoupled pluck events via EventBus
    globalBus.on<PluckEvent>('string:plucked', (event) => {
      this.triggerPluck(event);
    });
  }

  /**
   * Resumes and unlocks the Web Audio AudioContext after user interaction
   */
  public async unlock(): Promise<boolean> {
    if (this.isAudioStarted) return true;

    try {
      await Tone.start();
      if (Tone.context.state === 'running') {
        this.isAudioStarted = true;
        console.log('Tone.js Web Audio context unlocked successfully.');
        globalBus.emit('audio:unlocked', { state: 'running' });
        return true;
      }
    } catch (err) {
      console.warn('Failed to start AudioContext:', err);
    }
    return false;
  }

  /**
   * Synthesizes physical Karplus-Strong string pluck
   */
  public triggerPluck(event: PluckEvent): void {
    if (!this.isAudioStarted) return;

    const voice = this.voicePool[this.nextVoice];
    this.nextVoice = (this.nextVoice + 1) % this.poolSize;

    // Clamp velocity to audible range [0.25 .. 1.0]
    const vel = Math.max(0.25, Math.min(1.0, event.velocity));

    // Dynamic Karplus-Strong velocity mapping:
    // Scale volume with gainToDb for natural acoustic dynamics
    voice.volume.value = Tone.gainToDb(vel);
    voice.attackNoise = 0.5 + vel * 2.0;
    voice.resonance = Math.min(0.98, 0.92 + vel * 0.05);

    // Trigger physical acoustic plucked string
    voice.triggerAttack(event.frequency);
  }

  public get isReady(): boolean {
    return this.isAudioStarted && Tone.context.state === 'running';
  }

  public setVolume(volumeDb: number): void {
    this.mainVolume.volume.value = volumeDb;
  }
}
