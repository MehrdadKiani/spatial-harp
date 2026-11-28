import * as Tone from 'tone';
import {
  AudioEngineConfig,
  AudioFxParams,
  DelayTimeDivision,
  PluckEvent,
  SoundPresetId,
  SoundPresetInfo,
} from '../types/audio';
import { globalBus } from '../core/event-bus';

export const PRESET_FX_DEFAULTS: Record<SoundPresetId, AudioFxParams> = {
  harp: {
    reverbWet: 0.30,
    delayWet: 0.12,
    delayFeedback: 0.22,
    delayTime: '8n.',
  },
  laser: {
    reverbWet: 0.24,
    delayWet: 0.32,
    delayFeedback: 0.38,
    delayTime: '16n.',
  },
  chime: {
    reverbWet: 0.52,
    delayWet: 0.22,
    delayFeedback: 0.28,
    delayTime: '8n',
  },
  retro8bit: {
    reverbWet: 0.10,
    delayWet: 0.08,
    delayFeedback: 0.15,
    delayTime: '16n',
  },
};

export const DELAY_TIME_OPTIONS: { value: DelayTimeDivision; label: string }[] = [
  { value: '16n', label: '1/16 (Tight)' },
  { value: '16n.', label: '1/16 Dotted' },
  { value: '8n', label: '1/8 (Balanced)' },
  { value: '8n.', label: '1/8 Dotted' },
  { value: '4n', label: '1/4 (Spacious)' },
  { value: '4n.', label: '1/4 Dotted' },
];

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

interface ActiveChimeVoice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  modGain: GainNode;
  ampGain: GainNode;
  cleanedUp: boolean;
}

export class AudioEngine {
  private isAudioStarted = false;
  private currentPresetId: SoundPresetId = 'harp';
  private poolSize: number;
  private lastTriggerTime = 0;

  // Voice pools: harp pre-allocated; laser/retro8bit lazily allocated round-robin;
  // Ambient Chime uses native Web Audio one-shot FM bell voices (immune to Tone.js voice-steal/cancelStop bugs).
  private harpVoicePool: Tone.PluckSynth[] = [];
  private nextHarpVoice = 0;

  private laserVoicePool: Tone.Synth[] = [];
  private nextLaserVoice = 0;

  private activeChimeVoices: ActiveChimeVoice[] = [];
  private maxChimeVoices: number;

  private retro8bitVoicePool: Tone.Synth[] = [];
  private nextRetro8bitVoice = 0;

  // Audio FX Chain
  private mainVolume: Tone.Volume;
  private delay: Tone.FeedbackDelay;
  private reverb: Tone.Reverb;
  private limiter: Tone.Limiter;
  private currentFx: AudioFxParams = { ...PRESET_FX_DEFAULTS.harp };

