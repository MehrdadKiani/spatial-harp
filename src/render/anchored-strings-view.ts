import * as THREE from 'three';
import { AnchoredString, EndpointGrabState } from '../types/instruments';
import { SceneManager } from './scene-manager';

export class AnchoredStringsView {
  private group: THREE.Group;
  private sceneManager: SceneManager;
  private maxStrings: number;
  private maxTicksPerString = 30;

  // Pre-allocated Pools (Zero-GC)
  private stringLines: THREE.Line[] = [];
  private stringLinePositions: Float32Array[] = [];
  private tickLines: THREE.LineSegments[] = [];
  private tickPositions: Float32Array[] = [];

  // End-cap anchor node meshes (2 nodes per string * 12 = 24 nodes)
  private anchorNodes: THREE.Mesh[] = [];

  // Reusable scratch vectors to avoid per-frame allocations
  private scratchP1 = new THREE.Vector3();
  private scratchP2 = new THREE.Vector3();
  private scratchDir = new THREE.Vector3();
  private scratchNormal = new THREE.Vector3();
  private scratchCenter = new THREE.Vector3();
  private scratchTop = new THREE.Vector3();
  private scratchBtm = new THREE.Vector3();

  constructor(sceneManager: SceneManager, maxStrings = 12) {
    this.sceneManager = sceneManager;
    this.maxStrings = maxStrings;
    this.group = new THREE.Group();
    this.sceneManager.scene.add(this.group);

    const anchorGeom = new THREE.CircleGeometry(0.009, 16);

    for (let i = 0; i < this.maxStrings; i++) {
      // 1. String line mesh
      const pos = new Float32Array(2 * 3);
      this.stringLinePositions.push(pos);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        linewidth: 2.5,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      });
      const line = new THREE.Line(geom, mat);
      line.visible = false;
      this.stringLines.push(line);
      this.group.add(line);

      // 2. Fret ticks mesh
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

      // 3. Anchor end nodes (P1 and P2)
      for (let j = 0; j < 2; j++) {
        const nodeMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          depthTest: false,
        });
        const node = new THREE.Mesh(anchorGeom, nodeMat);
        node.visible = false;
        this.anchorNodes.push(node);
        this.group.add(node);
      }
    }
  }

  public update(
    strings: AnchoredString[],
    activeGrabs: EndpointGrabState[],
    videoAspect: number,
    elapsed: number
  ): void {
    // Hide all meshes first
    for (let i = 0; i < this.maxStrings; i++) {
      this.stringLines[i].visible = false;
      this.tickLines[i].visible = false;
      this.anchorNodes[i * 2].visible = false;
      this.anchorNodes[i * 2 + 1].visible = false;
    }

    strings.forEach((str, idx) => {
      if (idx >= this.maxStrings) return;

      // Re-calculate world coordinates from normalized points to ensure proper aspect fit
      const p1 = this.scratchP1;
      const p2 = this.scratchP2;
      const w1 = this.sceneManager.toWorldCoords(str.point1.x, str.point1.y, str.point1.z, videoAspect);
      const w2 = this.sceneManager.toWorldCoords(str.point2.x, str.point2.y, str.point2.z, videoAspect);
      p1.copy(w1);
      p2.copy(w2);

      // Update main string line
      const lineMesh = this.stringLines[idx];
      const linePos = this.stringLinePositions[idx];
      linePos[0] = p1.x;
      linePos[1] = p1.y;
      linePos[2] = p1.z;
      linePos[3] = p2.x;
      linePos[4] = p2.y;
      linePos[5] = p2.z;

      (lineMesh.material as THREE.LineBasicMaterial).color.setHex(str.color);
      (lineMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      lineMesh.visible = true;

      // Check if endpoints are currently grabbed
      const isP1Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p1');
      const isP2Grabbed = activeGrabs.some((g) => g.stringId === str.id && g.endpoint === 'p2');

      // Update end anchor nodes
      const node1 = this.anchorNodes[idx * 2];
      const node2 = this.anchorNodes[idx * 2 + 1];
      node1.position.copy(p1);
      node2.position.copy(p2);

      // Visual feedback for grabbed node vs passive node
      if (isP1Grabbed) {
        (node1.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
        const grabScale = 1.8 + 0.2 * Math.sin(elapsed * 8.0);
        node1.scale.setScalar(grabScale);
      } else {
        (node1.material as THREE.MeshBasicMaterial).color.setHex(str.color);
        const normalScale = 1.0 + 0.15 * Math.sin(elapsed * 3.0 + idx);
        node1.scale.setScalar(normalScale);
      }

      if (isP2Grabbed) {
        (node2.material as THREE.MeshBasicMaterial).color.setHex(0xffffff);
        const grabScale = 1.8 + 0.2 * Math.sin(elapsed * 8.0);
        node2.scale.setScalar(grabScale);
      } else {
        (node2.material as THREE.MeshBasicMaterial).color.setHex(str.color);
        const normalScale = 1.0 + 0.15 * Math.sin(elapsed * 3.0 + idx);
        node2.scale.setScalar(normalScale);
      }

      node1.visible = true;
      node2.visible = true;

      // Update graduated fret tick marks
      const dir = this.scratchDir.subVectors(p2, p1);
      const length = dir.length();
      dir.normalize();

      // Perpendicular normal: (-dy, dx, 0)
      const normal = this.scratchNormal.set(-dir.y, dir.x, 0).normalize();
      const numTicks = Math.min(this.maxTicksPerString, Math.max(8, Math.floor(length * 35)));
      const tickLine = this.tickLines[idx];
      const tickPos = this.tickPositions[idx];
      let ptr = 0;

      for (let t = 0; t < numTicks; t++) {
        const factor = (t + 1) / (numTicks + 1);
        const center = this.scratchCenter.lerpVectors(p1, p2, factor);
        const isMajor = t === Math.floor(numTicks / 2) || t % 4 === 0;
        const tickHeight = isMajor ? 0.014 : 0.007;

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
