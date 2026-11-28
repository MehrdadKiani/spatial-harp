import * as THREE from 'three';
import { AnchoredString, EndpointGrabState } from '../types/instruments';
import { StringVibrationState } from '../types/physics';
import { SceneManager } from './scene-manager';
import { VisualsConfigGroup } from '../core/config';

export interface AnchoredStringsViewOptions {
  segmentsPerString?: number;
  renderCenterLine?: boolean;
  renderGhostTrail?: boolean;
}

interface StringSlotCache {
  stringId: string;
  p1x: number;
  p1y: number;
  p1z: number;
  p2x: number;
  p2y: number;
  p2z: number;
  color: number;
  videoAspect: number;
  wasVibrating: boolean;
}

export class AnchoredStringsView {
  private group: THREE.Group;
  private sceneManager: SceneManager;
  private maxStrings: number;
  private maxTicksPerString = 30;

  // Configurable tessellation (64 desktop, 32 mobile) for smooth waves with minimal GPU uploads
  private segmentsPerString: number;
  private verticesPerString: number;
  private renderCenterLine: boolean;
  private renderGhostTrail: boolean;
  private slotCaches: StringSlotCache[] = [];

  // Configurable visual & wave physics parameters (from public/config.json)
  private waveCoreHalfWidth = 0.0014;
  private waveGlowHalfWidth = 0.0038;
  private rulerTickOpacity = 0.14;
  private majorTickHeight = 0.010;
  private minorTickHeight = 0.005;
  private waveAmplitude = 0.016;
  private waveFrequency = 58.0;
  private waveSpeed = 2.6;
  private waveDamping = 2.85;
  private waveDurationSec = 1.35;

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

