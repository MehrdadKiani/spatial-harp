import * as THREE from 'three';
import { ShockwaveState } from '../types/physics';
import { VisualsConfigGroup } from '../core/config';

export class PluckShockwavePool {
  private group: THREE.Group;
  private maxShockwaves = 10;
  private shockwaves: ShockwaveState[] = [];
  private baseOpacity = 0.28;
  private baseDurationSec = 0.24;
  private baseMaxRadius = 0.036;

  // Expanding circular contact shockwave rings + inner contact flash disc
  private ringMeshes: THREE.Mesh[] = [];
  private ringMaterials: THREE.MeshBasicMaterial[] = [];
  private innerRingMeshes: THREE.Mesh[] = [];
  private innerRingMaterials: THREE.MeshBasicMaterial[] = [];

  private nextIndex = 0;
  private tempColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Pre-allocate unit ring geometries (scaled dynamically via mesh.scale to remain Zero-GC)
    const outerRingGeom = new THREE.RingGeometry(0.88, 1.0, 48);
    const innerRingGeom = new THREE.RingGeometry(0.55, 0.72, 48);

    for (let i = 0; i < this.maxShockwaves; i++) {
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });

      const outerMesh = new THREE.Mesh(outerRingGeom, outerMat);
      outerMesh.visible = false;
      this.group.add(outerMesh);

      this.ringMeshes.push(outerMesh);
      this.ringMaterials.push(outerMat);

      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });

      const innerMesh = new THREE.Mesh(innerRingGeom, innerMat);
      innerMesh.visible = false;
      this.group.add(innerMesh);

      this.innerRingMeshes.push(innerMesh);
      this.innerRingMaterials.push(innerMat);

      this.shockwaves.push({
        id: i,
        x: 0,
        y: 0,
        z: 0,
        radius: 0.008,
        maxRadius: 0.085,
        r: 1,
        g: 1,
        b: 1,
        alpha: 0,
        elapsed: 0,
        duration: 0.28,
        active: false,
      });
    }
  }

  public configure(cfg: Partial<VisualsConfigGroup>): void {
    if (cfg.contactStarburstOpacity !== undefined) this.baseOpacity = cfg.contactStarburstOpacity;
    if (cfg.contactStarburstDurationSec !== undefined) this.baseDurationSec = cfg.contactStarburstDurationSec;
    if (cfg.contactStarburstMaxRadius !== undefined) this.baseMaxRadius = cfg.contactStarburstMaxRadius;
  }

  /**
   * Spawns an expanding circular shockwave ripple ring at the exact pluck contact point
   */
  public emitShockwave(origin: THREE.Vector3, hexColor: number, velocity: number): void {
    const idx = this.nextIndex;
    const sw = this.shockwaves[idx];
    const outerMesh = this.ringMeshes[idx];
    const outerMat = this.ringMaterials[idx];
    const innerMesh = this.innerRingMeshes[idx];
    const innerMat = this.innerRingMaterials[idx];

    this.nextIndex = (this.nextIndex + 1) % this.maxShockwaves;
    this.tempColor.setHex(hexColor);

    sw.active = true;
    sw.x = origin.x;
    sw.y = origin.y;
    sw.z = origin.z;
    sw.radius = 0.005;
    sw.elapsed = 0;
    sw.duration = this.baseDurationSec + 0.05 * velocity;
    sw.maxRadius = this.baseMaxRadius + 0.014 * velocity;
    sw.alpha = this.baseOpacity;

    outerMesh.position.set(sw.x, sw.y, sw.z + 0.002);
    outerMesh.scale.set(sw.radius, sw.radius, 1);
    outerMat.color.copy(this.tempColor);
    outerMat.opacity = sw.alpha;
    outerMesh.visible = true;

    innerMesh.position.set(sw.x, sw.y, sw.z + 0.0025);
    innerMesh.scale.set(sw.radius * 0.65, sw.radius * 0.65, 1);
    innerMat.color.copy(this.tempColor).lerp(new THREE.Color(0xffffff), 0.5);
    innerMat.opacity = sw.alpha * 0.55;
    innerMesh.visible = true;
  }

  /**
   * Advances expanding circular shockwave ring animation (Zero-GC)
   */
  public update(delta: number): void {
    for (let i = 0; i < this.maxShockwaves; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;

      sw.elapsed += delta;
      const progress = sw.elapsed / sw.duration;

      if (progress >= 1.0) {
        sw.active = false;
        this.ringMeshes[i].visible = false;
        this.innerRingMeshes[i].visible = false;
        continue;
      }

      // Cubic ease-out expansion
      const easeOut = 1.0 - Math.pow(1.0 - progress, 3);
      const currentRadius = 0.005 + (sw.maxRadius - 0.005) * easeOut;
      sw.radius = currentRadius;

      const outerMesh = this.ringMeshes[i];
      outerMesh.scale.set(currentRadius, currentRadius, 1);
      this.ringMaterials[i].opacity = Math.pow(1.0 - progress, 1.6) * sw.alpha;

      const innerRadius = 0.004 + (sw.maxRadius * 0.65 - 0.004) * (1.0 - Math.pow(1.0 - progress, 2.2));
      const innerMesh = this.innerRingMeshes[i];
      innerMesh.scale.set(innerRadius, innerRadius, 1);
      this.innerRingMaterials[i].opacity = Math.pow(1.0 - progress, 2.0) * sw.alpha * 0.55;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
