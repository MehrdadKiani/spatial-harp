import * as THREE from 'three';
import { AnchoredString, EndpointGrabState } from '../types/instruments';
import { StringVibrationState } from '../types/physics';
import { SceneManager } from './scene-manager';

export class AnchoredStringsView {
  private group: THREE.Group;
  private sceneManager: SceneManager;
  private maxStrings: number;
  private maxTicksPerString = 30;

  // High-resolution tessellation for fluid traveling wave packets & harmonics (64 segments = 65 vertices)
  private segmentsPerString = 64;
  private verticesPerString = 65;

  // 1. White-Hot Incandescent Laser Core Line & Thick Core Beam Ribbon
  private coreLines: THREE.Line[] = [];
  private corePositions: Float32Array[] = [];
  private coreColors: Float32Array[] = [];

  private coreBeamMeshes: THREE.Mesh[] = [];
  private coreBeamPositions: Float32Array[] = [];
  private coreBeamColors: Float32Array[] = [];
  private coreBeamMaterials: THREE.MeshBasicMaterial[] = [];

  // 2. Intense Neon Inner Glow Beam Ribbon (surrounding the white-hot core)
  private innerGlowMeshes: THREE.Mesh[] = [];
  private innerGlowPositions: Float32Array[] = [];
  private innerGlowColors: Float32Array[] = [];
  private innerGlowMaterials: THREE.MeshBasicMaterial[] = [];

  // 3. Wide Outer Laser Bloom Halo & Resonant Wave Envelope Ribbon
  private ribbonMeshes: THREE.Mesh[] = [];
  private ribbonPositions: Float32Array[] = [];
  private ribbonColors: Float32Array[] = [];
  private ribbonMaterials: THREE.MeshBasicMaterial[] = [];

  // 4. Motion-Blur Ghost Trail Lines (phase-lagged oscillating luminous trails)
  private trailLines: THREE.Line[] = [];
  private trailPositions: Float32Array[] = [];
  private trailColors: Float32Array[] = [];

  // 5. Dual-Wave Envelope Boundary Lines (Upper & Lower luminous edges)
  private upperEnvelopeLines: THREE.Line[] = [];
  private upperEnvelopePositions: Float32Array[] = [];
  private lowerEnvelopeLines: THREE.Line[] = [];
  private lowerEnvelopePositions: Float32Array[] = [];

  // 6. Subtle, High-Transparency Ruler / Fret Tick Lines
  private tickLines: THREE.LineSegments[] = [];
  private tickPositions: Float32Array[] = [];

  // 7. Precision Sighting Anchor Reticles (⌖) (2 reticles per string * 12 = 24 reticles)
  private anchorReticles: THREE.LineSegments[] = [];
  private anchorReticleMaterials: THREE.LineBasicMaterial[] = [];

  // Active wave vibrations map (stringId -> StringVibrationState)
  private vibrations = new Map<string, StringVibrationState>();

  // Reusable scratch vectors & colors to avoid per-frame allocations (Zero-GC)
  private scratchP1 = new THREE.Vector3();
  private scratchP2 = new THREE.Vector3();
  private scratchDir = new THREE.Vector3();
  private scratchNormal = new THREE.Vector3();
  private scratchCenter = new THREE.Vector3();
  private scratchTop = new THREE.Vector3();
  private scratchBtm = new THREE.Vector3();
  private scratchVert = new THREE.Vector3();
  private scratchOsc = new THREE.Vector3();
  private scratchTrail = new THREE.Vector3();
  private scratchUpper = new THREE.Vector3();
  private scratchLower = new THREE.Vector3();
  private baseColor = new THREE.Color();

