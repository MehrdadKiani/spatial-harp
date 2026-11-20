import * as THREE from 'three';
import { DualPinchState, HandGestureState } from '../types/gestures';
import { SceneManager } from './scene-manager';

export class DynamicStringView {
  private group: THREE.Group;
  private sceneManager: SceneManager;

  // Main elastic line
  private lineMesh: THREE.Line;
  private linePositions: Float32Array;

  // Ruler tick marks (up to 30 ticks)
  private maxTicks = 30;
  private tickLines: THREE.LineSegments;
  private tickPositions: Float32Array;

  // Fingertip pinch anchor rings (one per hand)
  private anchorRings: THREE.Mesh[] = [];
  private anchorGlowRings: THREE.Mesh[] = [];

  // Materials
  private stringMaterial: THREE.LineBasicMaterial;
  private tickMaterial: THREE.LineBasicMaterial;
  private anchorMaterial: THREE.MeshBasicMaterial;
  private anchorGlowMaterial: THREE.MeshBasicMaterial;

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

    // 1. Main Elastic Laser String Material (Neon White-Cyan with opacity)
    this.stringMaterial = new THREE.LineBasicMaterial({
      color: 0xeeffff,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });

    this.linePositions = new Float32Array(2 * 3); // 2 vertices (A, B)
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.lineMesh = new THREE.Line(lineGeom, this.stringMaterial);
    this.lineMesh.visible = false;
    this.group.add(this.lineMesh);

    // 2. Ruler Tick Marks Material
    this.tickMaterial = new THREE.LineBasicMaterial({
      color: 0xaaffdd,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });

    this.tickPositions = new Float32Array(this.maxTicks * 2 * 3); // 2 vertices per tick
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

  public update(
    gestureStates: HandGestureState[],
    dualPinch: DualPinchState,
    videoAspect: number,
    elapsed: number
  ): void {
    // 1. Update individual pinch anchor rings
    this.anchorRings.forEach((r) => (r.visible = false));
    this.anchorGlowRings.forEach((r) => (r.visible = false));

    gestureStates.forEach((gesture, idx) => {
      if (idx >= 2) return;

      if (gesture.pinch.isPinching) {
        const pt = gesture.pinch.pinchPoint;
        const worldPos = this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect);

        const ring = this.anchorRings[idx];
        const glow = this.anchorGlowRings[idx];

        ring.position.copy(worldPos);
        glow.position.copy(worldPos);

        // Subtle pulsing rotation effect
        ring.rotation.z = elapsed * 2.0;
        glow.rotation.z = -elapsed * 1.5;

        ring.visible = true;
        glow.visible = true;
      }
    });

    // 2. Update dynamic connecting string between dual-pinching hands
    if (dualPinch.isDualPinch && dualPinch.point1 && dualPinch.point2) {
      const w1 = this.sceneManager.toWorldCoords(
        dualPinch.point1.x,
        dualPinch.point1.y,
        dualPinch.point1.z,
        videoAspect
      );
      const w2 = this.sceneManager.toWorldCoords(
        dualPinch.point2.x,
        dualPinch.point2.y,
        dualPinch.point2.z,
        videoAspect
      );

      const p1 = this.scratchP1.copy(w1);
      const p2 = this.scratchP2.copy(w2);

      // Set main line endpoints
      this.linePositions[0] = p1.x;
      this.linePositions[1] = p1.y;
      this.linePositions[2] = p1.z;
      this.linePositions[3] = p2.x;
      this.linePositions[4] = p2.y;
      this.linePositions[5] = p2.z;

      (this.lineMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.lineMesh.visible = true;

      // Compute vector direction and normal for perpendicular tick marks
      const dir = this.scratchDir.subVectors(p2, p1);
      const length = dir.length();
      dir.normalize();

      // Perpendicular 2D normal vector (-dy, dx, 0)
      const normal = this.scratchNormal.set(-dir.y, dir.x, 0).normalize();

      // Number of tick marks proportional to string length (10 to 25 ticks)
      const numTicks = Math.min(this.maxTicks, Math.max(8, Math.floor(length * 35)));
      const tickPosAttr = this.tickLines.geometry.attributes.position as THREE.BufferAttribute;
      const array = this.tickPositions;

      let ptr = 0;
      for (let i = 0; i < numTicks; i++) {
        const t = (i + 1) / (numTicks + 1);
        const tickCenter = this.scratchTickCenter.lerpVectors(p1, p2, t);

        // Center tick and octave divisions are taller
        const isMajor = i === Math.floor(numTicks / 2) || i % 4 === 0;
        const tickHalfHeight = isMajor ? 0.015 : 0.008;

        const top = this.scratchTop.copy(tickCenter).addScaledVector(normal, tickHalfHeight);
        const btm = this.scratchBtm.copy(tickCenter).addScaledVector(normal, -tickHalfHeight);

        array[ptr++] = top.x;
        array[ptr++] = top.y;
        array[ptr++] = top.z;
        array[ptr++] = btm.x;
        array[ptr++] = btm.y;
        array[ptr++] = btm.z;
      }

      // Zero out unused ticks
      while (ptr < array.length) {
        array[ptr++] = 0;
      }

      tickPosAttr.needsUpdate = true;
      this.tickLines.visible = true;
    } else {
      this.lineMesh.visible = false;
      this.tickLines.visible = false;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
