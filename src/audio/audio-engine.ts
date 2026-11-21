import * as Tone from 'tone';
import { AudioEngineConfig, PluckEvent, SoundPresetId, SoundPresetInfo } from '../types/audio';
import { globalBus } from '../core/event-bus';

export const PRESETS: Record<SoundPresetId, SoundPresetInfo> = {
  harp: {
    id: 'harp',
    label: 'Plucked Harp (Acoustic)',
    description: 'Physical Karplus-Strong string modeling with natural acoustic dampening',
  },
  laser: {
    id: 'laser',
    label: 'Laser Synth (Sci-Fi)',
    description: 'Futuristic saw wave synth with resonant space delay sweeps',
  },
  chime: {
    id: 'chime',
    label: 'Ambient Chime (FM Bell)',
    description: 'Inharmonic metallic bells suspended in lush ethereal reverb',
  },
  retro8bit: {
    id: 'retro8bit',
    label: 'Retro 8-Bit (Arcade)',
    description: 'Crisp square wave chiptune synth with punchy arcade transients',
  },
};

export class AudioEngine {
  private isAudioStarted = false;
  private currentPresetId: SoundPresetId = 'harp';
  private poolSize: number;
  private lastTriggerTime = 0;

  // 1. Karplus-Strong Physical PluckSynth Voice Pool
  private harpVoicePool: Tone.PluckSynth[] = [];
  private nextHarpVoice = 0;

  // 2. Synthesizer engines for other presets
  private laserSynth: Tone.PolySynth;
  private chimeSynth: Tone.PolySynth;
  private retro8bitSynth: Tone.PolySynth;

  // Audio FX Chain
  private mainVolume: Tone.Volume;
  private delay: Tone.FeedbackDelay;
  private reverb: Tone.Reverb;
  private limiter: Tone.Limiter;

  constructor(config: AudioEngineConfig = {}) {
    this.poolSize = config.polyphony ?? 12;
    this.currentPresetId = config.preset ?? 'harp';
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
      decay: 2.8,
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
      this.harpVoicePool.push(synth);
    }

    // 3. Laser Synth: Polyphonic Sawtooth Synth with fast punchy decay
    // Note: sustain > 0 prevents Tone.Synth from prematurely stopping the oscillator during attack
    this.laserSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.005,
        decay: 0.18,
        sustain: 0.05,
        release: 0.22,
      },
    });
    this.laserSynth.maxPolyphony = 24;
    this.laserSynth.connect(this.mainVolume);

    // 4. Ambient Chime: Polyphonic FM Synth with inharmonic bell ratios
    this.chimeSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 12,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.003,
        decay: 0.9,
        sustain: 0.05,
        release: 1.4,
      },
      modulation: { type: 'sine' },
      modulationEnvelope: {
        attack: 0.005,
        decay: 0.5,
        sustain: 0.05,
        release: 0.8,
      },
    });
    this.chimeSynth.maxPolyphony = 24;
    this.chimeSynth.connect(this.mainVolume);

    // 5. Retro 8-Bit: Polyphonic Square Wave Chiptune Synth
    this.retro8bitSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: {
        attack: 0.002,
        decay: 0.12,
        sustain: 0.05,
        release: 0.12,
      },
    });
    this.retro8bitSynth.maxPolyphony = 24;
    this.retro8bitSynth.connect(this.mainVolume);

    // Apply initial preset FX profile
    this.applyPresetFx(this.currentPresetId);

    // Subscribe to decoupled pluck events via EventBus
    globalBus.on<PluckEvent>('string:plucked', (event) => {
      this.triggerPluck(event);
    });
  }

  /**
   * Resumes and unlocks the Web Audio AudioContext after user interaction
   */
  public async unlock(): Promise<boolean> {
    if (this.isAudioStarted && Tone.context.state === 'running') return true;

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
   * Switches the active instrument preset and adjusts FX parameters
   */
  public setPreset(presetId: SoundPresetId): void {
    if (!PRESETS[presetId]) return;
    this.currentPresetId = presetId;
    this.applyPresetFx(presetId);
  }

  private applyPresetFx(presetId: SoundPresetId): void {
    switch (presetId) {
      case 'harp':
        this.delay.wet.value = 0.12;
        this.delay.delayTime.value = '8n.';
        this.delay.feedback.value = 0.22;
        this.reverb.wet.value = 0.30;
        break;

      case 'laser':
        this.delay.wet.value = 0.32;
        this.delay.delayTime.value = '16n.';
        this.delay.feedback.value = 0.38;
        this.reverb.wet.value = 0.24;
        break;

      case 'chime':
        this.delay.wet.value = 0.22;
        this.delay.delayTime.value = '8n';
        this.delay.feedback.value = 0.28;
        this.reverb.wet.value = 0.52;
        break;

      case 'retro8bit':
        this.delay.wet.value = 0.08;
        this.delay.delayTime.value = '16n';
        this.delay.feedback.value = 0.15;
        this.reverb.wet.value = 0.10;
        break;
    }
  }

  /**
   * Synthesizes audio using the selected preset engine
   */
  public triggerPluck(event: PluckEvent): void {
    if (!this.isAudioStarted) return;

    if (Tone.context.state !== 'running') {
      Tone.context.resume();
    }

    // Clamp velocity to audible range [0.25 .. 1.0]
    const vel = Math.max(0.25, Math.min(1.0, event.velocity));

    // Guarantee strictly monotonically increasing audio schedule times
    const now = Math.max(Tone.now(), this.lastTriggerTime + 0.002);
    this.lastTriggerTime = now;

    try {
      switch (this.currentPresetId) {
        case 'harp': {
          const voice = this.harpVoicePool[this.nextHarpVoice];
          this.nextHarpVoice = (this.nextHarpVoice + 1) % this.poolSize;

          voice.volume.value = Tone.gainToDb(vel);
          voice.attackNoise = 0.5 + vel * 2.0;
          voice.resonance = Math.min(0.98, 0.92 + vel * 0.05);
          voice.triggerAttack(event.frequency, now);
          break;
        }

        case 'laser': {
          this.laserSynth.triggerAttackRelease(event.frequency, 0.08, now, vel);
          break;
        }

        case 'chime': {
          this.chimeSynth.triggerAttackRelease(event.frequency, 0.08, now, vel * 0.85);
          break;
        }

        case 'retro8bit': {
          this.retro8bitSynth.triggerAttackRelease(event.frequency, 0.08, now, vel * 0.9);
          break;
        }
      }
    } catch (err) {
      console.warn('Audio trigger warning:', err);
    }
  }

  public get isReady(): boolean {
    return this.isAudioStarted && Tone.context.state === 'running';
  }

  public get currentPreset(): SoundPresetId {
    return this.currentPresetId;
  }

  public getPresets(): SoundPresetInfo[] {
    return Object.values(PRESETS);
  }

  public setVolume(volumeDb: number): void {
    this.mainVolume.volume.value = volumeDb;
  }

  public configure(options: {
    volumeDb?: number;
    reverbWet?: number;
    delayWet?: number;
    defaultPreset?: SoundPresetId;
  }): void {
    if (options.volumeDb !== undefined) {
      this.mainVolume.volume.value = options.volumeDb;
    }
    if (options.defaultPreset) {
      this.setPreset(options.defaultPreset);
    }
    if (options.reverbWet !== undefined) {
      this.reverb.wet.value = options.reverbWet;
    }
    if (options.delayWet !== undefined) {
      this.delay.wet.value = options.delayWet;
    }
  }
}
