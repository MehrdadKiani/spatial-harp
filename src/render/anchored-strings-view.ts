import * as THREE from 'three';
import { AnchoredString, EndpointGrabState } from '../types/instruments';
import { StringVibrationState } from '../types/physics';
import { SceneManager } from './scene-manager';
import { VisualsConfigGroup } from '../core/config';

export class AnchoredStringsView {
  private group: THREE.Group;
  private sceneManager: SceneManager;
  private maxStrings: number;
  private maxTicksPerString = 30;

  // High-resolution 96-segment tessellation for silky-smooth multi-crest sinusoidal waves (97 vertices)
  private segmentsPerString = 96;
  private verticesPerString = 97;

  // Configurable visual & wave physics parameters (from public/config.json)
  private waveCoreHalfWidth = 0.0014;
  private waveGlowHalfWidth = 0.0038;
  private rulerTickOpacity = 0.14;
  private majorTickHeight = 0.010;
  private minorTickHeight = 0.005;
  private waveAmplitude = 0.042;
  private waveFrequency = 26.0;
  private waveSpeed = 1.65;
  private waveDamping = 2.05;
  private waveDurationSec = 1.75;

  // 1. Oscillating Main Laser Beam Lines & Ribbons (Core Line + Core Ribbon + Soft Neon Glow Ribbon)
  private waveLines: THREE.Line[] = [];
  private wavePositions: Float32Array[] = [];
  private waveColors: Float32Array[] = [];

  private waveCoreMeshes: THREE.Mesh[] = [];
  private waveCorePositions: Float32Array[] = [];
  private waveCoreColors: Float32Array[] = [];
  private waveCoreMaterials: THREE.MeshBasicMaterial[] = [];

  private waveGlowMeshes: THREE.Mesh[] = [];
  private waveGlowPositions: Float32Array[] = [];
  private waveGlowColors: Float32Array[] = [];
  private waveGlowMaterials: THREE.MeshBasicMaterial[] = [];

  // 2. Phase-Lagged Motion-Blur Ghost Trail Line
  private trailLines: THREE.Line[] = [];
  private trailPositions: Float32Array[] = [];
  private trailColors: Float32Array[] = [];

  // 3. Subtle, High-Transparency Ruler / Fret Tick Lines
  private tickLines: THREE.LineSegments[] = [];
  private tickPositions: Float32Array[] = [];

  // 4. Precision Sighting Anchor Reticles (⌖) (2 reticles per string * 12 = 24 reticles)
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

    // Shared index buffer for 96-segment ribbon triangle strips (96 * 6 = 576 indices)
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
      // 1A. Outer Soft Neon Glow Ribbon (tightly follows the oscillating string, no wide shadow fill)
      const waveGlowPos = new Float32Array(this.verticesPerString * 2 * 3);
      const waveGlowCol = new Float32Array(this.verticesPerString * 2 * 3);
      this.waveGlowPositions.push(waveGlowPos);
      this.waveGlowColors.push(waveGlowCol);
      const waveGlowGeom = new THREE.BufferGeometry();
      waveGlowGeom.setAttribute('position', new THREE.BufferAttribute(waveGlowPos, 3));
      waveGlowGeom.setAttribute('color', new THREE.BufferAttribute(waveGlowCol, 3));
      waveGlowGeom.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
      const waveGlowMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const waveGlowMesh = new THREE.Mesh(waveGlowGeom, waveGlowMat);
      waveGlowMesh.visible = false;
      this.waveGlowMeshes.push(waveGlowMesh);
      this.waveGlowMaterials.push(waveGlowMat);
      this.group.add(waveGlowMesh);

      // 1B. Intense Core Beam Ribbon
      const waveCorePos = new Float32Array(this.verticesPerString * 2 * 3);
      const waveCoreCol = new Float32Array(this.verticesPerString * 2 * 3);
      this.waveCorePositions.push(waveCorePos);
      this.waveCoreColors.push(waveCoreCol);
      const waveCoreGeom = new THREE.BufferGeometry();
      waveCoreGeom.setAttribute('position', new THREE.BufferAttribute(waveCorePos, 3));
      waveCoreGeom.setAttribute('color', new THREE.BufferAttribute(waveCoreCol, 3));
      waveCoreGeom.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
      const waveCoreMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const waveCoreMesh = new THREE.Mesh(waveCoreGeom, waveCoreMat);
      waveCoreMesh.visible = false;
      this.waveCoreMeshes.push(waveCoreMesh);
      this.waveCoreMaterials.push(waveCoreMat);
      this.group.add(waveCoreMesh);

