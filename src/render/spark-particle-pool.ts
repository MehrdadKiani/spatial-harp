import * as THREE from 'three';
import { SparkParticle } from '../types/physics';

// Chromatic sci-fi laser palette: Cyan, Electric Blue, Neon Magenta, Vivid Purple
const CHROMATIC_SPARK_COLORS = [
  0x00f0ff, // Neon Cyan
  0x38bdf8, // Electric Blue
  0xff007f, // Neon Magenta
  0xa855f7, // Vivid Purple
  0xffffff, // White-hot core
];

export class SparkParticlePool {
  private group: THREE.Group;
  private maxParticles = 384;
  private particles: SparkParticle[] = [];

  // 1. Three.js GPU Points for glowing spark cores & floating motes (Zero-GC)
  private points: THREE.Points;
  private positionBuffer: Float32Array;
  private colorBuffer: Float32Array;
  private posAttribute: THREE.BufferAttribute;
  private colAttribute: THREE.BufferAttribute;

  // 2. Three.js GPU LineSegments for flowing luminous light trails & motion-blur streaks (Zero-GC)
  private trailLines: THREE.LineSegments;
  private trailPositionBuffer: Float32Array;
  private trailColorBuffer: Float32Array;
  private trailPosAttribute: THREE.BufferAttribute;
  private trailColAttribute: THREE.BufferAttribute;

  private tempColor = new THREE.Color();
  private accentColor = new THREE.Color();
  private scratchWavePos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // 1. Points buffer setup
    this.positionBuffer = new Float32Array(this.maxParticles * 3);
    this.colorBuffer = new Float32Array(this.maxParticles * 3);

    const geometry = new THREE.BufferGeometry();
    this.posAttribute = new THREE.BufferAttribute(this.positionBuffer, 3);
    this.colAttribute = new THREE.BufferAttribute(this.colorBuffer, 3);
    this.posAttribute.setUsage(THREE.DynamicDrawUsage);
    this.colAttribute.setUsage(THREE.DynamicDrawUsage);

    geometry.setAttribute('position', this.posAttribute);
    geometry.setAttribute('color', this.colAttribute);