  constructor(sceneManager: SceneManager, maxStrings = 12) {
    this.sceneManager = sceneManager;
    this.maxStrings = maxStrings;
    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    // Pre-calculate shared index buffer for ribbon triangle strips (64 segments * 2 triangles = 128 triangles = 384 indices)
    const ribbonIndices = new Uint16Array(this.segmentsPerString * 6);
    let idxPtr = 0;
    for (let s = 0; s < this.segmentsPerString; s++) {
      const topA = s * 2;
      const btmA = s * 2 + 1;
      const topB = (s + 1) * 2;
      const btmB = (s + 1) * 2 + 1;
      ribbonIndices[idxPtr++] = topA;
      ribbonIndices[idxPtr++] = btmA;
      ribbonIndices[idxPtr++] = topB;
      ribbonIndices[idxPtr++] = topB;
      ribbonIndices[idxPtr++] = btmA;
      ribbonIndices[idxPtr++] = btmB;
    }

    const reticlePosArray = this.generateReticleGeometry();

    for (let i = 0; i < this.maxStrings; i++) {
      // 1. Wide Outer Laser Bloom Halo & Wave Envelope Ribbon (rendered behind inner core)
      const ribbonPos = new Float32Array(this.verticesPerString * 2 * 3);
      const ribbonCol = new Float32Array(this.verticesPerString * 2 * 3);
      this.ribbonPositions.push(ribbonPos);
      this.ribbonColors.push(ribbonCol);
      const ribbonGeom = new THREE.BufferGeometry();
      ribbonGeom.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3));
      ribbonGeom.setAttribute('color', new THREE.BufferAttribute(ribbonCol, 3));
      ribbonGeom.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
      const ribbonMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.30,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
      ribbonMesh.visible = false;
      this.ribbonMeshes.push(ribbonMesh);
      this.ribbonMaterials.push(ribbonMat);
      this.group.add(ribbonMesh);

      // 2. Intense Neon Inner Glow Beam Ribbon (saturated neon laser body)
      const innerPos = new Float32Array(this.verticesPerString * 2 * 3);
      const innerCol = new Float32Array(this.verticesPerString * 2 * 3);
      this.innerGlowPositions.push(innerPos);
      this.innerGlowColors.push(innerCol);
      const innerGeom = new THREE.BufferGeometry();
      innerGeom.setAttribute('position', new THREE.BufferAttribute(innerPos, 3));
      innerGeom.setAttribute('color', new THREE.BufferAttribute(innerCol, 3));
      innerGeom.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
      const innerMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const innerMesh = new THREE.Mesh(innerGeom, innerMat);
      innerMesh.visible = false;
      this.innerGlowMeshes.push(innerMesh);
      this.innerGlowMaterials.push(innerMat);
      this.group.add(innerMesh);

      // 3. Saturated Neon Laser Core Beam Ribbon (true neon color, no white washout)
      const coreBeamPos = new Float32Array(this.verticesPerString * 2 * 3);
      const coreBeamCol = new Float32Array(this.verticesPerString * 2 * 3);
      this.coreBeamPositions.push(coreBeamPos);
      this.coreBeamColors.push(coreBeamCol);
      const coreBeamGeom = new THREE.BufferGeometry();
      coreBeamGeom.setAttribute('position', new THREE.BufferAttribute(coreBeamPos, 3));
      coreBeamGeom.setAttribute('color', new THREE.BufferAttribute(coreBeamCol, 3));
      coreBeamGeom.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
      const coreBeamMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const coreBeamMesh = new THREE.Mesh(coreBeamGeom, coreBeamMat);
      coreBeamMesh.visible = false;
      this.coreBeamMeshes.push(coreBeamMesh);
      this.coreBeamMaterials.push(coreBeamMat);
      this.group.add(coreBeamMesh);