  constructor(config: AudioEngineConfig = {}) {
    this.poolSize = config.polyphony ?? 12;
    this.maxChimeVoices = Math.max(16, this.poolSize);
    this.currentPresetId = config.preset ?? 'harp';
    const volumeDb = config.volume ?? -4;
    const reverbWet = config.reverbWet ?? 0.3;
    const reverbDecay = config.reverbDecay ?? 2.8;
    const delayWet = config.delayWet ?? 0.12;

    // 1. Master Output FX Chain
    this.mainVolume = new Tone.Volume(volumeDb);
    this.delay = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.22,
      wet: delayWet,
    });
    this.reverb = new Tone.Reverb({
      decay: reverbDecay,
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

    // Apply initial preset FX profile
    this.applyPresetFx(this.currentPresetId);

    // Subscribe to decoupled pluck events via EventBus
    globalBus.on<PluckEvent>('string:plucked', (event) => {
      this.triggerPluck(event);
    });
  }

  private getNextLaserVoice(): Tone.Synth {
    if (this.laserVoicePool.length < this.poolSize) {
      const synth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: {
          attack: 0.005,
          decay: 0.18,
          sustain: 0.05,
          release: 0.22,
        },
      });
      synth.connect(this.mainVolume);
      this.laserVoicePool.push(synth);
      return synth;
    }
    const voice = this.laserVoicePool[this.nextLaserVoice];
    this.nextLaserVoice = (this.nextLaserVoice + 1) % this.laserVoicePool.length;
    return voice;
  }

  /**
   * Triggers a native Web Audio API FM Bell voice routed into the Tone.js master FX chain.
   * Uses ephemeral one-shot oscillators with soft oldest-voice fade-out capping so rapid
   * strumming can never stall, leak voices, or hit Tone.js OneShotSource.cancelStop() races.
   */
  private triggerChimeBell(frequency: number, velocity: number): void {
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    const startTime = rawCtx.currentTime + 0.004;

    // Soft-cap concurrent voices to prevent audio-thread overload during rapid strumming
    while (this.activeChimeVoices.length >= this.maxChimeVoices) {
      const oldest = this.activeChimeVoices.shift();
      if (oldest && !oldest.cleanedUp) {
        try {
          oldest.ampGain.gain.cancelScheduledValues(startTime);
          oldest.ampGain.gain.setTargetAtTime(0.0001, startTime, 0.005);
          oldest.carrier.stop(startTime + 0.025);
          oldest.modulator.stop(startTime + 0.025);
        } catch {
          // Already stopped
        }
      }
    }

    const carrier = rawCtx.createOscillator();
    const modulator = rawCtx.createOscillator();
    const modGain = rawCtx.createGain();
    const ampGain = rawCtx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(frequency, startTime);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(frequency * 3.01, startTime);

    // Metallic FM overtone shimmer envelope (fast bright strike decaying to pure bell fundamental)
    const peakModDepth = frequency * 12 * (0.45 + velocity * 0.55);
    modGain.gain.setValueAtTime(0.0001, startTime);
    modGain.gain.linearRampToValueAtTime(peakModDepth, startTime + 0.005);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, peakModDepth * 0.05), startTime + 0.505);
    modGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.35);

    // Bell amplitude envelope (~1.55s natural decay tail)
    const peakGain = velocity * 0.28;
    ampGain.gain.setValueAtTime(0.0001, startTime);
    ampGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.004);
    ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain * 0.05), startTime + 0.90);
    ampGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.55);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(ampGain);
    Tone.connect(ampGain, this.mainVolume);

    const voice: ActiveChimeVoice = {
      carrier,
      modulator,
      modGain,
      ampGain,
      cleanedUp: false,
    };
    this.activeChimeVoices.push(voice);

    const cleanup = (): void => {
      if (voice.cleanedUp) return;
      voice.cleanedUp = true;
      const idx = this.activeChimeVoices.indexOf(voice);
      if (idx !== -1) this.activeChimeVoices.splice(idx, 1);
      try {
        carrier.disconnect();
        modulator.disconnect();
        modGain.disconnect();
        ampGain.disconnect();
      } catch {
        // Already disconnected
      }
    };

    carrier.onended = cleanup;

    const endTime = startTime + 1.60;
    carrier.start(startTime);
    modulator.start(startTime);
    carrier.stop(endTime);
    modulator.stop(endTime);
  }

  private getNextRetro8bitVoice(): Tone.Synth {
    if (this.retro8bitVoicePool.length < this.poolSize) {
      const synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: {
          attack: 0.002,
          decay: 0.12,
          sustain: 0.05,
          release: 0.12,
        },
      });
      synth.connect(this.mainVolume);
      this.retro8bitVoicePool.push(synth);
      return synth;
    }
    const voice = this.retro8bitVoicePool[this.nextRetro8bitVoice];
    this.nextRetro8bitVoice = (this.nextRetro8bitVoice + 1) % this.retro8bitVoicePool.length;
    return voice;
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
    const defaults = PRESET_FX_DEFAULTS[presetId];
    if (!defaults) return;
    this.setFxParams(defaults);
  }

  /**
   * Updates live Reverb & Delay FX parameters in real time
   */
  public setFxParams(patch: Partial<AudioFxParams>): void {
    try {
      if (patch.reverbWet !== undefined && Number.isFinite(patch.reverbWet)) {
        const clamped = Math.max(0, Math.min(1, patch.reverbWet));
        this.currentFx.reverbWet = clamped;
        this.reverb.wet.value = clamped;
      }
      if (patch.delayWet !== undefined && Number.isFinite(patch.delayWet)) {
        const clamped = Math.max(0, Math.min(1, patch.delayWet));
        this.currentFx.delayWet = clamped;
        this.delay.wet.value = clamped;
      }
      if (patch.delayFeedback !== undefined && Number.isFinite(patch.delayFeedback)) {
        const clamped = Math.max(0, Math.min(0.85, patch.delayFeedback));
        this.currentFx.delayFeedback = clamped;
        this.delay.feedback.value = clamped;
      }
      if (
        patch.delayTime !== undefined &&
        DELAY_TIME_OPTIONS.some((opt) => opt.value === patch.delayTime)
      ) {
        this.currentFx.delayTime = patch.delayTime;
        this.delay.delayTime.value = patch.delayTime;
      }
    } catch (err) {
      console.warn('FX parameter update warning:', err);
    }
  }

  /**
   * Returns a snapshot of the active FX chain parameters
   */
  public getFxParams(): AudioFxParams {
    return { ...this.currentFx };
  }

  /**
   * Restores factory FX defaults for the currently active preset
   */
  public resetPresetFx(): AudioFxParams {
    this.applyPresetFx(this.currentPresetId);
    return this.getFxParams();
  }

  /**
   * Synthesizes audio using the selected preset engine
   */
  public triggerPluck(event: PluckEvent): void {
    if (!this.isAudioStarted) return;

    if (Tone.context.state !== 'running') {
      Tone.context.resume();
    }

    if (!Number.isFinite(event.frequency) || event.frequency <= 0) return;

    // Clamp velocity to audible range [0.25 .. 1.0]
    const vel = Math.max(0.25, Math.min(1.0, event.velocity));

    // Guarantee strictly monotonically increasing audio schedule times
    const now = Math.max(Tone.now(), this.lastTriggerTime + 0.002);
    this.lastTriggerTime = now;

    try {
      switch (this.currentPresetId) {
        case 'harp': {
          const voice = this.harpVoicePool[this.nextHarpVoice];
          this.nextHarpVoice = (this.nextHarpVoice + 1) % this.harpVoicePool.length;

          voice.volume.value = Tone.gainToDb(vel);
          voice.attackNoise = 0.5 + vel * 2.0;
          voice.resonance = Math.min(0.98, 0.92 + vel * 0.05);
          voice.triggerAttack(event.frequency, now);
          break;
        }

        case 'laser': {
          const voice = this.getNextLaserVoice();
          voice.triggerAttackRelease(event.frequency, 0.08, now, vel);
          break;
        }

        case 'chime': {
          this.triggerChimeBell(event.frequency, vel);
          break;
        }

        case 'retro8bit': {
          const voice = this.getNextRetro8bitVoice();
          voice.triggerAttackRelease(event.frequency, 0.08, now, vel * 0.9);
          break;
        }
      }
    } catch (err) {
      console.warn('Audio trigger warning:', err);
    }
  }

  /**
   * Plays a crisp, subtle tactile pop chirp when a hold-to-charge anchor locks in mid-air
   */
  public playAnchorPop(): void {
    if (!this.isAudioStarted) return;
    try {
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      if (rawCtx.state !== 'running') return;

      const now = rawCtx.currentTime + 0.002;
      const osc = rawCtx.createOscillator();
      const gain = rawCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.055);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

      osc.connect(gain);
      Tone.connect(gain, this.mainVolume);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Already disconnected
        }
      };

      osc.start(now);
      osc.stop(now + 0.085);
    } catch {
      // Ignore audio pop errors
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
      this.setFxParams({ reverbWet: options.reverbWet });
    }
    if (options.delayWet !== undefined) {
      this.setFxParams({ delayWet: options.delayWet });
    }
  }
}
