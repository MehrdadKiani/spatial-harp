import * as THREE from 'three';
import { HAND_CONNECTIONS, HandPose } from '../types/vision';
import { SceneManager } from './scene-manager';

export class SkeletonView {
  private group: THREE.Group;
  private sceneManager: SceneManager;

  // Joint rendering pool (max 2 hands * 21 joints = 42 joints)
  private jointMeshes: THREE.Mesh[] = [];
  // Bone lines pool
  private boneLines: THREE.LineSegments[] = [];

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

    this.jointGeometry = new THREE.CircleGeometry(0.007, 16);

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

  public update(hands: HandPose[], videoAspect: number): void {
    // Hide all first
    this.jointMeshes.forEach((m) => (m.visible = false));
    this.boneLines.forEach((l) => (l.visible = false));

    let jointCursor = 0;

    hands.forEach((hand, handIdx) => {
      if (handIdx >= 2) return;

      const worldPositions: THREE.Vector3[] = [];

      // Update 21 joint nodes
      hand.landmarks.forEach((pt, lmIdx) => {
        if (jointCursor >= this.jointMeshes.length) return;

        const mesh = this.jointMeshes[jointCursor++];
        const worldPos = this.sceneManager.toWorldCoords(pt.x, pt.y, pt.z, videoAspect);
        worldPositions.push(worldPos);

        mesh.position.copy(worldPos);
        mesh.visible = true;

        // Special highlight for fingertips (Thumb: 4, Index: 8)
        if (lmIdx === 4 || lmIdx === 8) {
          mesh.material = this.fingertipMaterial;
          mesh.scale.setScalar(1.4);
        } else {
          mesh.material = this.jointMaterial;
          mesh.scale.setScalar(1.0);
        }
      });

      // Update bone lines
      const line = this.boneLines[handIdx];
      if (line && worldPositions.length >= 21) {
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;

        let ptr = 0;
        HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
          const p1 = worldPositions[startIdx];
          const p2 = worldPositions[endIdx];

          if (p1 && p2) {
            array[ptr++] = p1.x;
            array[ptr++] = p1.y;
            array[ptr++] = p1.z;
            array[ptr++] = p2.x;
            array[ptr++] = p2.y;
            array[ptr++] = p2.z;
          }
        });

        posAttr.needsUpdate = true;
        line.visible = true;
      }
    });
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
