import * as THREE from 'three';
import { HAND_CONNECTIONS, HandPose } from '../types/vision';
import { VisualsConfigGroup } from '../core/config';
import { SceneManager } from './scene-manager';

export class SkeletonView {
  private group: THREE.Group;
  private sceneManager: SceneManager;

  // Configurable joint sizing & visibility parameters (defaults synced with config.json)
  private showBones = false;
  private fingertipsOnly = true;
  private jointRadius = 0.0045;
  private fingertipScale = 1.28;
  private referencePalmSpan = 0.18;
  private minJointScale = 0.42;
  private maxJointScale = 1.15;

  // Joint rendering pool (max 2 hands * 21 joints = 42 joints)
  private jointMeshes: THREE.Mesh[] = [];
  // Bone lines pool
  private boneLines: THREE.LineSegments[] = [];
  // Pre-allocated scratch positions for one hand (21 landmarks) to avoid per-frame GC
  private handWorldPositions: THREE.Vector3[] = Array.from(
    { length: 21 },
    () => new THREE.Vector3()
  );

  // Materials
  private jointMaterial: THREE.MeshBasicMaterial;
  private fingertipMaterial: THREE.MeshBasicMaterial;
  private boneMaterial: THREE.LineBasicMaterial;

  private jointGeometry: THREE.CircleGeometry;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    // Glowing Red Joint Material (matching video)
    this.jointMaterial = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      depthTest: false,
    });

    // Fingertips (Index & Thumb) brighter orange-red with highlight ring
    this.fingertipMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4433,
      depthTest: false,
    });

    // Glowing Green Bone Material (matching video)
    this.boneMaterial = new THREE.LineBasicMaterial({
      color: 0x22ee44,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });

    // Unit circle geometry scaled per-frame by jointRadius * handScale (zero-GC reconfig)
    this.jointGeometry = new THREE.CircleGeometry(1.0, 16);

    // Pre-allocate joint meshes for up to 2 hands
    for (let i = 0; i < 42; i++) {
      const mesh = new THREE.Mesh(this.jointGeometry, this.jointMaterial);
      mesh.visible = false;
      this.jointMeshes.push(mesh);
      this.group.add(mesh);
    }

    // Pre-allocate bone line segments for up to 2 hands
    for (let h = 0; h < 2; h++) {
      const positions = new Float32Array(HAND_CONNECTIONS.length * 2 * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.LineSegments(geom, this.boneMaterial);
      line.visible = false;
      this.boneLines.push(line);
      this.group.add(line);
    }
  }

  public configure(cfg: Partial<VisualsConfigGroup>): void {
    if (cfg.skeletonShowBones !== undefined) {
      this.showBones = cfg.skeletonShowBones;
      if (!this.showBones) {
        for (let i = 0; i < this.boneLines.length; i++) {
          this.boneLines[i].visible = false;
        }
      }
    }
    if (cfg.skeletonFingertipsOnly !== undefined) {
      this.fingertipsOnly = cfg.skeletonFingertipsOnly;
    }
    if (cfg.skeletonJointRadius !== undefined) {
      this.jointRadius = cfg.skeletonJointRadius;
    }
    if (cfg.skeletonFingertipScale !== undefined) {
      this.fingertipScale = cfg.skeletonFingertipScale;
    }
    if (cfg.skeletonReferencePalmSpan !== undefined) {
      this.referencePalmSpan = cfg.skeletonReferencePalmSpan;
    }
    if (cfg.skeletonMinJointScale !== undefined) {
      this.minJointScale = cfg.skeletonMinJointScale;
    }
    if (cfg.skeletonMaxJointScale !== undefined) {
      this.maxJointScale = cfg.skeletonMaxJointScale;
    }
  }

  public update(hands: HandPose[], videoAspect: number): void {
    // Hide all first
    for (let i = 0; i < this.jointMeshes.length; i++) {
      this.jointMeshes[i].visible = false;
    }
    for (let i = 0; i < this.boneLines.length; i++) {
      this.boneLines[i].visible = false;
    }

    let jointCursor = 0;

    for (let handIdx = 0; handIdx < hands.length && handIdx < 2; handIdx++) {
      const hand = hands[handIdx];
      const count = Math.min(hand.landmarks.length, 21);

      // Compute world positions for all landmarks first (zero-GC target write)
      for (let lmIdx = 0; lmIdx < count; lmIdx++) {
        const pt = hand.landmarks[lmIdx];
        this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect, this.handWorldPositions[lmIdx]);
      }

      // Scale joint dots proportionally to apparent hand size (wrist 0 -> middle MCP 9)
      // so dots stay crisp on both desktop landscape and narrow mobile portrait screens
      let handScale = 1.0;
      if (count >= 10) {
        const wrist = this.handWorldPositions[0];
        const midMcp = this.handWorldPositions[9];
        const palmSpan = Math.hypot(midMcp.x - wrist.x, midMcp.y - wrist.y);
        handScale = Math.max(
          this.minJointScale,
          Math.min(this.maxJointScale, palmSpan / this.referencePalmSpan)
        );
      }

      const regularRadius = this.jointRadius * handScale;
      const tipRadius = regularRadius * this.fingertipScale;

      // Update joint nodes (either all 21 landmarks or only the 5 fingertips: 4, 8, 12, 16, 20)
      for (let lmIdx = 0; lmIdx < count; lmIdx++) {
        if (
          this.fingertipsOnly &&
          lmIdx !== 4 &&
          lmIdx !== 8 &&
          lmIdx !== 12 &&
          lmIdx !== 16 &&
          lmIdx !== 20
        ) {
          continue;
        }
        if (jointCursor >= this.jointMeshes.length) break;

        const mesh = this.jointMeshes[jointCursor++];
        mesh.position.copy(this.handWorldPositions[lmIdx]);
        mesh.visible = true;

        // Special highlight for fingertips (Thumb: 4, Index: 8)
        if (lmIdx === 4 || lmIdx === 8) {
          mesh.material = this.fingertipMaterial;
          mesh.scale.setScalar(tipRadius);
        } else {
          mesh.material = this.jointMaterial;
          mesh.scale.setScalar(regularRadius);
        }
      }

      // Update bone lines (only when enabled in config)
      const line = this.boneLines[handIdx];
      if (this.showBones && line && count >= 21) {
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;

        let ptr = 0;
        for (let c = 0; c < HAND_CONNECTIONS.length; c++) {
          const [startIdx, endIdx] = HAND_CONNECTIONS[c];
          const p1 = this.handWorldPositions[startIdx];
          const p2 = this.handWorldPositions[endIdx];

          array[ptr++] = p1.x;
          array[ptr++] = p1.y;
          array[ptr++] = p1.z;
          array[ptr++] = p2.x;
          array[ptr++] = p2.y;
          array[ptr++] = p2.z;
        }

        posAttr.needsUpdate = true;
        line.visible = true;
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
