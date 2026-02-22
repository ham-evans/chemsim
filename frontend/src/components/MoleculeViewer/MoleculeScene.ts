import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Atom, Bond, VolumetricData } from "@/lib/types";
import {
  CPK_COLORS,
  DEFAULT_COLOR,
  ATOM_RADII,
  DEFAULT_RADIUS,
  BOND_RADIUS,
} from "./constants";
import { marchingCubes } from "./marchingCubes";

interface AngleInfo {
  i: number;
  j: number; // center
  k: number;
}

export class MoleculeScene {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: TrackballControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private atomMesh: THREE.InstancedMesh | null = null;
  private bondMesh: THREE.InstancedMesh | null = null;
  private selectionRing: THREE.Mesh | null = null;

  private atoms: Atom[] = [];
  private bonds: Bond[] = [];
  private angles: AngleInfo[] = [];
  private onAtomClick: ((index: number | null) => void) | null = null;

  private animationId: number | null = null;
  private showLabels = false;
  private labelObjects: CSS2DObject[] = [];
  private angleMeshes: THREE.Line[] = [];

  // Isosurface meshes for orbital/density visualization
  private orbitalMeshPositive: THREE.Mesh | null = null;
  private orbitalMeshNegative: THREE.Mesh | null = null;
  private densityMesh: THREE.Mesh | null = null;

  // Normal mode animation
  private normalModeId: number | null = null;
  private basePositions: number[] | null = null;
  private modeDisplacement: number[] | null = null;

  // Theme state
  private isDark = true;
  private bondColor = 0x888888;
  private labelBg = "rgba(0,0,0,0.65)";

  constructor(private container: HTMLElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x1a1a2e, 1);
    container.appendChild(this.renderer.domElement);

    // CSS2D label renderer — overlays HTML on top of WebGL
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0";
    this.labelRenderer.domElement.style.left = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(this.labelRenderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);

    // Controls — TrackballControls allows unconstrained 3-axis rotation
    this.controls = new TrackballControls(this.camera, this.renderer.domElement);
    this.controls.rotateSpeed = 3.0;
    this.controls.zoomSpeed = 1.5;
    this.controls.panSpeed = 0.8;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 100;