  constructor(sceneManager: SceneManager, maxStrings = 12, options: AnchoredStringsViewOptions = {}) {
    this.sceneManager = sceneManager;
    this.maxStrings = maxStrings;
    this.segmentsPerString = Math.max(16, options.segmentsPerString ?? 64);
    this.verticesPerString = this.segmentsPerString + 1;
    this.renderCenterLine = options.renderCenterLine ?? true;
    this.renderGhostTrail = options.renderGhostTrail ?? true;
    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    for (let i = 0; i < this.maxStrings; i++) {
      this.slotCaches.push({
        stringId: '',
        p1x: NaN,
        p1y: NaN,
        p1z: NaN,
        p2x: NaN,
        p2y: NaN,
        p2z: NaN,
        color: -1,
        videoAspect: -1,
        wasVibrating: false,
      });
    }

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
    let invalidateGeometry = false;
    if (cfg.waveCoreHalfWidth !== undefined) {
      this.waveCoreHalfWidth = cfg.waveCoreHalfWidth;
      invalidateGeometry = true;
    }
    if (cfg.waveGlowHalfWidth !== undefined) {
      this.waveGlowHalfWidth = cfg.waveGlowHalfWidth;
      invalidateGeometry = true;
    }
    if (cfg.rulerTickOpacity !== undefined) {
      this.rulerTickOpacity = cfg.rulerTickOpacity;
      this.tickLines.forEach((line) => {
        (line.material as THREE.LineBasicMaterial).opacity = this.rulerTickOpacity;
      });
    }
    if (cfg.majorTickHeight !== undefined) {
      this.majorTickHeight = cfg.majorTickHeight;
      invalidateGeometry = true;
    }
    if (cfg.minorTickHeight !== undefined) {
      this.minorTickHeight = cfg.minorTickHeight;
      invalidateGeometry = true;
    }
    if (cfg.waveAmplitude !== undefined) this.waveAmplitude = cfg.waveAmplitude;
    if (cfg.waveFrequency !== undefined) this.waveFrequency = cfg.waveFrequency;
    if (cfg.waveSpeed !== undefined) this.waveSpeed = cfg.waveSpeed;
    if (cfg.waveDamping !== undefined) this.waveDamping = cfg.waveDamping;
    if (cfg.waveDurationSec !== undefined) this.waveDurationSec = cfg.waveDurationSec;
    if (invalidateGeometry) {
      for (let i = 0; i < this.slotCaches.length; i++) {
        this.slotCaches[i].stringId = '';
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
    const clampedVel = Math.min(1.0, Math.max(0.22, velocity));
    const initialAmplitude = this.waveAmplitude * clampedVel;
    this.vibrations.set(stringId, {
      stringId,
      initialAmplitude,
      amplitude: initialAmplitude,
      frequency: this.waveFrequency + (Math.random() - 0.5) * 3.0,
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

      const p1 = this.sceneManager.toWorldCoords(str.point1.x, str.point1.y, str.point1.z, videoAspect, this.scratchP1);
      const p2 = this.sceneManager.toWorldCoords(str.point2.x, str.point2.y, str.point2.z, videoAspect, this.scratchP2);

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

      const cache = this.slotCaches[idx];
      const geometryChanged =
        cache.stringId !== str.id ||
        cache.p1x !== p1.x ||
        cache.p1y !== p1.y ||
        cache.p1z !== p1.z ||
        cache.p2x !== p2.x ||
        cache.p2y !== p2.y ||
        cache.p2z !== p2.z ||
        cache.color !== str.color ||
        cache.videoAspect !== videoAspect;

      const needsVertexUpdate = isVibrating || cache.wasVibrating || geometryChanged;

      const waveLine = this.waveLines[idx];
      const waveCoreMesh = this.waveCoreMeshes[idx];
      const waveCoreMat = this.waveCoreMaterials[idx];
      const waveGlowMesh = this.waveGlowMeshes[idx];
      const waveGlowMat = this.waveGlowMaterials[idx];
      const trailMesh = this.trailLines[idx];

      const idleBreath = 0.96 + 0.04 * Math.sin(elapsed * 3.8 + idx * 1.3);

      if (needsVertexUpdate) {
        const wavePos = this.wavePositions[idx];
        const waveCol = this.waveColors[idx];
        const waveCorePos = this.waveCorePositions[idx];
        const waveCoreCol = this.waveCoreColors[idx];
        const waveGlowPos = this.waveGlowPositions[idx];
        const waveGlowCol = this.waveGlowColors[idx];
        const trailPos = this.trailPositions[idx];
        const trailCol = this.trailColors[idx];

        const coreBeamHalfWidth = this.waveCoreHalfWidth * 0.65;
        const innerGlowHalfWidth = this.waveGlowHalfWidth * 0.65;

        // Hoist per-string wave invariants outside the vertex loop (~70% less trig/exp math per frame)
        let u0 = 0.5;
        let travelDist = 0;
        let waveDecay = 0;
        const invSigmaSq = 1.0 / (2.0 * 0.075 * 0.075);
        let contactFlashAmp = 0;
        let effectiveAmp = 0;
        let w1Cos = 0;
        let w2Cos = 0;
        let w3Cos = 0;
        let w1TrailCos = 0;
        let w2TrailCos = 0;
        let transientCos = 0;

        if (isVibrating && vib) {
          const lengthFactor = Math.min(1.35, Math.max(0.55, length / 0.6));
          effectiveAmp = vib.initialAmplitude * lengthFactor;
          const effectiveFreq = vib.frequency / Math.sqrt(lengthFactor);

          u0 = vib.contactRatio;
          travelDist = vib.waveSpeed * timeSincePluck;
          waveDecay = Math.exp(-2.8 * timeSincePluck);
          contactFlashAmp = timeSincePluck < 0.14 ? 1.0 - timeSincePluck / 0.14 : 0;

          const phase1 = effectiveFreq * timeSincePluck;
          const phase2 = 2.005 * phase1;
          const phase3 = 3.012 * phase1;

          const w1Weight = Math.max(0.35, Math.sin(Math.PI * u0)) * envelopeAlpha;
          const w2Weight = 0.22 * Math.sin(2.0 * Math.PI * u0) * Math.exp(-2.2 * vib.damping * timeSincePluck);
          const w3Weight = 0.09 * Math.sin(3.0 * Math.PI * u0) * Math.exp(-3.4 * vib.damping * timeSincePluck);

          const cosP1 = Math.cos(phase1);
          w1Cos = w1Weight * cosP1;
          w2Cos = w2Weight * Math.cos(phase2);
          w3Cos = w3Weight * Math.cos(phase3);
          transientCos = 0.14 * Math.exp(-18.0 * timeSincePluck) * cosP1;

          if (this.renderGhostTrail) {
            w1TrailCos = w1Weight * Math.cos(phase1 - 0.35);
            w2TrailCos = w2Weight * Math.cos(phase2 - 0.50);
          }
        }

        const baseR = this.baseColor.r;
        const baseG = this.baseColor.g;
        const baseB = this.baseColor.b;
        const innerR = Math.min(1.0, baseR * 1.15);
        const innerG = Math.min(1.0, baseG * 1.15);
        const innerB = Math.min(1.0, baseB * 1.15);

        let linePtr = 0;
        let ribbonPtr = 0;

        for (let v = 0; v < this.verticesPerString; v++) {
          const u = v / this.segmentsPerString;
          const base = this.scratchVert.lerpVectors(p1, p2, u);

          if (isVibrating && vib) {
            const boundaryPin = Math.sin(Math.PI * u);

            // 1. Bi-Directional Traveling Energy Pulse originating from the exact hit point (u0)
            const dLeft = u - (u0 - travelDist);
            const dRight = u - (u0 + travelDist);
            const dReflectLeft = u - (-(u0 - travelDist));
            const dReflectRight = u - (2.0 - (u0 + travelDist));

            const pulseLeft = Math.exp(-dLeft * dLeft * invSigmaSq);
            const pulseRight = Math.exp(-dRight * dRight * invSigmaSq);
            const pulseRefL = 0.55 * Math.exp(-dReflectLeft * dReflectLeft * invSigmaSq);
            const pulseRefR = 0.55 * Math.exp(-dReflectRight * dReflectRight * invSigmaSq);

            const waveEnergy = Math.min(1.2, (pulseLeft + pulseRight + pulseRefL + pulseRefR) * waveDecay);

            const distFromContact = u - u0;
            const contactFlash =
              contactFlashAmp > 0
                ? Math.exp(-distFromContact * distFromContact * 140.0) * contactFlashAmp
                : 0;

            // 2. Physical 1/n^2 Plucked-String Standing Harmonics + brief localized release transient
            const sin2 = Math.sin(2.0 * Math.PI * u);
            const sin3 = Math.sin(3.0 * Math.PI * u);
            const instDisp =
              effectiveAmp *
              (w1Cos * boundaryPin +
                w2Cos * sin2 +
                w3Cos * sin3 +
                transientCos * waveEnergy * boundaryPin);

            const oscPt = this.scratchOsc.copy(base).addScaledVector(normal, instDisp);

            // 3. Dynamic Neon Chromatic Gradient along traveling wave
            const chromaPhase = u * 3.5 - timeSincePluck * 5.5;
            const cyanFactor = 0.5 + 0.5 * Math.cos(chromaPhase);
            const magentaFactor = 0.5 + 0.5 * Math.sin(chromaPhase);
            const energyBoost = Math.min(1.0, waveEnergy * 0.85 + contactFlash * 0.5);

            const r = Math.min(
              1.0,
              baseR * (1.0 - energyBoost * 0.45) +
                (0.95 * magentaFactor + 0.20 * (1.0 - cyanFactor)) * energyBoost
            );
            const g = Math.min(
              1.0,
              baseG * (1.0 - energyBoost * 0.45) +
                (0.95 * cyanFactor + 0.10 * magentaFactor) * energyBoost
            );
            const b = Math.min(
              1.0,
              baseB * (1.0 - energyBoost * 0.35) + 0.90 * energyBoost
            );

            if (this.renderCenterLine) {
              wavePos[linePtr] = oscPt.x;
              wavePos[linePtr + 1] = oscPt.y;
              wavePos[linePtr + 2] = oscPt.z;
              waveCol[linePtr] = r;
              waveCol[linePtr + 1] = g;
              waveCol[linePtr + 2] = b;
            }

            if (this.renderGhostTrail) {
              const trailDisp = effectiveAmp * 0.78 * (w1TrailCos * boundaryPin + w2TrailCos * sin2);
              const trailPt = this.scratchTrail.copy(base).addScaledVector(normal, trailDisp);
              trailPos[linePtr] = trailPt.x;
              trailPos[linePtr + 1] = trailPt.y;
              trailPos[linePtr + 2] = trailPt.z;
              trailCol[linePtr] = Math.min(1.0, r * 0.85 + 0.25) * envelopeAlpha;
              trailCol[linePtr + 1] = g * 0.55 * envelopeAlpha;
              trailCol[linePtr + 2] = Math.min(1.0, b * 0.95) * envelopeAlpha;
            }

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
            // Idle State: Straight Glowing Laser Beam (cached until endpoints change or plucked)
            if (this.renderCenterLine) {
              wavePos[linePtr] = base.x;
              wavePos[linePtr + 1] = base.y;
              wavePos[linePtr + 2] = base.z;
              waveCol[linePtr] = baseR;
              waveCol[linePtr + 1] = baseG;
              waveCol[linePtr + 2] = baseB;
            }

            const coreTop = this.scratchUpper.copy(base).addScaledVector(normal, coreBeamHalfWidth);
            const coreBtm = this.scratchLower.copy(base).addScaledVector(normal, -coreBeamHalfWidth);

            waveCorePos[ribbonPtr] = coreTop.x;
            waveCorePos[ribbonPtr + 1] = coreTop.y;
            waveCorePos[ribbonPtr + 2] = coreTop.z;
            waveCoreCol[ribbonPtr] = baseR;
            waveCoreCol[ribbonPtr + 1] = baseG;
            waveCoreCol[ribbonPtr + 2] = baseB;

            waveCorePos[ribbonPtr + 3] = coreBtm.x;
            waveCorePos[ribbonPtr + 4] = coreBtm.y;
            waveCorePos[ribbonPtr + 5] = coreBtm.z;
            waveCoreCol[ribbonPtr + 3] = baseR;
            waveCoreCol[ribbonPtr + 4] = baseG;
            waveCoreCol[ribbonPtr + 5] = baseB;

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

        if (this.renderCenterLine) {
          (waveLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          (waveLine.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        }
        (waveCoreMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (waveCoreMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        (waveGlowMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (waveGlowMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

        if (isVibrating && this.renderGhostTrail) {
          (trailMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          (trailMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        }
      }

      if (this.renderCenterLine) {
        waveLine.visible = true;
      }

      waveCoreMat.opacity = isVibrating ? 0.98 : 0.92 * idleBreath;
      waveCoreMesh.visible = true;

      waveGlowMat.opacity = isVibrating ? 0.78 : 0.62 * idleBreath;
      waveGlowMesh.visible = true;

      if (isVibrating && this.renderGhostTrail) {
        (trailMesh.material as THREE.LineBasicMaterial).opacity = 0.42 * envelopeAlpha;
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

      const tickLine = this.tickLines[idx];
      if (geometryChanged) {
        const numTicks = Math.min(this.maxTicksPerString, Math.max(8, Math.floor(length * 35)));
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
      }
      tickLine.visible = true;

      cache.stringId = str.id;
      cache.p1x = p1.x;
      cache.p1y = p1.y;
      cache.p1z = p1.z;
      cache.p2x = p2.x;
      cache.p2y = p2.y;
      cache.p2z = p2.z;
      cache.color = str.color;
      cache.videoAspect = videoAspect;
      cache.wasVibrating = isVibrating;
    });
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
