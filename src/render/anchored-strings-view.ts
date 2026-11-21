import * as THREE from 'three';
import { AnchoredString, EndpointGrabState } from '../types/instruments';
import { StringVibrationState } from '../types/physics';
import { SceneManager } from './scene-manager';

export class AnchoredStringsView {
  private group: THREE.Group;
  private sceneManager: SceneManager;
  private maxStrings: number;
  private maxTicksPerString = 30;

  // Tessellation for wave vibration physics (32 segments = 33 vertices per string)
  private segmentsPerString = 32;
  private verticesPerString = 33;

  // 1. Core Center String Lines
  private coreLines: THREE.Line[] = [];
  private corePositions: Float32Array[] = [];

  // 2. Dual-Wave Envelope Boundary Lines (Upper & Lower)
  private upperEnvelopeLines: THREE.Line[] = [];
  private upperEnvelopePositions: Float32Array[] = [];
  private lowerEnvelopeLines: THREE.Line[] = [];
  private lowerEnvelopePositions: Float32Array[] = [];

  // 3. Resonant Luminous Ribbon Meshes (Triangle strip between upper & lower envelopes)
  private ribbonMeshes: THREE.Mesh[] = [];
  private ribbonPositions: Float32Array[] = [];
  private ribbonMaterials: THREE.MeshBasicMaterial[] = [];

  // 4. Fret Tick Lines
  private tickLines: THREE.LineSegments[] = [];
  private tickPositions: Float32Array[] = [];

  // 5. Precision Sighting Anchor Reticles (⌖) (2 reticles per string * 12 = 24 reticles)
  private anchorReticles: THREE.LineSegments[] = [];
  private anchorReticleMaterials: THREE.LineBasicMaterial[] = [];

  // Active wave vibrations map (stringId -> StringVibrationState)
  private vibrations = new Map<string, StringVibrationState>();

  // Reusable scratch vectors to avoid per-frame allocations (Zero-GC)
  private scratchP1 = new THREE.Vector3();
  private scratchP2 = new THREE.Vector3();
  private scratchDir = new THREE.Vector3();
  private scratchNormal = new THREE.Vector3();
  private scratchCenter = new THREE.Vector3();
  private scratchTop = new THREE.Vector3();
  private scratchBtm = new THREE.Vector3();
  private scratchVert = new THREE.Vector3();
  private scratchUpper = new THREE.Vector3();
  private scratchLower = new THREE.Vector3();

  constructor(sceneManager: SceneManager, maxStrings = 12) {
    this.sceneManager = sceneManager;
    this.maxStrings = maxStrings;
    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    // Pre-calculate shared index buffer for ribbon triangle strips (32 segments * 2 triangles = 64 triangles = 192 indices)
    const ribbonIndices = new Uint16Array(this.segmentsPerString * 6);
    let idxPtr = 0;
    for (let s = 0; s < this.segmentsPerString; s++) {
      const topA = s * 2;
      const btmA = s * 2 + 1;
      const topB = (s + 1) * 2;
      const btmB = (s + 1) * 2 + 1;
      // Triangle 1: topA -> btmA -> topB
      ribbonIndices[idxPtr++] = topA;
      ribbonIndices[idxPtr++] = btmA;
      ribbonIndices[idxPtr++] = topB;
      // Triangle 2: topB -> btmA -> btmB
      ribbonIndices[idxPtr++] = topB;
      ribbonIndices[idxPtr++] = btmA;
      ribbonIndices[idxPtr++] = btmB;
    }

    // Pre-calculate static geometry for Precision Crosshair Reticle (⌖)
    // 16 circle segments (32 vertices) + 4 crosshair ticks (8 vertices) + center cross (4 vertices) = 44 vertices
    const reticlePosArray = this.generateReticleGeometry();

    for (let i = 0; i < this.maxStrings; i++) {
      // 1. Core resting laser line
      const corePos = new Float32Array(this.verticesPerString * 3);
      this.corePositions.push(corePos);
      const coreGeom = new THREE.BufferGeometry();
      coreGeom.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
      const coreMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2.0,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
      });
      const coreLine = new THREE.Line(coreGeom, coreMat);
      coreLine.visible = false;
      this.coreLines.push(coreLine);
      this.group.add(coreLine);