      // 4. Razor-Sharp Center Filament Line (pure neon color)
      const corePos = new Float32Array(this.verticesPerString * 3);
      const coreCol = new Float32Array(this.verticesPerString * 3);
      this.corePositions.push(corePos);
      this.coreColors.push(coreCol);
      const coreGeom = new THREE.BufferGeometry();
      coreGeom.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
      coreGeom.setAttribute('color', new THREE.BufferAttribute(coreCol, 3));
      const coreMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 2.5,
        transparent: true,
        opacity: 1.0,
        depthTest: false,
      });
      const coreLine = new THREE.Line(coreGeom, coreMat);
      coreLine.visible = false;
      this.coreLines.push(coreLine);
      this.group.add(coreLine);

      // 5. Motion-Blur Ghost Trail Line
      const trailPos = new Float32Array(this.verticesPerString * 3);
      const trailCol = new Float32Array(this.verticesPerString * 3);
      this.trailPositions.push(trailPos);
      this.trailColors.push(trailCol);
      const trailGeom = new THREE.BufferGeometry();
      trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      trailGeom.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
      const trailMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const trailLine = new THREE.Line(trailGeom, trailMat);
      trailLine.visible = false;
      this.trailLines.push(trailLine);
      this.group.add(trailLine);

      // 6. Upper & Lower Luminous Envelope Edge Lines
      const upperPos = new Float32Array(this.verticesPerString * 3);
      this.upperEnvelopePositions.push(upperPos);
      const upperGeom = new THREE.BufferGeometry();
      upperGeom.setAttribute('position', new THREE.BufferAttribute(upperPos, 3));
      const upperMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
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
        color: 0xff007f,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const lowerLine = new THREE.Line(lowerGeom, lowerMat);
      lowerLine.visible = false;
      this.lowerEnvelopeLines.push(lowerLine);
      this.group.add(lowerLine);

      // 7. Subtle, Very Transparent Fret / Ruler Ticks
      const tickPos = new Float32Array(this.maxTicksPerString * 2 * 3);
      this.tickPositions.push(tickPos);
      const tickGeom = new THREE.BufferGeometry();
      tickGeom.setAttribute('position', new THREE.BufferAttribute(tickPos, 3));
      const tickMat = new THREE.LineBasicMaterial({
        color: 0xaaffdd,
        linewidth: 1.0,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const tickLine = new THREE.LineSegments(tickGeom, tickMat);
      tickLine.visible = false;
      this.tickLines.push(tickLine);
      this.group.add(tickLine);

      // 8. Precision Sighting Anchor Reticles (2 per string: P1 and P2)
      for (let j = 0; j < 2; j++) {
        const reticleGeom = new THREE.BufferGeometry();
        reticleGeom.setAttribute('position', new THREE.BufferAttribute(reticlePosArray, 3));
        const reticleMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          linewidth: 1.5,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
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
   */
  private generateReticleGeometry(): Float32Array {
    const circleSegments = 16;
    const outerRadius = 0.011;
    const tickStart = 0.007;
    const tickEnd = 0.016;

    const pos = new Float32Array((circleSegments * 2 + 8 + 4) * 3);
    let ptr = 0;

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

    // Left, Right, Bottom, Top sight ticks
    pos[ptr++] = -tickEnd; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = -tickStart; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = tickStart; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = tickEnd; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -tickEnd; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -tickStart; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = tickStart; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = tickEnd; pos[ptr++] = 0;

    // Center cross
    const centerSpan = 0.0035;
    pos[ptr++] = -centerSpan; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = centerSpan; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -centerSpan; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = centerSpan; pos[ptr++] = 0;

    return pos;
  }

  /**
   * Triggers bi-directional traveling energy wave and multi-harmonic string oscillation (~1.75s decay)
   */
  public triggerPluck(stringId: string, velocity: number, contactRatio: number, elapsed: number): void {
    const clampedVel = Math.min(1.0, Math.max(0.35, velocity));
    const initialAmplitude = 0.028 * clampedVel;
    this.vibrations.set(stringId, {
      stringId,
      initialAmplitude,
      amplitude: initialAmplitude,
      frequency: 36.0,    // Rapid realistic oscillation frequency (rad/s)
      waveSpeed: 1.55,    // Bi-directional traveling wave packet speed (normalized length/s)
      damping: 2.25,      // Smooth ~1.75s exponential dissipation back to idle state
      startTime: elapsed,
      contactRatio,
      velocity: clampedVel,
      active: true,
    });
  }

  public update(
    strings: AnchoredString[],
    activeGrabs: EndpointGrabState[],
    videoAspect: number,
    elapsed: number
  ): void {
    for (let i = 0; i < this.maxStrings; i++) {
      this.coreLines[i].visible = false;
      this.coreBeamMeshes[i].visible = false;
      this.innerGlowMeshes[i].visible = false;
      this.ribbonMeshes[i].visible = false;
      this.trailLines[i].visible = false;
      this.upperEnvelopeLines[i].visible = false;
      this.lowerEnvelopeLines[i].visible = false;
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

      const dir = this.scratchDir.subVectors(p2, p1);
      const length = dir.length();
      dir.normalize();

      const normal = this.scratchNormal.set(-dir.y, dir.x, 0).normalize();
      this.baseColor.setHex(str.color);

      // Check active harmonic & traveling wave vibration state (~1.75s duration)
      const vib = this.vibrations.get(str.id);
      let isVibrating = false;
      let timeSincePluck = 0;
      let envelopeAlpha = 0;

      if (vib && vib.active) {
        timeSincePluck = elapsed - vib.startTime;
        if (timeSincePluck < 1.80) {
          isVibrating = true;
          envelopeAlpha = Math.exp(-vib.damping * timeSincePluck);
        } else {
          vib.active = false;
          this.vibrations.delete(str.id);
        }
      }

      const coreMesh = this.coreLines[idx];
      const corePos = this.corePositions[idx];
      const coreCol = this.coreColors[idx];

      const coreBeamMesh = this.coreBeamMeshes[idx];
      const coreBeamPos = this.coreBeamPositions[idx];
      const coreBeamCol = this.coreBeamColors[idx];
      const coreBeamMat = this.coreBeamMaterials[idx];

      const innerGlowMesh = this.innerGlowMeshes[idx];
      const innerGlowPos = this.innerGlowPositions[idx];
      const innerGlowCol = this.innerGlowColors[idx];
      const innerGlowMat = this.innerGlowMaterials[idx];

      const ribbonMesh = this.ribbonMeshes[idx];
      const ribbonPos = this.ribbonPositions[idx];
      const ribbonCol = this.ribbonColors[idx];
      const ribbonMat = this.ribbonMaterials[idx];

      const trailMesh = this.trailLines[idx];
      const trailPos = this.trailPositions[idx];
      const trailCol = this.trailColors[idx];

      const upperMesh = this.upperEnvelopeLines[idx];
      const upperPos = this.upperEnvelopePositions[idx];
      const lowerMesh = this.lowerEnvelopeLines[idx];
      const lowerPos = this.lowerEnvelopePositions[idx];

      let linePtr = 0;
      let ribbonPtr = 0;

      // Multi-layer laser beam widths (world units): sleek, razor-sharp focused laser beam
      const pulse = 1.0 + 0.10 * Math.sin(elapsed * 4.5 + idx * 1.3);
      const coreBeamHalfWidth = 0.00075 * pulse;
      const innerGlowHalfWidth = 0.0020 * pulse;
      const outerHaloHalfWidth = 0.0042 * pulse;

      for (let v = 0; v < this.verticesPerString; v++) {
        const u = v / this.segmentsPerString; // 0.0 to 1.0 along string
        const base = this.scratchVert.lerpVectors(p1, p2, u);
        const boundaryPin = Math.sin(Math.PI * u);

        if (isVibrating && vib) {
          const u0 = vib.contactRatio;

          // 1. Bi-Directional Propagating Energy Wave Packets (left-traveling & right-traveling with boundary reflection)
          const travelDist = vib.waveSpeed * timeSincePluck;
          const waveDecay = Math.exp(-1.9 * timeSincePluck);

          const dLeft = u - (u0 - travelDist);
          const dRight = u - (u0 + travelDist);
          const dReflectLeft = u - (-(u0 - travelDist));
          const dReflectRight = u - (2.0 - (u0 + travelDist));

          const sigma = 0.075;
          const invSigmaSq = 1.0 / (2.0 * sigma * sigma);
          const pulseLeft = Math.exp(-dLeft * dLeft * invSigmaSq);
          const pulseRight = Math.exp(-dRight * dRight * invSigmaSq);
          const pulseRefL = 0.65 * Math.exp(-dReflectLeft * dReflectLeft * invSigmaSq);
          const pulseRefR = 0.65 * Math.exp(-dReflectRight * dReflectRight * invSigmaSq);

          const waveEnergy = Math.min(1.4, (pulseLeft + pulseRight + pulseRefL + pulseRefR) * waveDecay);

          const distFromContact = u - u0;
          const contactFlash =
            timeSincePluck < 0.16
              ? Math.exp(-distFromContact * distFromContact * 140.0) * (1.0 - timeSincePluck / 0.16)
              : 0;

          // 2. Multi-Harmonic Standing Guitar String Oscillation
          const w1Weight = Math.max(0.35, Math.sin(Math.PI * u0));
          const w2Weight = 0.45 * Math.sin(2.0 * Math.PI * u0);
          const w3Weight = 0.25 * Math.sin(3.0 * Math.PI * u0);

          const phase1 = vib.frequency * timeSincePluck;
          const phase2 = 2.05 * vib.frequency * timeSincePluck;
          const phase3 = 3.12 * vib.frequency * timeSincePluck;

          const mode1 = w1Weight * Math.sin(Math.PI * u) * envelopeAlpha;
          const mode2 = w2Weight * Math.sin(2.0 * Math.PI * u) * Math.exp(-1.45 * vib.damping * timeSincePluck);
          const mode3 = w3Weight * Math.sin(3.0 * Math.PI * u) * Math.exp(-2.1 * vib.damping * timeSincePluck);

          const travelingWaveOsc =
            0.55 * waveEnergy * Math.sin(14.0 * Math.PI * (u - u0) - 24.0 * timeSincePluck) * boundaryPin;

          const instDisp =
            vib.initialAmplitude *
            (mode1 * Math.cos(phase1) +
              mode2 * Math.cos(phase2) +
              mode3 * Math.cos(phase3) +
              travelingWaveOsc);

          const trailDisp =
            vib.initialAmplitude *
            0.82 *
            (mode1 * Math.cos(phase1 - 0.65) +
              mode2 * Math.cos(phase2 - 0.85) +
              travelingWaveOsc * 0.75);

          const envWidth =
            outerHaloHalfWidth +
            vib.initialAmplitude *
              (Math.abs(mode1) * (0.68 + 0.32 * Math.abs(Math.cos(phase1))) +
                Math.abs(mode2) * 0.75 +
                0.65 * waveEnergy * boundaryPin);

          const oscPt = this.scratchOsc.copy(base).addScaledVector(normal, instDisp);
          const trailPt = this.scratchTrail.copy(base).addScaledVector(normal, trailDisp);

          corePos[linePtr] = oscPt.x;
          corePos[linePtr + 1] = oscPt.y;
          corePos[linePtr + 2] = oscPt.z;

          trailPos[linePtr] = trailPt.x;
          trailPos[linePtr + 1] = trailPt.y;
          trailPos[linePtr + 2] = trailPt.z;

          // 3. Dynamic Chromatic Gradient (Cyan -> Electric Blue -> Magenta -> Purple, zero white washout)
          const chromaPhase = u * 3.5 - timeSincePluck * 5.5;
          const cyanFactor = 0.5 + 0.5 * Math.cos(chromaPhase);
          const magentaFactor = 0.5 + 0.5 * Math.sin(chromaPhase);
          const energyBoost = Math.min(1.0, waveEnergy * 0.85 + contactFlash * 0.5);

          const r = Math.min(
            1.0,
            this.baseColor.r * (1.0 - energyBoost * 0.45) +
              (0.95 * magentaFactor + 0.20 * (1.0 - cyanFactor)) * energyBoost
          );
          const g = Math.min(
            1.0,
            this.baseColor.g * (1.0 - energyBoost * 0.45) +
              (0.95 * cyanFactor + 0.10 * magentaFactor) * energyBoost
          );
          const b = Math.min(
            1.0,
            this.baseColor.b * (1.0 - energyBoost * 0.35) + 0.90 * energyBoost
          );

          // Pure saturated neon core filament color (no white blending)
          const coreR = r;
          const coreG = g;
          const coreB = b;

          coreCol[linePtr] = coreR;
          coreCol[linePtr + 1] = coreG;
          coreCol[linePtr + 2] = coreB;

          trailCol[linePtr] = Math.min(1.0, r * 0.85 + 0.25) * envelopeAlpha;
          trailCol[linePtr + 1] = g * 0.55 * envelopeAlpha;
          trailCol[linePtr + 2] = Math.min(1.0, b * 0.95) * envelopeAlpha;

          // Layer A: Thick White-Hot Laser Core Ribbon (follows oscillating string oscPt)
          const activeCoreW = coreBeamHalfWidth * (1.0 + 0.55 * energyBoost);
          const coreTop = this.scratchUpper.copy(oscPt).addScaledVector(normal, activeCoreW);
          const coreBtm = this.scratchLower.copy(oscPt).addScaledVector(normal, -activeCoreW);

          coreBeamPos[ribbonPtr] = coreTop.x;
          coreBeamPos[ribbonPtr + 1] = coreTop.y;
          coreBeamPos[ribbonPtr + 2] = coreTop.z;
          coreBeamCol[ribbonPtr] = coreR;
          coreBeamCol[ribbonPtr + 1] = coreG;
          coreBeamCol[ribbonPtr + 2] = coreB;

          coreBeamPos[ribbonPtr + 3] = coreBtm.x;
          coreBeamPos[ribbonPtr + 4] = coreBtm.y;
          coreBeamPos[ribbonPtr + 5] = coreBtm.z;
          coreBeamCol[ribbonPtr + 3] = coreR;
          coreBeamCol[ribbonPtr + 4] = coreG;
          coreBeamCol[ribbonPtr + 5] = coreB;

          // Layer B: Intense Neon Inner Glow Beam (follows oscillating string oscPt)
          const activeInnerW = innerGlowHalfWidth * (1.0 + 0.85 * energyBoost);
          const innerTop = this.scratchUpper.copy(oscPt).addScaledVector(normal, activeInnerW);
          const innerBtm = this.scratchLower.copy(oscPt).addScaledVector(normal, -activeInnerW);

          innerGlowPos[ribbonPtr] = innerTop.x;
          innerGlowPos[ribbonPtr + 1] = innerTop.y;
          innerGlowPos[ribbonPtr + 2] = innerTop.z;
          innerGlowCol[ribbonPtr] = r;
          innerGlowCol[ribbonPtr + 1] = g;
          innerGlowCol[ribbonPtr + 2] = b;

          innerGlowPos[ribbonPtr + 3] = innerBtm.x;
          innerGlowPos[ribbonPtr + 4] = innerBtm.y;
          innerGlowPos[ribbonPtr + 5] = innerBtm.z;
          innerGlowCol[ribbonPtr + 3] = r;
          innerGlowCol[ribbonPtr + 4] = g;
          innerGlowCol[ribbonPtr + 5] = b;

          // Layer C: Wide Outer Bloom Halo & Resonant Wave Envelope Sheath
          const upper = this.scratchUpper.copy(base).addScaledVector(normal, envWidth);
          const lower = this.scratchLower.copy(base).addScaledVector(normal, -envWidth);

          upperPos[linePtr] = upper.x;
          upperPos[linePtr + 1] = upper.y;
          upperPos[linePtr + 2] = upper.z;

          lowerPos[linePtr] = lower.x;
          lowerPos[linePtr + 1] = lower.y;
          lowerPos[linePtr + 2] = lower.z;

          ribbonPos[ribbonPtr] = upper.x;
          ribbonPos[ribbonPtr + 1] = upper.y;
          ribbonPos[ribbonPtr + 2] = upper.z;
          ribbonCol[ribbonPtr] = r;
          ribbonCol[ribbonPtr + 1] = g;
          ribbonCol[ribbonPtr + 2] = b;

          ribbonPos[ribbonPtr + 3] = lower.x;
          ribbonPos[ribbonPtr + 4] = lower.y;
          ribbonPos[ribbonPtr + 5] = lower.z;
          ribbonCol[ribbonPtr + 3] = Math.min(1.0, r * 0.7 + 0.3);
          ribbonCol[ribbonPtr + 4] = g * 0.6;
          ribbonCol[ribbonPtr + 5] = b;

          ribbonPtr += 6;
        } else {
          // Idle State: Intense, Glowing Multi-Layer Laser Beam
          corePos[linePtr] = base.x;
          corePos[linePtr + 1] = base.y;
          corePos[linePtr + 2] = base.z;

          const idleShimmer = 0.92 + 0.08 * Math.sin(u * Math.PI * 4.0 + elapsed * 3.5 + idx);
          // Pure saturated neon string color (no white core tint)
          const coreR = this.baseColor.r * idleShimmer;
          const coreG = this.baseColor.g * idleShimmer;
          const coreB = this.baseColor.b * idleShimmer;

          coreCol[linePtr] = coreR;
          coreCol[linePtr + 1] = coreG;
          coreCol[linePtr + 2] = coreB;

          // Layer A: Thick White-Hot Core Beam Ribbon
          const coreTop = this.scratchUpper.copy(base).addScaledVector(normal, coreBeamHalfWidth);
          const coreBtm = this.scratchLower.copy(base).addScaledVector(normal, -coreBeamHalfWidth);

          coreBeamPos[ribbonPtr] = coreTop.x;
          coreBeamPos[ribbonPtr + 1] = coreTop.y;
          coreBeamPos[ribbonPtr + 2] = coreTop.z;
          coreBeamCol[ribbonPtr] = coreR;
          coreBeamCol[ribbonPtr + 1] = coreG;
          coreBeamCol[ribbonPtr + 2] = coreB;

          coreBeamPos[ribbonPtr + 3] = coreBtm.x;
          coreBeamPos[ribbonPtr + 4] = coreBtm.y;
          coreBeamPos[ribbonPtr + 5] = coreBtm.z;
          coreBeamCol[ribbonPtr + 3] = coreR;
          coreBeamCol[ribbonPtr + 4] = coreG;
          coreBeamCol[ribbonPtr + 5] = coreB;

          // Layer B: Saturated Neon Inner Glow Beam Ribbon
          const innerR = Math.min(1.0, this.baseColor.r * 1.15);
          const innerG = Math.min(1.0, this.baseColor.g * 1.15);
          const innerB = Math.min(1.0, this.baseColor.b * 1.15);

          const innerTop = this.scratchUpper.copy(base).addScaledVector(normal, innerGlowHalfWidth);
          const innerBtm = this.scratchLower.copy(base).addScaledVector(normal, -innerGlowHalfWidth);

          innerGlowPos[ribbonPtr] = innerTop.x;
          innerGlowPos[ribbonPtr + 1] = innerTop.y;
          innerGlowPos[ribbonPtr + 2] = innerTop.z;
          innerGlowCol[ribbonPtr] = innerR;
          innerGlowCol[ribbonPtr + 1] = innerG;
          innerGlowCol[ribbonPtr + 2] = innerB;

          innerGlowPos[ribbonPtr + 3] = innerBtm.x;
          innerGlowPos[ribbonPtr + 4] = innerBtm.y;
          innerGlowPos[ribbonPtr + 5] = innerBtm.z;
          innerGlowCol[ribbonPtr + 3] = innerR;
          innerGlowCol[ribbonPtr + 4] = innerG;
          innerGlowCol[ribbonPtr + 5] = innerB;

          // Layer C: Wide Soft Outer Neon Bloom Halo
          const upperIdle = this.scratchUpper.copy(base).addScaledVector(normal, outerHaloHalfWidth);
          const lowerIdle = this.scratchLower.copy(base).addScaledVector(normal, -outerHaloHalfWidth);

          ribbonPos[ribbonPtr] = upperIdle.x;
          ribbonPos[ribbonPtr + 1] = upperIdle.y;
          ribbonPos[ribbonPtr + 2] = upperIdle.z;
          ribbonCol[ribbonPtr] = this.baseColor.r;
          ribbonCol[ribbonPtr + 1] = this.baseColor.g;
          ribbonCol[ribbonPtr + 2] = this.baseColor.b;

          ribbonPos[ribbonPtr + 3] = lowerIdle.x;
          ribbonPos[ribbonPtr + 4] = lowerIdle.y;
          ribbonPos[ribbonPtr + 5] = lowerIdle.z;
          ribbonCol[ribbonPtr + 3] = this.baseColor.r;
          ribbonCol[ribbonPtr + 4] = this.baseColor.g;
          ribbonCol[ribbonPtr + 5] = this.baseColor.b;

          ribbonPtr += 6;
        }

        linePtr += 3;
      }

      // Commit White-Hot Filament & Core Beam Ribbon
      (coreMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (coreMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      coreMesh.visible = true;

      coreBeamMat.opacity = isVibrating ? 0.98 : 0.92;
      (coreBeamMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (coreBeamMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      coreBeamMesh.visible = true;

      // Commit Intense Neon Inner Glow Beam Ribbon
      innerGlowMat.opacity = isVibrating ? 0.78 : 0.62;
      (innerGlowMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (innerGlowMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      innerGlowMesh.visible = true;

      // Commit Wide Outer Neon Bloom Halo Ribbon
      ribbonMat.opacity = isVibrating ? 0.26 + 0.32 * envelopeAlpha : 0.25;
      (ribbonMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (ribbonMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      ribbonMesh.visible = true;

      // Commit Motion-Blur Trail & Envelope Boundary Lines during vibration
      if (isVibrating && vib) {
        (trailMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (trailMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        trailMesh.visible = true;

        (upperMesh.material as THREE.LineBasicMaterial).color.setHex(str.color);
        (upperMesh.material as THREE.LineBasicMaterial).opacity = 0.75 * envelopeAlpha;
        (upperMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        upperMesh.visible = true;

        (lowerMesh.material as THREE.LineBasicMaterial).color.setHex(0xd946ef);
        (lowerMesh.material as THREE.LineBasicMaterial).opacity = 0.68 * envelopeAlpha;
        (lowerMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        lowerMesh.visible = true;
      }

      // Check if endpoints are currently grabbed
      const isP1Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p1');
      const isP2Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p2');

      // Update Precision Sighting Anchor Reticles (⌖)
      const reticle1 = this.anchorReticles[idx * 2];
      const reticle2 = this.anchorReticles[idx * 2 + 1];
      const mat1 = this.anchorReticleMaterials[idx * 2];
      const mat2 = this.anchorReticleMaterials[idx * 2 + 1];

      reticle1.position.copy(p1);
      reticle2.position.copy(p2);

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

      // Update subtle, transparent fret tick marks
      const numTicks = Math.min(this.maxTicksPerString, Math.max(8, Math.floor(length * 35)));
      const tickLine = this.tickLines[idx];
      const tickPos = this.tickPositions[idx];
      let ptr = 0;

      for (let t = 0; t < numTicks; t++) {
        const factor = (t + 1) / (numTicks + 1);
        const center = this.scratchCenter.lerpVectors(p1, p2, factor);

        const isMajor = t === Math.floor(numTicks / 2) || t % 4 === 0;
        let tickHeight = isMajor ? 0.011 : 0.0055;

        if (isVibrating && vib) {
          const fundamental = Math.sin(Math.PI * factor) * envelopeAlpha;
          const waveDisp = vib.initialAmplitude * fundamental;
          tickHeight += waveDisp * 0.45;
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
