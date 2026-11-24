import * as THREE from 'three';
import { HandGestureState } from '../types/gestures';
import { StringPreviewState } from '../types/instruments';
import { SceneManager } from './scene-manager';
import { VisualsConfigGroup } from '../core/config';

export class DynamicStringView {
  private group: THREE.Group;
  private sceneManager: SceneManager;

  // Main elastic laser core line & glowing beam ribbons
  private lineMesh: THREE.Line;
  private linePositions: Float32Array;
  private coreBeamMesh: THREE.Mesh;
  private coreBeamPositions: Float32Array;
  private outerHaloMesh: THREE.Mesh;
  private outerHaloPositions: Float32Array;

  // Subtle ruler tick marks (up to 30 ticks)
  private maxTicks = 30;
  private tickLines: THREE.LineSegments;
  private tickPositions: Float32Array;

  // Fingertip pinch anchor rings (one per hand)
  private anchorRings: THREE.Mesh[] = [];
  private anchorGlowRings: THREE.Mesh[] = [];

  // Materials & configurable dimensions
  private stringMaterial: THREE.LineBasicMaterial;
  private tickMaterial: THREE.LineBasicMaterial;
  private anchorMaterial: THREE.MeshBasicMaterial;
  private anchorGlowMaterial: THREE.MeshBasicMaterial;
  private previewCoreHalfWidth = 0.0008;
  private previewHaloHalfWidth = 0.0038;
  private majorTickHeight = 0.010;
  private minorTickHeight = 0.005;

  // Reusable scratch vectors to ensure ZERO GC allocations inside tick loop
  private scratchP1 = new THREE.Vector3();
  private scratchP2 = new THREE.Vector3();
  private scratchDir = new THREE.Vector3();
  private scratchNormal = new THREE.Vector3();
  private scratchTickCenter = new THREE.Vector3();
  private scratchTop = new THREE.Vector3();
  private scratchBtm = new THREE.Vector3();

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    const quadIndices = new Uint16Array([0, 1, 2, 2, 1, 3]);

    // 0a. Outer Neon Laser Bloom Halo Ribbon
    this.outerHaloPositions = new Float32Array(4 * 3);
    const outerHaloGeom = new THREE.BufferGeometry();
    outerHaloGeom.setAttribute('position', new THREE.BufferAttribute(this.outerHaloPositions, 3));
    outerHaloGeom.setIndex(new THREE.BufferAttribute(quadIndices, 1));
    const outerHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.outerHaloMesh = new THREE.Mesh(outerHaloGeom, outerHaloMat);
    this.outerHaloMesh.visible = false;
    this.group.add(this.outerHaloMesh);

    // 0b. Saturated Neon Cyan Inner Laser Core Beam Ribbon
    this.coreBeamPositions = new Float32Array(4 * 3);
    const coreBeamGeom = new THREE.BufferGeometry();
    coreBeamGeom.setAttribute('position', new THREE.BufferAttribute(this.coreBeamPositions, 3));
    coreBeamGeom.setIndex(new THREE.BufferAttribute(quadIndices, 1));
    const coreBeamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.coreBeamMesh = new THREE.Mesh(coreBeamGeom, coreBeamMat);
    this.coreBeamMesh.visible = false;
    this.group.add(this.coreBeamMesh);