    // Lights — key + fill attached to camera; low ambient for depth
    const ambient = new THREE.AmbientLight(0x404040, 1.0);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(3, 4, 5);
    this.camera.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-4, -2, 3);
    this.camera.add(fill);

    this.scene.add(this.camera);

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Events
    this.renderer.domElement.addEventListener("click", this.handleClick);
    window.addEventListener("resize", this.handleResize);

    // Start render loop
    this.animate();
  }

  setOnAtomClick(callback: (index: number | null) => void) {
    this.onAtomClick = callback;
  }

  setShowLabels(show: boolean) {
    this.showLabels = show;
    if (show) {
      this.rebuildLabels();
    } else {
      this.clearLabels();
    }
  }

  setTheme(isDark: boolean) {
    this.isDark = isDark;
    this.renderer.setClearColor(isDark ? 0x1a1a2e : 0xf0f4f8, 1);
    this.bondColor = isDark ? 0x888888 : 0x9ca3af;
    this.labelBg = isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.85)";
    // Update existing bond material color
    if (this.bondMesh) {
      (this.bondMesh.material as THREE.MeshPhongMaterial).color.setHex(this.bondColor);
    }
    // Rebuild labels with new background color
    if (this.showLabels) {
      this.rebuildLabels();
    }
  }

  setMolecule(atoms: Atom[], bonds: Bond[]) {
    this.atoms = atoms;
    this.bonds = bonds;
    this.buildAngles();
    this.rebuildMeshes();
    this.fitCamera();
    if (this.showLabels) this.rebuildLabels();
  }

  updatePositions(positions: number[]) {
    if (!this.atomMesh || this.atoms.length === 0) return;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.atoms.length; i++) {
      this.atoms[i].position = [
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      ];

      const radius = ATOM_RADII[this.atoms[i].atomic_number] ?? DEFAULT_RADIUS;
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      this.atomMesh.setMatrixAt(i, dummy.matrix);
    }
    this.atomMesh.instanceMatrix.needsUpdate = true;

    // Rebuild bonds
    this.rebuildBonds();
    if (this.showLabels) this.rebuildLabels();
  }

  highlightAtom(index: number | null) {
    if (this.selectionRing) {
      this.scene.remove(this.selectionRing);
      this.selectionRing.geometry.dispose();
      (this.selectionRing.material as THREE.Material).dispose();
      this.selectionRing = null;
    }

    if (index !== null && index < this.atoms.length) {
      const atom = this.atoms[index];
      const radius = (ATOM_RADII[atom.atomic_number] ?? DEFAULT_RADIUS) + 0.08;
      const geometry = new THREE.RingGeometry(radius * 0.9, radius * 1.1, 32);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      this.selectionRing = new THREE.Mesh(geometry, material);
      this.selectionRing.position.set(...atom.position);
      this.selectionRing.lookAt(this.camera.position);
      this.scene.add(this.selectionRing);
    }
  }

  // ======== Orbital / Density Isosurfaces ========

  setOrbitalData(data: VolumetricData, isovalue: number) {
    this.clearOrbitalMeshes();

    const rawBytes = Uint8Array.from(atob(data.data_base64), (c) => c.charCodeAt(0));
    const values = new Float32Array(rawBytes.buffer);

    // Positive lobe (blue)
    const posResult = marchingCubes(values, data.nx, data.ny, data.nz, data.origin, data.extent, isovalue);
    if (posResult.positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(posResult.positions, 3));
      geom.setAttribute("normal", new THREE.BufferAttribute(posResult.normals, 3));
      const mat = new THREE.MeshPhongMaterial({
        color: 0x4488ff, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, shininess: 40,
      });
      this.orbitalMeshPositive = new THREE.Mesh(geom, mat);
      this.scene.add(this.orbitalMeshPositive);
    }

    // Negative lobe (red)
    const negResult = marchingCubes(values, data.nx, data.ny, data.nz, data.origin, data.extent, -isovalue);
    if (negResult.positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(negResult.positions, 3));
      geom.setAttribute("normal", new THREE.BufferAttribute(negResult.normals, 3));
      const mat = new THREE.MeshPhongMaterial({
        color: 0xff4444, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, shininess: 40,
      });
      this.orbitalMeshNegative = new THREE.Mesh(geom, mat);
      this.scene.add(this.orbitalMeshNegative);
    }
  }

  clearOrbitalMeshes() {
    if (this.orbitalMeshPositive) {
      this.scene.remove(this.orbitalMeshPositive);
      this.orbitalMeshPositive.geometry.dispose();
      (this.orbitalMeshPositive.material as THREE.Material).dispose();
      this.orbitalMeshPositive = null;
    }
    if (this.orbitalMeshNegative) {
      this.scene.remove(this.orbitalMeshNegative);
      this.orbitalMeshNegative.geometry.dispose();
      (this.orbitalMeshNegative.material as THREE.Material).dispose();
      this.orbitalMeshNegative = null;
    }
  }

  setDensityData(data: VolumetricData, isovalue: number) {
    this.clearDensityMesh();

    const rawBytes = Uint8Array.from(atob(data.data_base64), (c) => c.charCodeAt(0));
    const values = new Float32Array(rawBytes.buffer);

    const result = marchingCubes(values, data.nx, data.ny, data.nz, data.origin, data.extent, isovalue);
    if (result.positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(result.positions, 3));
      geom.setAttribute("normal", new THREE.BufferAttribute(result.normals, 3));
      const mat = new THREE.MeshPhongMaterial({
        color: 0x22ccaa, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, shininess: 30,
      });
      this.densityMesh = new THREE.Mesh(geom, mat);
      this.scene.add(this.densityMesh);
    }
  }

  clearDensityMesh() {
    if (this.densityMesh) {
      this.scene.remove(this.densityMesh);
      this.densityMesh.geometry.dispose();
      (this.densityMesh.material as THREE.Material).dispose();
      this.densityMesh = null;
    }
  }

  // ======== Normal Mode Animation ========

  animateNormalMode(basePositions: number[], displacement: number[], amplitude: number = 0.5) {
    this.stopNormalMode();
    this.basePositions = basePositions;
    this.modeDisplacement = displacement;

    const startTime = performance.now();
    const period = 1000; // ms for one full cycle

    const step = () => {
      const t = (performance.now() - startTime) / period;
      const phase = Math.sin(t * 2 * Math.PI);
      const positions: number[] = [];
      for (let i = 0; i < basePositions.length; i++) {
        positions.push(basePositions[i] + amplitude * phase * displacement[i]);
      }
      this.updatePositions(positions);
      this.normalModeId = requestAnimationFrame(step);
    };

    this.normalModeId = requestAnimationFrame(step);
  }

  stopNormalMode() {
    if (this.normalModeId !== null) {
      cancelAnimationFrame(this.normalModeId);
      this.normalModeId = null;
    }
    // Restore base positions
    if (this.basePositions) {
      this.updatePositions(this.basePositions);
      this.basePositions = null;
      this.modeDisplacement = null;
    }
  }

  dispose() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.stopNormalMode();
    this.renderer.domElement.removeEventListener("click", this.handleClick);
    window.removeEventListener("resize", this.handleResize);
    this.clearLabels();
    this.clearOrbitalMeshes();
    this.clearDensityMesh();
    this.clearMeshes();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.container.removeChild(this.labelRenderer.domElement);
  }

  // Private methods

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    if (this.selectionRing) {
      this.selectionRing.lookAt(this.camera.position);
    }
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  private rebuildMeshes() {
    this.clearMeshes();
    if (this.atoms.length === 0) return;

    // Atoms - InstancedMesh
    const sphereGeom = new THREE.SphereGeometry(1, 24, 16);
    const atomMaterial = new THREE.MeshPhongMaterial({ shininess: 80 });
    this.atomMesh = new THREE.InstancedMesh(sphereGeom, atomMaterial, this.atoms.length);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < this.atoms.length; i++) {
      const atom = this.atoms[i];
      const radius = ATOM_RADII[atom.atomic_number] ?? DEFAULT_RADIUS;
      const cpk = CPK_COLORS[atom.atomic_number] ?? DEFAULT_COLOR;

      dummy.position.set(...atom.position);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      this.atomMesh.setMatrixAt(i, dummy.matrix);
      this.atomMesh.setColorAt(i, color.setRGB(cpk[0], cpk[1], cpk[2]));
    }

    this.atomMesh.instanceMatrix.needsUpdate = true;
    if (this.atomMesh.instanceColor) this.atomMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.atomMesh);

    // Bonds
    this.rebuildBonds();
  }

  private rebuildBonds() {
    // Remove old bond mesh
    if (this.bondMesh) {
      this.scene.remove(this.bondMesh);
      this.bondMesh.geometry.dispose();
      (this.bondMesh.material as THREE.Material).dispose();
      this.bondMesh = null;
    }

    if (this.bonds.length === 0) return;

    const cylGeom = new THREE.CylinderGeometry(BOND_RADIUS, BOND_RADIUS, 1, 8);
    const bondMaterial = new THREE.MeshPhongMaterial({
      color: this.bondColor,
      shininess: 40,
    });
    this.bondMesh = new THREE.InstancedMesh(cylGeom, bondMaterial, this.bonds.length);

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < this.bonds.length; i++) {
      const bond = this.bonds[i];
      const a1 = this.atoms[bond.atom_i];
      const a2 = this.atoms[bond.atom_j];

      const start = new THREE.Vector3(...a1.position);
      const end = new THREE.Vector3(...a2.position);
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();

      dummy.position.copy(mid);
      dummy.scale.set(1, length, 1);

      // Align cylinder with bond direction
      const quat = new THREE.Quaternion();
      quat.setFromUnitVectors(up, direction.normalize());
      dummy.quaternion.copy(quat);

      dummy.updateMatrix();
      this.bondMesh.setMatrixAt(i, dummy.matrix);
    }

    this.bondMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.bondMesh);
  }

  private clearMeshes() {
    if (this.atomMesh) {
      this.scene.remove(this.atomMesh);
      this.atomMesh.geometry.dispose();
      (this.atomMesh.material as THREE.Material).dispose();
      this.atomMesh = null;
    }
    if (this.bondMesh) {
      this.scene.remove(this.bondMesh);
      this.bondMesh.geometry.dispose();
      (this.bondMesh.material as THREE.Material).dispose();
      this.bondMesh = null;
    }
    if (this.selectionRing) {
      this.scene.remove(this.selectionRing);
      this.selectionRing.geometry.dispose();
      (this.selectionRing.material as THREE.Material).dispose();
      this.selectionRing = null;
    }
  }

  private fitCamera() {
    if (this.atoms.length === 0) return;

    const box = new THREE.Box3();
    for (const atom of this.atoms) {
      box.expandByPoint(new THREE.Vector3(...atom.position));
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2 + 3;

    // Position camera off-axis so orbit rotation works visually on all axes
    this.camera.position.set(
      center.x + distance * 0.5,
      center.y + distance * 0.35,
      center.z + distance * 0.8
    );
    this.controls.target.copy(center);
    this.controls.update();
  }

  private handleClick = (event: MouseEvent) => {
    if (!this.atomMesh || !this.onAtomClick) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.atomMesh);

    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      this.onAtomClick(intersects[0].instanceId);
    } else {
      this.onAtomClick(null);
    }
  };

  private handleResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.controls.handleResize();
  };

  // ======== Labels (bond lengths + angles) ========

  private buildAngles() {
    this.angles = [];
    const adj: number[][] = this.atoms.map(() => []);
    for (const b of this.bonds) {
      adj[b.atom_i].push(b.atom_j);
      adj[b.atom_j].push(b.atom_i);
    }
    for (let j = 0; j < this.atoms.length; j++) {
      const nbrs = adj[j];
      for (let a = 0; a < nbrs.length; a++) {
        for (let b = a + 1; b < nbrs.length; b++) {
          this.angles.push({ i: nbrs[a], j, k: nbrs[b] });
        }
      }
    }
  }

  private makeLabel(text: string, color: string): HTMLDivElement {
    const div = document.createElement("div");
    div.textContent = text;
    div.style.cssText = `
      font-size: 11px;
      font-family: ui-monospace, monospace;
      color: ${color};
      background: ${this.labelBg};
      padding: 1px 4px;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
    `;
    return div;
  }

  private clearLabels() {
    for (const obj of this.labelObjects) {
      this.scene.remove(obj);
    }
    this.labelObjects = [];
    for (const line of this.angleMeshes) {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.angleMeshes = [];
  }

  private rebuildLabels() {
    this.clearLabels();
    if (this.atoms.length === 0) return;

    // Bond length labels — positioned at bond midpoint, offset slightly
    for (const bond of this.bonds) {
      const a1 = this.atoms[bond.atom_i];
      const a2 = this.atoms[bond.atom_j];
      const p1 = new THREE.Vector3(...a1.position);
      const p2 = new THREE.Vector3(...a2.position);
      const length = p1.distanceTo(p2);

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      // Offset label slightly perpendicular to bond so it doesn't overlap
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const offset = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.15);
      mid.add(offset);

      const div = this.makeLabel(`${length.toFixed(3)} A`, "#60a5fa");
      const label = new CSS2DObject(div);
      label.position.copy(mid);
      this.scene.add(label);
      this.labelObjects.push(label);
    }

    // Angle labels — positioned near the central atom with an arc
    for (const ang of this.angles) {
      const pi = new THREE.Vector3(...this.atoms[ang.i].position);
      const pj = new THREE.Vector3(...this.atoms[ang.j].position);
      const pk = new THREE.Vector3(...this.atoms[ang.k].position);

      const v1 = new THREE.Vector3().subVectors(pi, pj).normalize();
      const v2 = new THREE.Vector3().subVectors(pk, pj).normalize();
      const dot = Math.max(-1, Math.min(1, v1.dot(v2)));
      const angle = (Math.acos(dot) * 180) / Math.PI;

      // Draw a small arc
      const arcRadius = 0.45;
      const segments = 16;
      const points: THREE.Vector3[] = [];
      const axis = new THREE.Vector3().crossVectors(v1, v2).normalize();
      // If vectors are parallel, skip arc
      if (axis.length() > 0.001) {
        const startAngle = 0;
        const endAngle = Math.acos(dot);
        for (let s = 0; s <= segments; s++) {
          const t = startAngle + (s / segments) * (endAngle - startAngle);
          const pt = v1
            .clone()
            .applyAxisAngle(axis, t)
            .multiplyScalar(arcRadius)
            .add(pj);
          points.push(pt);
        }
        const arcGeom = new THREE.BufferGeometry().setFromPoints(points);
        const arcMat = new THREE.LineBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.7,
        });
        const arcLine = new THREE.Line(arcGeom, arcMat);
        this.scene.add(arcLine);
        this.angleMeshes.push(arcLine);
      }

      // Label at midpoint of arc
      const midDir = new THREE.Vector3().addVectors(v1, v2).normalize();
      const labelPos = pj.clone().add(midDir.multiplyScalar(arcRadius + 0.2));

      const div = this.makeLabel(`${angle.toFixed(1)}°`, "#fbbf24");
      const label = new CSS2DObject(div);
      label.position.copy(labelPos);
      this.scene.add(label);
      this.labelObjects.push(label);
    }
  }
}