      // 2. Upper & Lower Envelope Lines
      const upperPos = new Float32Array(this.verticesPerString * 3);
      this.upperEnvelopePositions.push(upperPos);
      const upperGeom = new THREE.BufferGeometry();
      upperGeom.setAttribute('position', new THREE.BufferAttribute(upperPos, 3));
      const upperMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      });
      const upperLine = new THREE.Line(upperGeom, upperMat);
      upperLine.visible = false;
      this.upperEnvelopeLines.push(upperLine);
      this.group.add(upperLine);

      const lowerPos = new Float32Array(this.verticesPerString * 3);
      this.lowerEnvelopePositions.push(lowerPos);
      const lowerGeom = new THREE.BufferGeometry();
      lowerGeom.setAttribute('position', new THREE.BufferAttribute(lowerPos, 3));
      const lowerMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      });
      const lowerLine = new THREE.Line(lowerGeom, lowerMat);
      lowerLine.visible = false;
      this.lowerEnvelopeLines.push(lowerLine);
      this.group.add(lowerLine);

      // 3. Resonant Luminous Ribbon Mesh
      const ribbonPos = new Float32Array(this.verticesPerString * 2 * 3);
      this.ribbonPositions.push(ribbonPos);
      const ribbonGeom = new THREE.BufferGeometry();
      ribbonGeom.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3));
      ribbonGeom.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
      const ribbonMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
      ribbonMesh.visible = false;
      this.ribbonMeshes.push(ribbonMesh);
      this.ribbonMaterials.push(ribbonMat);
      this.group.add(ribbonMesh);

      // 4. Fret Ticks
      const tickPos = new Float32Array(this.maxTicksPerString * 2 * 3);
      this.tickPositions.push(tickPos);
      const tickGeom = new THREE.BufferGeometry();
      tickGeom.setAttribute('position', new THREE.BufferAttribute(tickPos, 3));
      const tickMat = new THREE.LineBasicMaterial({
        color: 0xaaffdd,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.75,
        depthTest: false,
      });
      const tickLine = new THREE.LineSegments(tickGeom, tickMat);
      tickLine.visible = false;
      this.tickLines.push(tickLine);
      this.group.add(tickLine);

      // 5. Precision Sighting Anchor Reticles (2 per string: P1 and P2)
      for (let j = 0; j < 2; j++) {
        const reticleGeom = new THREE.BufferGeometry();
        reticleGeom.setAttribute('position', new THREE.BufferAttribute(reticlePosArray, 3));
        const reticleMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          linewidth: 1.5,
          transparent: true,
          opacity: 0.92,
          depthTest: false,
        });
        const reticle = new THREE.LineSegments(reticleGeom, reticleMat);
        reticle.visible = false;
        this.anchorReticles.push(reticle);
        this.anchorReticleMaterials.push(reticleMat);
        this.group.add(reticle);
      }
    }
  }

  /**
   * Generates static vertex positions for the precision crosshair reticle (⌖)
   * Outer circle (16 segments = 32 vertices) + 4 crosshair ticks (8 vertices) + center cross (4 vertices)
   */
  private generateReticleGeometry(): Float32Array {
    const circleSegments = 16;
    const outerRadius = 0.011;
    const tickStart = 0.007;
    const tickEnd = 0.016;

    // Total: 32 + 8 + 4 = 44 vertices -> 44 * 3 = 132 floats
    const pos = new Float32Array((circleSegments * 2 + 8 + 4) * 3);
    let ptr = 0;

    // 1. Outer circle segments
    for (let s = 0; s < circleSegments; s++) {
      const a1 = (s / circleSegments) * Math.PI * 2;
      const a2 = ((s + 1) / circleSegments) * Math.PI * 2;

      pos[ptr++] = Math.cos(a1) * outerRadius;
      pos[ptr++] = Math.sin(a1) * outerRadius;
      pos[ptr++] = 0;

      pos[ptr++] = Math.cos(a2) * outerRadius;
      pos[ptr++] = Math.sin(a2) * outerRadius;
      pos[ptr++] = 0;
    }

    // 2. Crosshair sight ticks (aligned horizontally and vertically)
    // Left tick
    pos[ptr++] = -tickEnd; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = -tickStart; pos[ptr++] = 0; pos[ptr++] = 0;
    // Right tick
    pos[ptr++] = tickStart; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = tickEnd; pos[ptr++] = 0; pos[ptr++] = 0;
    // Bottom tick
    pos[ptr++] = 0; pos[ptr++] = -tickEnd; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -tickStart; pos[ptr++] = 0;
    // Top tick
    pos[ptr++] = 0; pos[ptr++] = tickStart; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = tickEnd; pos[ptr++] = 0;

    // 3. Center sighting cross
    const centerSpan = 0.0035;
    pos[ptr++] = -centerSpan; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = centerSpan; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -centerSpan; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = centerSpan; pos[ptr++] = 0;

    return pos;
  }

  /**
   * Triggers damped harmonic standing wave vibration on a plucked string
   */
  public triggerPluck(stringId: string, velocity: number, contactRatio: number, elapsed: number): void {
    const initialAmplitude = 0.022 * Math.min(1.0, Math.max(0.35, velocity));
    this.vibrations.set(stringId, {
      stringId,
      initialAmplitude,
      amplitude: initialAmplitude,
      frequency: 28.0, // Visual ripple frequency in rad/s
      damping: 3.4,    // Exponential decay factor (~950ms decay)
      startTime: elapsed,
      contactRatio,
      active: true,
    });
  }

  public update(
    strings: AnchoredString[],
    activeGrabs: EndpointGrabState[],
    videoAspect: number,
    elapsed: number
  ): void {
    // Hide all meshes first
    for (let i = 0; i < this.maxStrings; i++) {
      this.coreLines[i].visible = false;
      this.upperEnvelopeLines[i].visible = false;
      this.lowerEnvelopeLines[i].visible = false;
      this.ribbonMeshes[i].visible = false;
      this.tickLines[i].visible = false;
      this.anchorReticles[i * 2].visible = false;
      this.anchorReticles[i * 2 + 1].visible = false;
    }

    strings.forEach((str, idx) => {
      if (idx >= this.maxStrings) return;

      const p1 = this.scratchP1;
      const p2 = this.scratchP2;
      const w1 = this.sceneManager.toWorldCoords(str.point1.x, str.point1.y, str.point1.z, videoAspect);
      const w2 = this.sceneManager.toWorldCoords(str.point2.x, str.point2.y, str.point2.z, videoAspect);
      p1.copy(w1);
      p2.copy(w2);

      // Compute string direction and perpendicular normal
      const dir = this.scratchDir.subVectors(p2, p1);
      const length = dir.length();
      dir.normalize();

      // Perpendicular normal in 2D plane: (-dy, dx, 0)
      const normal = this.scratchNormal.set(-dir.y, dir.x, 0).normalize();

      // Check active harmonic wave vibration state
      const vib = this.vibrations.get(str.id);
      let isVibrating = false;
      let timeSincePluck = 0;
      let envelopeAlpha = 0;

      if (vib && vib.active) {
        timeSincePluck = elapsed - vib.startTime;
        if (timeSincePluck < 1.1) {
          isVibrating = true;
          envelopeAlpha = Math.exp(-vib.damping * timeSincePluck);
        } else {
          vib.active = false;
          this.vibrations.delete(str.id);
        }
      }

      // 1. Update Core Laser Line, Dual-Wave Envelopes & Resonant Ribbon
      const coreMesh = this.coreLines[idx];
      const corePos = this.corePositions[idx];
      const upperMesh = this.upperEnvelopeLines[idx];
      const upperPos = this.upperEnvelopePositions[idx];
      const lowerMesh = this.lowerEnvelopeLines[idx];
      const lowerPos = this.lowerEnvelopePositions[idx];
      const ribbonMesh = this.ribbonMeshes[idx];
      const ribbonPos = this.ribbonPositions[idx];
      const ribbonMat = this.ribbonMaterials[idx];

      let linePtr = 0;
      let ribbonPtr = 0;

      for (let v = 0; v < this.verticesPerString; v++) {
        const u = v / this.segmentsPerString; // 0.0 to 1.0 along string
        const base = this.scratchVert.lerpVectors(p1, p2, u);

        // Core line coordinates
        corePos[linePtr] = base.x;
        corePos[linePtr + 1] = base.y;
        corePos[linePtr + 2] = base.z;

        if (isVibrating && vib) {
          // Standing wave envelope equation:
          // Fundamental wave modulated with acoustic persistence-of-vision envelope
          const oscCos = Math.cos(vib.frequency * timeSincePluck);
          const oscCos2 = Math.cos(2 * vib.frequency * timeSincePluck);
          const fundamental = Math.sin(Math.PI * u) * envelopeAlpha;
          const secondHarmonic = 0.40 * Math.sin(2 * Math.PI * u) * Math.exp(-1.6 * vib.damping * timeSincePluck);

          // Envelope amplitude: combines persistent visual envelope width + oscillating pulse
          const envAmplitude = vib.initialAmplitude * (fundamental * (0.65 + 0.35 * Math.abs(oscCos)) + secondHarmonic * (0.6 + 0.4 * Math.abs(oscCos2)));

          // Upper and Lower wave boundaries forming the resonant spindle/lens
          const upper = this.scratchUpper.copy(base).addScaledVector(normal, envAmplitude);
          const lower = this.scratchLower.copy(base).addScaledVector(normal, -envAmplitude);

          upperPos[linePtr] = upper.x;
          upperPos[linePtr + 1] = upper.y;
          upperPos[linePtr + 2] = upper.z;

          lowerPos[linePtr] = lower.x;
          lowerPos[linePtr + 1] = lower.y;
          lowerPos[linePtr + 2] = lower.z;

          // Ribbon vertices (interleaved pairs: top_0, btm_0, top_1, btm_1...)
          ribbonPos[ribbonPtr++] = upper.x;
          ribbonPos[ribbonPtr++] = upper.y;
          ribbonPos[ribbonPtr++] = upper.z;
          ribbonPos[ribbonPtr++] = lower.x;
          ribbonPos[ribbonPtr++] = lower.y;
          ribbonPos[ribbonPtr++] = lower.z;
        } else {
          upperPos[linePtr] = base.x;
          upperPos[linePtr + 1] = base.y;
          upperPos[linePtr + 2] = base.z;

          lowerPos[linePtr] = base.x;
          lowerPos[linePtr + 1] = base.y;
          lowerPos[linePtr + 2] = base.z;

          ribbonPos[ribbonPtr++] = base.x;
          ribbonPos[ribbonPtr++] = base.y;
          ribbonPos[ribbonPtr++] = base.z;
          ribbonPos[ribbonPtr++] = base.x;
          ribbonPos[ribbonPtr++] = base.y;
          ribbonPos[ribbonPtr++] = base.z;
        }

        linePtr += 3;
      }

      // Update core line
      (coreMesh.material as THREE.LineBasicMaterial).color.setHex(str.color);
      (coreMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      coreMesh.visible = true;

      // Update dual-wave envelope lines & resonant ribbon mesh
      if (isVibrating && vib) {
        (upperMesh.material as THREE.LineBasicMaterial).color.setHex(str.color);
        (upperMesh.material as THREE.LineBasicMaterial).opacity = 0.85 * envelopeAlpha;
        (upperMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        upperMesh.visible = true;

        (lowerMesh.material as THREE.LineBasicMaterial).color.setHex(str.color);
        (lowerMesh.material as THREE.LineBasicMaterial).opacity = 0.85 * envelopeAlpha;
        (lowerMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        lowerMesh.visible = true;

        ribbonMat.color.setHex(str.color);
        ribbonMat.opacity = 0.40 * envelopeAlpha;
        (ribbonMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        ribbonMesh.visible = true;
      }

      // Check if endpoints are currently grabbed
      const isP1Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p1');
      const isP2Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p2');

      // 2. Update Precision Sighting Anchor Reticles (⌖)
      const reticle1 = this.anchorReticles[idx * 2];
      const reticle2 = this.anchorReticles[idx * 2 + 1];
      const mat1 = this.anchorReticleMaterials[idx * 2];
      const mat2 = this.anchorReticleMaterials[idx * 2 + 1];

      reticle1.position.copy(p1);
      reticle2.position.copy(p2);

      // Rotate reticle to align primary crosshair ticks with string direction
      const stringAngle = Math.atan2(dir.y, dir.x);
      reticle1.rotation.z = stringAngle;
      reticle2.rotation.z = stringAngle;

      if (isP1Grabbed) {
        mat1.color.setHex(0xffffff);
        mat1.opacity = 1.0;
        const grabScale = 1.8 + 0.2 * Math.sin(elapsed * 8.0);
        reticle1.scale.setScalar(grabScale);
      } else {
        mat1.color.setHex(str.color);
        mat1.opacity = 0.92;
        const idleScale = 1.0 + 0.08 * Math.sin(elapsed * 3.0 + idx);
        reticle1.scale.setScalar(idleScale);
      }

      if (isP2Grabbed) {
        mat2.color.setHex(0xffffff);
        mat2.opacity = 1.0;
        const grabScale = 1.8 + 0.2 * Math.sin(elapsed * 8.0);
        reticle2.scale.setScalar(grabScale);
      } else {
        mat2.color.setHex(str.color);
        mat2.opacity = 0.92;
        const idleScale = 1.0 + 0.08 * Math.sin(elapsed * 3.0 + idx);
        reticle2.scale.setScalar(idleScale);
      }

      reticle1.visible = true;
      reticle2.visible = true;

      // 3. Update graduated fret tick marks (dynamically spanning across the vibrating envelope)
      const numTicks = Math.min(this.maxTicksPerString, Math.max(8, Math.floor(length * 35)));
      const tickLine = this.tickLines[idx];
      const tickPos = this.tickPositions[idx];
      let ptr = 0;

      for (let t = 0; t < numTicks; t++) {
        const factor = (t + 1) / (numTicks + 1);
        const center = this.scratchCenter.lerpVectors(p1, p2, factor);

        const isMajor = t === Math.floor(numTicks / 2) || t % 4 === 0;
        let tickHeight = isMajor ? 0.014 : 0.007;

        if (isVibrating && vib) {
          const fundamental = Math.sin(Math.PI * factor) * envelopeAlpha;
          const waveDisp = vib.initialAmplitude * fundamental;
          tickHeight += waveDisp * 0.5; // Tick marks stretch with envelope
        }

        const top = this.scratchTop.copy(center).addScaledVector(normal, tickHeight);
        const btm = this.scratchBtm.copy(center).addScaledVector(normal, -tickHeight);

        tickPos[ptr++] = top.x;
        tickPos[ptr++] = top.y;
        tickPos[ptr++] = top.z;
        tickPos[ptr++] = btm.x;
        tickPos[ptr++] = btm.y;
        tickPos[ptr++] = btm.z;
      }

      while (ptr < tickPos.length) {
        tickPos[ptr++] = 0;
      }

      (tickLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      tickLine.visible = true;
    });
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