    // 1. Main Elastic Laser String Filament (Neon Cyan, no white)
    this.stringMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
    });

    this.linePositions = new Float32Array(2 * 3);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.lineMesh = new THREE.Line(lineGeom, this.stringMaterial);
    this.lineMesh.visible = false;
    this.group.add(this.lineMesh);

    // 2. Subtle, High-Transparency Ruler Tick Marks Material
    this.tickMaterial = new THREE.LineBasicMaterial({
      color: 0xaaffdd,
      linewidth: 1.0,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    this.tickPositions = new Float32Array(this.maxTicks * 2 * 3);
    const tickGeom = new THREE.BufferGeometry();
    tickGeom.setAttribute('position', new THREE.BufferAttribute(this.tickPositions, 3));
    this.tickLines = new THREE.LineSegments(tickGeom, this.tickMaterial);
    this.tickLines.visible = false;
    this.group.add(this.tickLines);

    // 3. Anchor Rings (Concentric Reticle at Pinch Points)
    this.anchorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      depthTest: false,
    });

    this.anchorGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    const ringGeom = new THREE.RingGeometry(0.012, 0.016, 24);
    const glowRingGeom = new THREE.RingGeometry(0.006, 0.011, 24);

    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(ringGeom, this.anchorMaterial);
      const glowRing = new THREE.Mesh(glowRingGeom, this.anchorGlowMaterial);
      ring.visible = false;
      glowRing.visible = false;
      this.anchorRings.push(ring);
      this.anchorGlowRings.push(glowRing);
      this.group.add(ring);
      this.group.add(glowRing);
    }
  }

  public configure(cfg: Partial<VisualsConfigGroup>): void {
    if (cfg.previewCoreHalfWidth !== undefined) this.previewCoreHalfWidth = cfg.previewCoreHalfWidth;
    if (cfg.previewHaloHalfWidth !== undefined) this.previewHaloHalfWidth = cfg.previewHaloHalfWidth;
    if (cfg.previewRulerTickOpacity !== undefined) this.tickMaterial.opacity = cfg.previewRulerTickOpacity;
    if (cfg.majorTickHeight !== undefined) this.majorTickHeight = cfg.majorTickHeight;
    if (cfg.minorTickHeight !== undefined) this.minorTickHeight = cfg.minorTickHeight;
  }

  public update(
    gestureStates: HandGestureState[],
    preview: StringPreviewState,
    videoAspect: number,
    elapsed: number
  ): void {
    this.anchorRings.forEach((r) => (r.visible = false));
    this.anchorGlowRings.forEach((r) => (r.visible = false));

    if (preview.mode === 'one-hand' && preview.isActive && preview.point1 && preview.point2) {
      // Show fixed start anchor reticle at point1 and moving pinch reticle at point2
      const w1 = this.sceneManager.toWorldCoords(
        preview.point1.x,
        preview.point1.y,
        preview.point1.z,
        videoAspect
      );
      const w2 = this.sceneManager.toWorldCoords(
        preview.point2.x,
        preview.point2.y,
        preview.point2.z,
        videoAspect
      );

      this.anchorRings[0].position.copy(w1);
      this.anchorGlowRings[0].position.copy(w1);
      this.anchorRings[0].rotation.z = elapsed * 2.0;
      this.anchorGlowRings[0].rotation.z = -elapsed * 1.5;
      this.anchorRings[0].visible = true;
      this.anchorGlowRings[0].visible = true;

      this.anchorRings[1].position.copy(w2);
      this.anchorGlowRings[1].position.copy(w2);
      this.anchorRings[1].rotation.z = elapsed * 2.0;
      this.anchorGlowRings[1].rotation.z = -elapsed * 1.5;
      this.anchorRings[1].visible = true;
      this.anchorGlowRings[1].visible = true;
    } else {
      gestureStates.forEach((gesture, idx) => {
        if (idx >= 2) return;

        if (gesture.pinch.isPinching) {
          const pt = gesture.pinch.pinchPoint;
          const worldPos = this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect);

          const ring = this.anchorRings[idx];
          const glow = this.anchorGlowRings[idx];

          ring.position.copy(worldPos);
          glow.position.copy(worldPos);

          ring.rotation.z = elapsed * 2.0;
          glow.rotation.z = -elapsed * 1.5;

          ring.visible = true;
          glow.visible = true;
        }
      });
    }

    if (preview.isActive && preview.point1 && preview.point2) {
      const w1 = this.sceneManager.toWorldCoords(
        preview.point1.x,
        preview.point1.y,
        preview.point1.z,
        videoAspect
      );
      const w2 = this.sceneManager.toWorldCoords(
        preview.point2.x,
        preview.point2.y,
        preview.point2.z,
        videoAspect
      );

      const p1 = this.scratchP1.copy(w1);
      const p2 = this.scratchP2.copy(w2);

      const dir = this.scratchDir.subVectors(p2, p1);
      const length = dir.length();
      dir.normalize();
      const normal = this.scratchNormal.set(-dir.y, dir.x, 0).normalize();

      this.linePositions[0] = p1.x;
      this.linePositions[1] = p1.y;
      this.linePositions[2] = p1.z;
      this.linePositions[3] = p2.x;
      this.linePositions[4] = p2.y;
      this.linePositions[5] = p2.z;

      (this.lineMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.lineMesh.visible = true;

      const coreW = this.previewCoreHalfWidth;
      const haloW = this.previewHaloHalfWidth;

      this.coreBeamPositions[0] = p1.x + normal.x * coreW;
      this.coreBeamPositions[1] = p1.y + normal.y * coreW;
      this.coreBeamPositions[2] = p1.z;
      this.coreBeamPositions[3] = p1.x - normal.x * coreW;
      this.coreBeamPositions[4] = p1.y - normal.y * coreW;
      this.coreBeamPositions[5] = p1.z;
      this.coreBeamPositions[6] = p2.x + normal.x * coreW;
      this.coreBeamPositions[7] = p2.y + normal.y * coreW;
      this.coreBeamPositions[8] = p2.z;
      this.coreBeamPositions[9] = p2.x - normal.x * coreW;
      this.coreBeamPositions[10] = p2.y - normal.y * coreW;
      this.coreBeamPositions[11] = p2.z;
      (this.coreBeamMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.coreBeamMesh.visible = true;

      this.outerHaloPositions[0] = p1.x + normal.x * haloW;
      this.outerHaloPositions[1] = p1.y + normal.y * haloW;
      this.outerHaloPositions[2] = p1.z;
      this.outerHaloPositions[3] = p1.x - normal.x * haloW;
      this.outerHaloPositions[4] = p1.y - normal.y * haloW;
      this.outerHaloPositions[5] = p1.z;
      this.outerHaloPositions[6] = p2.x + normal.x * haloW;
      this.outerHaloPositions[7] = p2.y + normal.y * haloW;
      this.outerHaloPositions[8] = p2.z;
      this.outerHaloPositions[9] = p2.x - normal.x * haloW;
      this.outerHaloPositions[10] = p2.y - normal.y * haloW;
      this.outerHaloPositions[11] = p2.z;
      (this.outerHaloMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.outerHaloMesh.visible = true;

      const numTicks = Math.min(this.maxTicks, Math.max(8, Math.floor(length * 35)));
      const tickPosAttr = this.tickLines.geometry.attributes.position as THREE.BufferAttribute;
      const array = this.tickPositions;

      let ptr = 0;
      for (let i = 0; i < numTicks; i++) {
        const t = (i + 1) / (numTicks + 1);
        const tickCenter = this.scratchTickCenter.lerpVectors(p1, p2, t);

        const isMajor = i === Math.floor(numTicks / 2) || i % 4 === 0;
        const tickHalfHeight = isMajor ? this.majorTickHeight : this.minorTickHeight;

        const top = this.scratchTop.copy(tickCenter).addScaledVector(normal, tickHalfHeight);
        const btm = this.scratchBtm.copy(tickCenter).addScaledVector(normal, -tickHalfHeight);

        array[ptr++] = top.x;
        array[ptr++] = top.y;
        array[ptr++] = top.z;
        array[ptr++] = btm.x;
        array[ptr++] = btm.y;
        array[ptr++] = btm.z;
      }

      while (ptr < array.length) {
        array[ptr++] = 0;
      }

      tickPosAttr.needsUpdate = true;
      this.tickLines.visible = true;
    } else {
      this.lineMesh.visible = false;
      this.coreBeamMesh.visible = false;
      this.outerHaloMesh.visible = false;
      this.tickLines.visible = false;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
