import * as THREE from 'three';
import { SparkParticle } from '../types/physics';

export class SparkParticlePool {
  private group: THREE.Group;
  private maxParticles = 256;
  private particles: SparkParticle[] = [];

  // Three.js GPU Points & Buffers (Zero-GC)
  private points: THREE.Points;
  private positionBuffer: Float32Array;
  private colorBuffer: Float32Array;
  private posAttribute: THREE.BufferAttribute;
  private colAttribute: THREE.BufferAttribute;

  private tempColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

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
      size: 0.017,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.group.add(this.points);

    // Pre-allocate particle states
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: 1,
        g: 1,
        b: 1,
        alpha: 0,
        life: 0,
        maxLife: 0.5,
        type: 'spark',
        active: false,
      });
    }
  }

  /**
   * Spawns a multi-form burst of glowing fast sparks and floating ambient motes
   */
  public emitBurst(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    hexColor: number,
    velocity: number,
    count = 28
  ): void {
    this.tempColor.setHex(hexColor);
    const speedBase = 0.45 + velocity * 0.85;

    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.x = origin.x;
      p.y = origin.y;
      p.z = origin.z;

      // 65% fast radial sparks, 35% floating ambient motes
      const isMote = spawned % 3 === 0;
      p.type = isMote ? 'mote' : 'spark';

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.75;

      if (isMote) {
        // Floating motes: gentle drift with upward thermal bias
        const moteSpeed = speedBase * (0.15 + Math.random() * 0.25);
        p.vx = moteSpeed * Math.cos(theta) + normal.x * moteSpeed * 0.2;
        p.vy = Math.abs(moteSpeed * Math.sin(theta)) * 0.5 + 0.06 + Math.random() * 0.08;
        p.vz = moteSpeed * Math.sin(phi);
        p.life = 0;
        p.maxLife = 0.65 + Math.random() * 0.35; // 650ms to 1000ms
        // Slightly brighter white-shifted core
        p.r = Math.min(1.0, this.tempColor.r * 1.2 + 0.2);
        p.g = Math.min(1.0, this.tempColor.g * 1.2 + 0.2);
        p.b = Math.min(1.0, this.tempColor.b * 1.2 + 0.2);
      } else {
        // Fast radial sparks: explosive burst with gravity
        const sparkSpeed = speedBase * (0.65 + Math.random() * 0.85);
        p.vx = sparkSpeed * Math.cos(theta) * Math.cos(phi) + normal.x * sparkSpeed * 0.45;
        p.vy = sparkSpeed * Math.sin(theta) * Math.cos(phi) + normal.y * sparkSpeed * 0.45 + 0.08;
        p.vz = sparkSpeed * Math.sin(phi);
        p.life = 0;
        p.maxLife = 0.30 + Math.random() * 0.30; // 300ms to 600ms
        p.r = Math.min(1.0, this.tempColor.r * 1.3);
        p.g = Math.min(1.0, this.tempColor.g * 1.3);
        p.b = Math.min(1.0, this.tempColor.b * 1.3);
      }

      p.alpha = 1.0;
      spawned++;
    }
  }

  /**
   * Updates particle physics (gravity, drag, buoyancy, alpha fade) with zero GC allocations
   */
  public update(delta: number): void {
    let hasActive = false;
    const clampedDelta = Math.min(delta, 0.05);

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      const idx = i * 3;

      if (!p.active) {
        this.positionBuffer[idx] = 9999;
        this.positionBuffer[idx + 1] = 9999;
        this.positionBuffer[idx + 2] = 9999;
        continue;
      }

      hasActive = true;
      p.life += clampedDelta;

      if (p.life >= p.maxLife) {
        p.active = false;
        this.positionBuffer[idx] = 9999;
        this.positionBuffer[idx + 1] = 9999;
        this.positionBuffer[idx + 2] = 9999;
        continue;
      }

      p.x += p.vx * clampedDelta;
      p.y += p.vy * clampedDelta;
      p.z += p.vz * clampedDelta;

      if (p.type === 'mote') {
        // Floating motes: gentle upward buoyancy, higher drag
        p.vy += 0.04 * clampedDelta;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vz *= 0.96;
      } else {
        // Fast sparks: downward gravity, standard drag
        p.vy -= 1.15 * clampedDelta;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.vz *= 0.94;
      }

      const progress = p.life / p.maxLife;
      const fade = Math.pow(1.0 - progress, 1.2);

      this.positionBuffer[idx] = p.x;
      this.positionBuffer[idx + 1] = p.y;
      this.positionBuffer[idx + 2] = p.z;

      this.colorBuffer[idx] = p.r * fade;
      this.colorBuffer[idx + 1] = p.g * fade;
      this.colorBuffer[idx + 2] = p.b * fade;
    }

    if (hasActive) {
      this.posAttribute.needsUpdate = true;
      this.colAttribute.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
