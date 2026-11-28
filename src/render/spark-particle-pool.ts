import * as THREE from 'three';
import { SparkParticle } from '../types/physics';
import { VisualsConfigGroup } from '../core/config';

// Spectrum spark palette matching Neon Guitar String Pluck Animation.gif:
// Hot Pink/Magenta, Electric Violet, Glowing Cyan, Neon Emerald Green, Golden Yellow
const CHROMATIC_SPARK_COLORS = [
  0xff007f, // Hot Pink / Magenta
  0x7c3aed, // Electric Violet
  0x00f0ff, // Glowing Cyan
  0x22ff66, // Neon Emerald Green
  0xffe600, // Golden Neon Yellow
];

export class SparkParticlePool {
  private group: THREE.Group;
  private maxParticles: number;
  private particles: SparkParticle[] = [];
  private activeCount = 0;
  private defaultBurstCount = 40;
  private defaultWaveGlitterCount = 32;

  // 1. Fine Sparkling Dust & Glitter Cores (THREE.Points)
  private points: THREE.Points;
  private pointsMaterial: THREE.PointsMaterial;
  private positionBuffer: Float32Array;
  private colorBuffer: Float32Array;
  private posAttribute: THREE.BufferAttribute;
  private colAttribute: THREE.BufferAttribute;

  // 2. Radial Contact Streaks (THREE.LineSegments)
  private trailLines: THREE.LineSegments;
  private trailPositionBuffer: Float32Array;
  private trailColorBuffer: Float32Array;
  private trailPosAttribute: THREE.BufferAttribute;
  private trailColAttribute: THREE.BufferAttribute;

  private tempColor = new THREE.Color();
  private accentColor = new THREE.Color();
  private scratchWavePos = new THREE.Vector3();