    const material = new THREE.PointsMaterial({
      size: 0.016,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.group.add(this.points);

    // 2. Luminous Light Trail Streaks buffer setup (2 vertices per particle = head + tail)
    this.trailPositionBuffer = new Float32Array(this.maxParticles * 2 * 3);
    this.trailColorBuffer = new Float32Array(this.maxParticles * 2 * 3);

    const trailGeom = new THREE.BufferGeometry();
    this.trailPosAttribute = new THREE.BufferAttribute(this.trailPositionBuffer, 3);
    this.trailColAttribute = new THREE.BufferAttribute(this.trailColorBuffer, 3);
    this.trailPosAttribute.setUsage(THREE.DynamicDrawUsage);
    this.trailColAttribute.setUsage(THREE.DynamicDrawUsage);

    trailGeom.setAttribute('position', this.trailPosAttribute);
    trailGeom.setAttribute('color', this.trailColAttribute);

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    this.trailLines = new THREE.LineSegments(trailGeom, trailMat);
    this.group.add(this.trailLines);

    // Pre-allocate particle states
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        z: 0,
        prevX: 0,
        prevY: 0,
        prevZ: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: 1,
        g: 1,
        b: 1,
        alpha: 0,
        life: 0,
        maxLife: 0.8,
        trailLength: 0.04,
        phase: Math.random() * Math.PI * 2,
        type: 'spark',
        active: false,
      });
    }
  }

  /**
   * Spawns a radial burst of glowing sparks, chromatic light trails, and floating motes at the contact point
   */
  public emitBurst(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    hexColor: number,
    velocity: number,
    count = 36
  ): void {
    this.tempColor.setHex(hexColor);
    const speedBase = 0.50 + velocity * 0.90;

    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.x = origin.x;
      p.y = origin.y;
      p.z = origin.z;
      p.prevX = origin.x;
      p.prevY = origin.y;
      p.prevZ = origin.z;

      // Chromatic blend: mix string color with cyan/magenta/purple/blue palette
      const paletteHex = CHROMATIC_SPARK_COLORS[spawned % CHROMATIC_SPARK_COLORS.length];
      this.accentColor.setHex(paletteHex);

      const mode = spawned % 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.75;

      if (mode === 0) {
        // Floating glowing motes: long-lived (1.0s - 1.65s), swirling around the string
        p.type = 'mote';
        const moteSpeed = speedBase * (0.14 + Math.random() * 0.24);
        p.vx = moteSpeed * Math.cos(theta) + normal.x * moteSpeed * 0.25;
        p.vy = Math.abs(moteSpeed * Math.sin(theta)) * 0.45 + 0.04 + Math.random() * 0.07;
        p.vz = moteSpeed * Math.sin(phi);
        p.life = 0;
        p.maxLife = 1.05 + Math.random() * 0.65;
        p.trailLength = 0.018;
      } else if (mode === 1) {
        // Flowing light trail ribbons: smooth sweeping arcs with long luminous tails
        p.type = 'trail';
        const trailSpeed = speedBase * (0.45 + Math.random() * 0.65);
        const side = spawned % 2 === 0 ? 1 : -1;
        p.vx = trailSpeed * Math.cos(theta) * 0.6 + normal.x * trailSpeed * 0.75 * side;
        p.vy = trailSpeed * Math.sin(theta) * 0.6 + normal.y * trailSpeed * 0.75 * side;
        p.vz = trailSpeed * Math.sin(phi) * 0.5;
        p.life = 0;
        p.maxLife = 0.75 + Math.random() * 0.55;
        p.trailLength = 0.075 + velocity * 0.045;
      } else {
        // Fast explosive laser sparks: high initial impact, crisp motion blur streaks
        p.type = 'spark';
        const sparkSpeed = speedBase * (0.70 + Math.random() * 0.90);
        p.vx = sparkSpeed * Math.cos(theta) * Math.cos(phi) + normal.x * sparkSpeed * 0.45;
        p.vy = sparkSpeed * Math.sin(theta) * Math.cos(phi) + normal.y * sparkSpeed * 0.45 + 0.06;
        p.vz = sparkSpeed * Math.sin(phi);
        p.life = 0;
        p.maxLife = 0.42 + Math.random() * 0.45;
        p.trailLength = 0.055 + velocity * 0.035;
      }

      // Blend string color (55%) with chromatic cyan/magenta/purple/blue accent (45%)
      p.r = Math.min(1.0, this.tempColor.r * 0.65 + this.accentColor.r * 0.65);
      p.g = Math.min(1.0, this.tempColor.g * 0.65 + this.accentColor.g * 0.65);
      p.b = Math.min(1.0, this.tempColor.b * 0.65 + this.accentColor.b * 0.65);
      p.alpha = 1.0;
      p.phase = Math.random() * Math.PI * 2;
      spawned++;
    }
  }

  /**
   * Emits dispersed wave-rider particles along the string length to visualize the propagating energy wave
   */
  public emitWaveTrail(
    w1: THREE.Vector3,
    w2: THREE.Vector3,
    normal: THREE.Vector3,
    hexColor: number,
    velocity: number,
    contactRatio: number,
    count = 18
  ): void {
    this.tempColor.setHex(hexColor);
    let spawned = 0;

    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      // Distribute along string on both sides of contactRatio
      const spread = (Math.random() - 0.5) * 0.85;
      const u = Math.max(0.04, Math.min(0.96, contactRatio + spread));
      this.scratchWavePos.lerpVectors(w1, w2, u);

      const side = spawned % 2 === 0 ? 1 : -1;
      const distFromPluck = Math.abs(u - contactRatio);
      const localIntensity = Math.max(0.3, 1.0 - distFromPluck * 0.85) * velocity;

      p.active = true;
      p.x = this.scratchWavePos.x + normal.x * (Math.random() - 0.5) * 0.012;
      p.y = this.scratchWavePos.y + normal.y * (Math.random() - 0.5) * 0.012;
      p.z = this.scratchWavePos.z;
      p.prevX = p.x;
      p.prevY = p.y;
      p.prevZ = p.z;

      const speed = (0.16 + Math.random() * 0.28) * (0.5 + localIntensity);
      p.vx = normal.x * speed * side + (Math.random() - 0.5) * 0.12;
      p.vy = normal.y * speed * side + 0.03 + Math.random() * 0.08;
      p.vz = (Math.random() - 0.5) * 0.08;

      const paletteHex = CHROMATIC_SPARK_COLORS[spawned % CHROMATIC_SPARK_COLORS.length];
      this.accentColor.setHex(paletteHex);

      p.r = Math.min(1.0, this.tempColor.r * 0.5 + this.accentColor.r * 0.75);
      p.g = Math.min(1.0, this.tempColor.g * 0.5 + this.accentColor.g * 0.75);
      p.b = Math.min(1.0, this.tempColor.b * 0.5 + this.accentColor.b * 0.75);

      p.type = spawned % 2 === 0 ? 'trail' : 'mote';
      p.life = 0;
      p.maxLife = 0.75 + Math.random() * 0.65;
      p.trailLength = 0.055;
      p.alpha = 1.0;
      p.phase = Math.random() * Math.PI * 2;
      spawned++;
    }
  }

  /**
   * Updates particle dispersion, flowing light trails, and sparkle modulation (Zero-GC)
   */
  public update(delta: number): void {
    let hasActive = false;
    const clampedDelta = Math.min(delta, 0.05);

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      const idx = i * 3;
      const trailIdx = i * 6;

      if (!p.active) {
        this.positionBuffer[idx] = 9999;
        this.positionBuffer[idx + 1] = 9999;
        this.positionBuffer[idx + 2] = 9999;

        this.trailPositionBuffer[trailIdx] = 9999;
        this.trailPositionBuffer[trailIdx + 1] = 9999;
        this.trailPositionBuffer[trailIdx + 2] = 9999;
        this.trailPositionBuffer[trailIdx + 3] = 9999;
        this.trailPositionBuffer[trailIdx + 4] = 9999;
        this.trailPositionBuffer[trailIdx + 5] = 9999;
        continue;
      }

      hasActive = true;
      p.life += clampedDelta;

      if (p.life >= p.maxLife) {
        p.active = false;
        this.positionBuffer[idx] = 9999;
        this.positionBuffer[idx + 1] = 9999;
        this.positionBuffer[idx + 2] = 9999;

        this.trailPositionBuffer[trailIdx] = 9999;
        this.trailPositionBuffer[trailIdx + 1] = 9999;
        this.trailPositionBuffer[trailIdx + 2] = 9999;
        this.trailPositionBuffer[trailIdx + 3] = 9999;
        this.trailPositionBuffer[trailIdx + 4] = 9999;
        this.trailPositionBuffer[trailIdx + 5] = 9999;
        continue;
      }

      p.prevX = p.x;
      p.prevY = p.y;
      p.prevZ = p.z;

      p.x += p.vx * clampedDelta;
      p.y += p.vy * clampedDelta;
      p.z += p.vz * clampedDelta;

      if (p.type === 'mote') {
        // Swirling ambient motes with subtle harmonic shimmer
        const swirl = Math.sin(p.life * 7.0 + p.phase) * 0.14;
        p.vx += swirl * clampedDelta;
        p.vy += 0.035 * clampedDelta;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.vz *= 0.965;
      } else if (p.type === 'trail') {
        // Flowing light trail arcs
        const curl = Math.cos(p.life * 9.0 + p.phase) * 0.22;
        p.vx += -p.vy * curl * clampedDelta;
        p.vy += p.vx * curl * clampedDelta;
        p.vx *= 0.945;
        p.vy *= 0.945;
        p.vz *= 0.945;
      } else {
        // Fast sparks with gravity and air drag
        p.vy -= 0.95 * clampedDelta;
        p.vx *= 0.935;
        p.vy *= 0.935;
        p.vz *= 0.935;
      }

      const progress = p.life / p.maxLife;
      // Sparkling scintillation flicker
      const twinkle = 0.80 + 0.20 * Math.sin(p.life * 28.0 + p.phase);
      const fade = Math.pow(1.0 - progress, 1.3) * twinkle;

      // Update Point core
      this.positionBuffer[idx] = p.x;
      this.positionBuffer[idx + 1] = p.y;
      this.positionBuffer[idx + 2] = p.z;

      this.colorBuffer[idx] = p.r * fade;
      this.colorBuffer[idx + 1] = p.g * fade;
      this.colorBuffer[idx + 2] = p.b * fade;

      // Update Luminous Light Trail Streak (head at current pos, tail stretched opposite to velocity)
      const tailScale = p.trailLength * (1.0 - progress * 0.5);
      const tailX = p.x - p.vx * tailScale;
      const tailY = p.y - p.vy * tailScale;
      const tailZ = p.z - p.vz * tailScale;

      this.trailPositionBuffer[trailIdx] = p.x;
      this.trailPositionBuffer[trailIdx + 1] = p.y;
      this.trailPositionBuffer[trailIdx + 2] = p.z;
      this.trailPositionBuffer[trailIdx + 3] = tailX;
      this.trailPositionBuffer[trailIdx + 4] = tailY;
      this.trailPositionBuffer[trailIdx + 5] = tailZ;

      // Head is bright white/chromatic, tail fades into deep purple/blue
      this.trailColorBuffer[trailIdx] = Math.min(1.0, (p.r + 0.25) * fade);
      this.trailColorBuffer[trailIdx + 1] = Math.min(1.0, (p.g + 0.25) * fade);
      this.trailColorBuffer[trailIdx + 2] = Math.min(1.0, (p.b + 0.25) * fade);

      const tailFade = fade * 0.22;
      this.trailColorBuffer[trailIdx + 3] = p.r * tailFade;
      this.trailColorBuffer[trailIdx + 4] = p.g * 0.4 * tailFade;
      this.trailColorBuffer[trailIdx + 5] = Math.min(1.0, (p.b + 0.4) * tailFade);
    }

    if (hasActive) {
      this.posAttribute.needsUpdate = true;
      this.colAttribute.needsUpdate = true;
      this.trailPosAttribute.needsUpdate = true;
      this.trailColAttribute.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