      // 1C. Center Filament Line
      const wavePos = new Float32Array(this.verticesPerString * 3);
      const waveCol = new Float32Array(this.verticesPerString * 3);
      this.wavePositions.push(wavePos);
      this.waveColors.push(waveCol);
      const waveGeom = new THREE.BufferGeometry();
      waveGeom.setAttribute('position', new THREE.BufferAttribute(wavePos, 3));
      waveGeom.setAttribute('color', new THREE.BufferAttribute(waveCol, 3));
      const waveMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 2.5,
        transparent: true,
        opacity: 1.0,
        depthTest: false,
      });
      const waveLine = new THREE.Line(waveGeom, waveMat);
      waveLine.visible = false;
      this.waveLines.push(waveLine);
      this.group.add(waveLine);

      // 2. Phase-Lagged Motion-Blur Ghost Trail Line
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
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const trailLine = new THREE.Line(trailGeom, trailMat);
      trailLine.visible = false;
      this.trailLines.push(trailLine);
      this.group.add(trailLine);

      // 3. Subtle, High-Transparency Ruler / Fret Ticks
      const tickPos = new Float32Array(this.maxTicksPerString * 2 * 3);
      this.tickPositions.push(tickPos);
      const tickGeom = new THREE.BufferGeometry();
      tickGeom.setAttribute('position', new THREE.BufferAttribute(tickPos, 3));
      const tickMat = new THREE.LineBasicMaterial({
        color: 0xaaffdd,
        linewidth: 1.0,
        transparent: true,
        opacity: this.rulerTickOpacity,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      });
      const tickLine = new THREE.LineSegments(tickGeom, tickMat);
      tickLine.visible = false;
      this.tickLines.push(tickLine);
      this.group.add(tickLine);

      // 4. Precision Sighting Anchor Reticles (2 per string: P1 and P2)
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

  public configure(cfg: Partial<VisualsConfigGroup>): void {
    if (cfg.waveCoreHalfWidth !== undefined) this.waveCoreHalfWidth = cfg.waveCoreHalfWidth;
    if (cfg.waveGlowHalfWidth !== undefined) this.waveGlowHalfWidth = cfg.waveGlowHalfWidth;
    if (cfg.rulerTickOpacity !== undefined) {
      this.rulerTickOpacity = cfg.rulerTickOpacity;
      this.tickLines.forEach((line) => {
        (line.material as THREE.LineBasicMaterial).opacity = this.rulerTickOpacity;
      });
    }
    if (cfg.majorTickHeight !== undefined) this.majorTickHeight = cfg.majorTickHeight;
    if (cfg.minorTickHeight !== undefined) this.minorTickHeight = cfg.minorTickHeight;
    if (cfg.waveAmplitude !== undefined) this.waveAmplitude = cfg.waveAmplitude;
    if (cfg.waveFrequency !== undefined) this.waveFrequency = cfg.waveFrequency;
    if (cfg.waveSpeed !== undefined) this.waveSpeed = cfg.waveSpeed;
    if (cfg.waveDamping !== undefined) this.waveDamping = cfg.waveDamping;
    if (cfg.waveDurationSec !== undefined) this.waveDurationSec = cfg.waveDurationSec;
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

    pos[ptr++] = -tickEnd; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = -tickStart; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = tickStart; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = tickEnd; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -tickEnd; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -tickStart; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = tickStart; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = tickEnd; pos[ptr++] = 0;

    const centerSpan = 0.0035;
    pos[ptr++] = -centerSpan; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = centerSpan; pos[ptr++] = 0; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = -centerSpan; pos[ptr++] = 0;
    pos[ptr++] = 0; pos[ptr++] = centerSpan; pos[ptr++] = 0;

    return pos;
  }

  /**
   * Triggers natural bi-directional traveling wave & multi-harmonic string oscillation from the exact hit point (contactRatio)
   */
  public triggerPluck(stringId: string, velocity: number, contactRatio: number, elapsed: number): void {
    const clampedVel = Math.min(1.0, Math.max(0.35, velocity));
    const initialAmplitude = this.waveAmplitude * clampedVel;
    this.vibrations.set(stringId, {
      stringId,
      initialAmplitude,
      amplitude: initialAmplitude,
      frequency: this.waveFrequency + (Math.random() - 0.5) * 4.0,
      waveSpeed: this.waveSpeed,
      damping: this.waveDamping,
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
      this.waveLines[i].visible = false;
      this.waveCoreMeshes[i].visible = false;
      this.waveGlowMeshes[i].visible = false;
      this.trailLines[i].visible = false;
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

      const vib = this.vibrations.get(str.id);
      let isVibrating = false;
      let timeSincePluck = 0;
      let envelopeAlpha = 0;

      if (vib && vib.active) {
        timeSincePluck = elapsed - vib.startTime;
        if (timeSincePluck < this.waveDurationSec) {
          isVibrating = true;
          envelopeAlpha = Math.exp(-vib.damping * timeSincePluck);
        } else {
          vib.active = false;
          this.vibrations.delete(str.id);
        }
      }

      const waveLine = this.waveLines[idx];
      const wavePos = this.wavePositions[idx];
      const waveCol = this.waveColors[idx];

      const waveCoreMesh = this.waveCoreMeshes[idx];
      const waveCorePos = this.waveCorePositions[idx];
      const waveCoreCol = this.waveCoreColors[idx];
      const waveCoreMat = this.waveCoreMaterials[idx];

      const waveGlowMesh = this.waveGlowMeshes[idx];
      const waveGlowPos = this.waveGlowPositions[idx];
      const waveGlowCol = this.waveGlowColors[idx];
      const waveGlowMat = this.waveGlowMaterials[idx];

      const trailMesh = this.trailLines[idx];
      const trailPos = this.trailPositions[idx];
      const trailCol = this.trailColors[idx];

      const pulse = 1.0 + 0.08 * Math.sin(elapsed * 4.5 + idx * 1.3);
      const coreBeamHalfWidth = this.waveCoreHalfWidth * 0.65 * pulse;
      const innerGlowHalfWidth = this.waveGlowHalfWidth * 0.65 * pulse;

      let linePtr = 0;
      let ribbonPtr = 0;

      for (let v = 0; v < this.verticesPerString; v++) {
        const u = v / this.segmentsPerString;
        const base = this.scratchVert.lerpVectors(p1, p2, u);
        const boundaryPin = Math.sin(Math.PI * u);

        if (isVibrating && vib) {
          // 1. Bi-Directional Traveling Wave Packets originating from the exact hit point (contactRatio = u0)
          const u0 = vib.contactRatio;
          const travelDist = vib.waveSpeed * timeSincePluck;
          const waveDecay = Math.exp(-1.9 * timeSincePluck);

          // Direct wavefronts moving left (u0 - c*t) and right (u0 + c*t) from the hit point
          const dLeft = u - (u0 - travelDist);
          const dRight = u - (u0 + travelDist);
          // Reflected wavefronts bouncing off the two fixed endpoints
          const dReflectLeft = u - (-(u0 - travelDist));
          const dReflectRight = u - (2.0 - (u0 + travelDist));

          const sigma = 0.075;
          const invSigmaSq = 1.0 / (2.0 * sigma * sigma);
          const pulseLeft = Math.exp(-dLeft * dLeft * invSigmaSq);
          const pulseRight = Math.exp(-dRight * dRight * invSigmaSq);
          const pulseRefL = 0.6 * Math.exp(-dReflectLeft * dReflectLeft * invSigmaSq);
          const pulseRefR = 0.6 * Math.exp(-dReflectRight * dReflectRight * invSigmaSq);

          const waveEnergy = Math.min(1.4, (pulseLeft + pulseRight + pulseRefL + pulseRefR) * waveDecay);

          const distFromContact = u - u0;
          const contactFlash =
            timeSincePluck < 0.16
              ? Math.exp(-distFromContact * distFromContact * 140.0) * (1.0 - timeSincePluck / 0.16)
              : 0;

          // 2. Multi-Harmonic Standing Guitar String Oscillation (harmonics 1, 2, 3 weighted by hit point u0)
          const w1Weight = Math.max(0.35, Math.sin(Math.PI * u0));
          const w2Weight = 0.45 * Math.sin(2.0 * Math.PI * u0);
          const w3Weight = 0.25 * Math.sin(3.0 * Math.PI * u0);

          const phase1 = vib.frequency * timeSincePluck;
          const phase2 = 2.02 * vib.frequency * timeSincePluck;
          const phase3 = 3.05 * vib.frequency * timeSincePluck;

          const mode1 = w1Weight * boundaryPin * envelopeAlpha;
          const mode2 = w2Weight * Math.sin(2.0 * Math.PI * u) * Math.exp(-1.45 * vib.damping * timeSincePluck);
          const mode3 = w3Weight * Math.sin(3.0 * Math.PI * u) * Math.exp(-2.1 * vib.damping * timeSincePluck);

          // Traveling wave ripples originating at u0 and propagating outward
          const travelingWaveOsc =
            0.55 * waveEnergy * Math.sin(14.0 * Math.PI * (u - u0) - 24.0 * timeSincePluck) * boundaryPin;

          // Instantaneous oscillating string position
          const instDisp =
            vib.initialAmplitude *
            (mode1 * Math.cos(phase1) +
              mode2 * Math.cos(phase2) +
              mode3 * Math.cos(phase3) +
              travelingWaveOsc);

          // Phase-lagged motion-blur ghost trail position
          const trailDisp =
            vib.initialAmplitude *
            0.82 *
            (mode1 * Math.cos(phase1 - 0.65) +
              mode2 * Math.cos(phase2 - 0.85) +
              travelingWaveOsc * 0.75);

          const oscPt = this.scratchOsc.copy(base).addScaledVector(normal, instDisp);
          const trailPt = this.scratchTrail.copy(base).addScaledVector(normal, trailDisp);

          wavePos[linePtr] = oscPt.x;
          wavePos[linePtr + 1] = oscPt.y;
          wavePos[linePtr + 2] = oscPt.z;

          trailPos[linePtr] = trailPt.x;
          trailPos[linePtr + 1] = trailPt.y;
          trailPos[linePtr + 2] = trailPt.z;

          // 3. Dynamic Neon Chromatic Gradient along traveling wave (Cyan -> Electric Blue -> Magenta -> Purple)
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

          waveCol[linePtr] = r;
          waveCol[linePtr + 1] = g;
          waveCol[linePtr + 2] = b;

          trailCol[linePtr] = Math.min(1.0, r * 0.85 + 0.25) * envelopeAlpha;
          trailCol[linePtr + 1] = g * 0.55 * envelopeAlpha;
          trailCol[linePtr + 2] = Math.min(1.0, b * 0.95) * envelopeAlpha;

          // Core & Inner Glow Ribbons (tightly follow oscillating string oscPt — no shadow fill)
          const activeCoreW = coreBeamHalfWidth * (1.0 + 0.55 * energyBoost);
          const coreTop = this.scratchUpper.copy(oscPt).addScaledVector(normal, activeCoreW);
          const coreBtm = this.scratchLower.copy(oscPt).addScaledVector(normal, -activeCoreW);

          waveCorePos[ribbonPtr] = coreTop.x;
          waveCorePos[ribbonPtr + 1] = coreTop.y;
          waveCorePos[ribbonPtr + 2] = coreTop.z;
          waveCoreCol[ribbonPtr] = r;
          waveCoreCol[ribbonPtr + 1] = g;
          waveCoreCol[ribbonPtr + 2] = b;

          waveCorePos[ribbonPtr + 3] = coreBtm.x;
          waveCorePos[ribbonPtr + 4] = coreBtm.y;
          waveCorePos[ribbonPtr + 5] = coreBtm.z;
          waveCoreCol[ribbonPtr + 3] = r;
          waveCoreCol[ribbonPtr + 4] = g;
          waveCoreCol[ribbonPtr + 5] = b;

          const activeGlowW = innerGlowHalfWidth * (1.0 + 0.85 * energyBoost);
          const glowTop = this.scratchUpper.copy(oscPt).addScaledVector(normal, activeGlowW);
          const glowBtm = this.scratchLower.copy(oscPt).addScaledVector(normal, -activeGlowW);

          waveGlowPos[ribbonPtr] = glowTop.x;
          waveGlowPos[ribbonPtr + 1] = glowTop.y;
          waveGlowPos[ribbonPtr + 2] = glowTop.z;
          waveGlowCol[ribbonPtr] = r;
          waveGlowCol[ribbonPtr + 1] = g;
          waveGlowCol[ribbonPtr + 2] = b;

          waveGlowPos[ribbonPtr + 3] = glowBtm.x;
          waveGlowPos[ribbonPtr + 4] = glowBtm.y;
          waveGlowPos[ribbonPtr + 5] = glowBtm.z;
          waveGlowCol[ribbonPtr + 3] = r;
          waveGlowCol[ribbonPtr + 4] = g;
          waveGlowCol[ribbonPtr + 5] = b;
        } else {
          // Idle State: Straight Glowing Laser Beam
          wavePos[linePtr] = base.x;
          wavePos[linePtr + 1] = base.y;
          wavePos[linePtr + 2] = base.z;

          const idleShimmer = 0.92 + 0.08 * Math.sin(u * Math.PI * 4.0 + elapsed * 3.5 + idx);
          const coreR = this.baseColor.r * idleShimmer;
          const coreG = this.baseColor.g * idleShimmer;
          const coreB = this.baseColor.b * idleShimmer;

          waveCol[linePtr] = coreR;
          waveCol[linePtr + 1] = coreG;
          waveCol[linePtr + 2] = coreB;

          const coreTop = this.scratchUpper.copy(base).addScaledVector(normal, coreBeamHalfWidth);
          const coreBtm = this.scratchLower.copy(base).addScaledVector(normal, -coreBeamHalfWidth);

          waveCorePos[ribbonPtr] = coreTop.x;
          waveCorePos[ribbonPtr + 1] = coreTop.y;
          waveCorePos[ribbonPtr + 2] = coreTop.z;
          waveCoreCol[ribbonPtr] = coreR;
          waveCoreCol[ribbonPtr + 1] = coreG;
          waveCoreCol[ribbonPtr + 2] = coreB;

          waveCorePos[ribbonPtr + 3] = coreBtm.x;
          waveCorePos[ribbonPtr + 4] = coreBtm.y;
          waveCorePos[ribbonPtr + 5] = coreBtm.z;
          waveCoreCol[ribbonPtr + 3] = coreR;
          waveCoreCol[ribbonPtr + 4] = coreG;
          waveCoreCol[ribbonPtr + 5] = coreB;

          const innerR = Math.min(1.0, this.baseColor.r * 1.15);
          const innerG = Math.min(1.0, this.baseColor.g * 1.15);
          const innerB = Math.min(1.0, this.baseColor.b * 1.15);

          const glowTop = this.scratchUpper.copy(base).addScaledVector(normal, innerGlowHalfWidth);
          const glowBtm = this.scratchLower.copy(base).addScaledVector(normal, -innerGlowHalfWidth);

          waveGlowPos[ribbonPtr] = glowTop.x;
          waveGlowPos[ribbonPtr + 1] = glowTop.y;
          waveGlowPos[ribbonPtr + 2] = glowTop.z;
          waveGlowCol[ribbonPtr] = innerR;
          waveGlowCol[ribbonPtr + 1] = innerG;
          waveGlowCol[ribbonPtr + 2] = innerB;

          waveGlowPos[ribbonPtr + 3] = glowBtm.x;
          waveGlowPos[ribbonPtr + 4] = glowBtm.y;
          waveGlowPos[ribbonPtr + 5] = glowBtm.z;
          waveGlowCol[ribbonPtr + 3] = innerR;
          waveGlowCol[ribbonPtr + 4] = innerG;
          waveGlowCol[ribbonPtr + 5] = innerB;
        }

        linePtr += 3;
        ribbonPtr += 6;
      }

      (waveLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (waveLine.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      waveLine.visible = true;

      waveCoreMat.opacity = isVibrating ? 0.98 : 0.92;
      (waveCoreMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (waveCoreMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      waveCoreMesh.visible = true;

      waveGlowMat.opacity = isVibrating ? 0.78 : 0.62;
      (waveGlowMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (waveGlowMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      waveGlowMesh.visible = true;

      if (isVibrating) {
        (trailMesh.material as THREE.LineBasicMaterial).opacity = 0.75 * envelopeAlpha;
        (trailMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (trailMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        trailMesh.visible = true;
      }

      const isP1Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p1');
      const isP2Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p2');

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

      const numTicks = Math.min(this.maxTicksPerString, Math.max(8, Math.floor(length * 35)));
      const tickLine = this.tickLines[idx];
      const tickPos = this.tickPositions[idx];
      let ptr = 0;

      for (let t = 0; t < numTicks; t++) {
        const factor = (t + 1) / (numTicks + 1);
        const center = this.scratchCenter.lerpVectors(p1, p2, factor);

        const isMajor = t === Math.floor(numTicks / 2) || t % 4 === 0;
        const tickHeight = isMajor ? this.majorTickHeight : this.minorTickHeight;

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