  constructor(scene: THREE.Scene, maxParticles = 420) {
    this.maxParticles = maxParticles;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.positionBuffer = new Float32Array(this.maxParticles * 3);
    this.positionBuffer.fill(9999);
    this.colorBuffer = new Float32Array(this.maxParticles * 3);

    const geometry = new THREE.BufferGeometry();
    this.posAttribute = new THREE.BufferAttribute(this.positionBuffer, 3);
    this.colAttribute = new THREE.BufferAttribute(this.colorBuffer, 3);
    this.posAttribute.setUsage(THREE.DynamicDrawUsage);
    this.colAttribute.setUsage(THREE.DynamicDrawUsage);

    geometry.setAttribute('position', this.posAttribute);
    geometry.setAttribute('color', this.colAttribute);

    this.pointsMaterial = new THREE.PointsMaterial({
      size: 0.009,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    this.points = new THREE.Points(geometry, this.pointsMaterial);
    this.group.add(this.points);

    this.trailPositionBuffer = new Float32Array(this.maxParticles * 2 * 3);
    this.trailPositionBuffer.fill(9999);
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
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    this.trailLines = new THREE.LineSegments(trailGeom, trailMat);
    this.group.add(this.trailLines);

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
        trailLength: 0.03,
        phase: Math.random() * Math.PI * 2,
        type: 'spark',
        active: false,
      });
    }
  }

  public configure(cfg: Partial<VisualsConfigGroup>): void {
    if (cfg.sparkPointSize !== undefined) {
      this.pointsMaterial.size = cfg.sparkPointSize;
    }
    if (cfg.contactSparkBurstCount !== undefined) {
      this.defaultBurstCount = cfg.contactSparkBurstCount;
    }
    if (cfg.waveGlitterParticleCount !== undefined) {
      this.defaultWaveGlitterCount = cfg.waveGlitterParticleCount;
    }
  }

  /**
   * Frame 2 Contact Impact: Tight 360-degree radial starburst of fine sparks at the pluck point
   */
  public emitBurst(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    hexColor: number,
    velocity: number,
    count = this.defaultBurstCount
  ): void {
    this.tempColor.setHex(hexColor);
    const speedBase = 0.35 + velocity * 0.65;

    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      this.activeCount++;
      p.x = origin.x;
      p.y = origin.y;
      p.z = origin.z;
      p.prevX = origin.x;
      p.prevY = origin.y;
      p.prevZ = origin.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.5;

      if (spawned % 3 === 0) {
        p.type = 'mote';
        const moteSpeed = speedBase * (0.08 + Math.random() * 0.22);
        p.vx = moteSpeed * Math.cos(theta) + normal.x * moteSpeed * 0.3;
        p.vy = moteSpeed * Math.sin(theta) + normal.y * moteSpeed * 0.3;
        p.vz = moteSpeed * Math.sin(phi);
        p.life = 0;
        p.maxLife = 0.85 + Math.random() * 0.65;
        p.trailLength = 0.004;
      } else {
        p.type = 'spark';
        const sparkSpeed = speedBase * (0.45 + Math.random() * 0.85);
        p.vx = sparkSpeed * Math.cos(theta) * Math.cos(phi);
        p.vy = sparkSpeed * Math.sin(theta) * Math.cos(phi);
        p.vz = sparkSpeed * Math.sin(phi);
        p.life = 0;
        p.maxLife = 0.22 + Math.random() * 0.28;
        p.trailLength = 0.038 + velocity * 0.025;
      }

      this.accentColor.setHex(0xff007f);
      p.r = Math.min(1.0, this.tempColor.r * 0.5 + this.accentColor.r * 0.7);
      p.g = Math.min(1.0, this.tempColor.g * 0.4 + 0.15);
      p.b = Math.min(1.0, this.tempColor.b * 0.5 + this.accentColor.b * 0.7);
      p.alpha = 1.0;
      p.phase = Math.random() * Math.PI * 2;
      spawned++;
    }
  }

  /**
   * Frame 4 & 6 Wave Shimmer Dust: Fine glittering spectrum dust motes dispersed along the rainbow wave crests
   */
  public emitWaveTrail(
    w1: THREE.Vector3,
    w2: THREE.Vector3,
    normal: THREE.Vector3,
    _hexColor: number,
    velocity: number,
    contactRatio: number,
    count = this.defaultWaveGlitterCount
  ): void {
    let spawned = 0;
    const driftDir = contactRatio <= 0.5 ? 1.0 : -1.0;

    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      const u = 0.06 + Math.random() * 0.88;
      this.scratchWavePos.lerpVectors(w1, w2, u);

      const side = (Math.random() - 0.5) * 2.0;
      const offsetNormal = (Math.random() - 0.5) * 0.035;

      p.active = true;
      this.activeCount++;
      p.x = this.scratchWavePos.x + normal.x * offsetNormal;
      p.y = this.scratchWavePos.y + normal.y * offsetNormal;
      p.z = this.scratchWavePos.z;
      p.prevX = p.x;
      p.prevY = p.y;
      p.prevZ = p.z;

      const speed = (0.04 + Math.random() * 0.14) * (0.5 + velocity * 0.5);
      p.vx = normal.x * speed * side + (Math.random() - 0.5) * 0.06;
      p.vy = normal.y * speed * side + (Math.random() - 0.5) * 0.06;
      p.vz = (Math.random() - 0.5) * 0.04;

      const specPos = driftDir > 0 ? u : 1.0 - u;
      const colorIdx = Math.min(
        CHROMATIC_SPARK_COLORS.length - 1,
        Math.floor(specPos * CHROMATIC_SPARK_COLORS.length)
      );
      this.accentColor.setHex(CHROMATIC_SPARK_COLORS[colorIdx]);

      p.r = this.accentColor.r;
      p.g = this.accentColor.g;
      p.b = this.accentColor.b;

      p.type = 'mote';
      p.life = 0;
      p.maxLife = 0.70 + Math.random() * 0.75;
      p.trailLength = 0.005;
      p.alpha = 1.0;
      p.phase = Math.random() * Math.PI * 2;
      spawned++;
    }
  }

  /**
   * Updates particle dispersion, fine glitter shimmer, and radial streaks (Zero-GC)
   */
  public update(delta: number): void {
    if (this.activeCount === 0) {
      return;
    }

    const clampedDelta = Math.min(delta, 0.05);

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      const idx = i * 3;
      const trailIdx = i * 6;

      p.life += clampedDelta;

      if (p.life >= p.maxLife) {
        p.active = false;
        this.activeCount = Math.max(0, this.activeCount - 1);
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
        const swirl = Math.sin(p.life * 8.0 + p.phase) * 0.08;
        p.vx += swirl * clampedDelta;
        p.vy += Math.cos(p.life * 8.0 + p.phase) * 0.08 * clampedDelta;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vz *= 0.96;
      } else {
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.vz *= 0.92;
      }

      const progress = p.life / p.maxLife;
      const twinkle = 0.75 + 0.25 * Math.sin(p.life * 32.0 + p.phase);
      const fade = Math.pow(1.0 - progress, 1.35) * twinkle;

      this.positionBuffer[idx] = p.x;
      this.positionBuffer[idx + 1] = p.y;
      this.positionBuffer[idx + 2] = p.z;

      this.colorBuffer[idx] = p.r * fade;
      this.colorBuffer[idx + 1] = p.g * fade;
      this.colorBuffer[idx + 2] = p.b * fade;

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

      this.trailColorBuffer[trailIdx] = p.r * fade;
      this.trailColorBuffer[trailIdx + 1] = p.g * fade;
      this.trailColorBuffer[trailIdx + 2] = p.b * fade;

      const tailFade = fade * 0.15;
      this.trailColorBuffer[trailIdx + 3] = p.r * tailFade;
      this.trailColorBuffer[trailIdx + 4] = p.g * tailFade;
      this.trailColorBuffer[trailIdx + 5] = p.b * tailFade;
    }

    this.posAttribute.needsUpdate = true;
    this.colAttribute.needsUpdate = true;
    this.trailPosAttribute.needsUpdate = true;
    this.trailColAttribute.needsUpdate = true;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
