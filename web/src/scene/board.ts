import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type { SquareId } from "../core/types";
import { XIANGQI_COLS, XIANGQI_FILES, XIANGQI_ROWS, squareToPosition } from "../xiangqi/coordinates";
import type { ArenaLook } from "./arena";

export const TILE = 1.02;
export const BOARD_TOP = 0;

export type HighlightKind =
  | "select"
  | "move"
  | "capture"
  | "castle"
  | "promote"
  | "last"
  | "check"
  | "hint";

const HIGHLIGHT_COLORS: Record<HighlightKind, number> = {
  select: 0xffc95e,
  move: 0x5cf2a4,
  capture: 0xff5a44,
  castle: 0x63b8ff,
  promote: 0xc784ff,
  last: 0xd9a441,
  check: 0xff3b30,
  hint: 0x6aa9ff,
};

interface HighlightSlot {
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  kind: HighlightKind | null;
  age: number;
  delay: number;
  pulse: boolean;
}

interface ShroudSlot {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  current: number;
  target: number;
  delay: number;
}

interface TileMotion {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  age: number;
  duration: number;
  strength: number;
  phase: number;
}

interface TransientRing {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  duration: number;
  strength: number;
}

const BOARD_WIDTH = (XIANGQI_COLS - 1) * TILE;
const BOARD_DEPTH = (XIANGQI_ROWS - 1) * TILE;

export function squareToWorld(square: SquareId, y = BOARD_TOP): THREE.Vector3 {
  const position = squareToPosition(square);
  if (!position) return new THREE.Vector3(0, y, 0);
  return new THREE.Vector3(
    (position.col - (XIANGQI_COLS - 1) / 2) * TILE,
    y,
    (position.row - (XIANGQI_ROWS - 1) / 2) * TILE,
  );
}

export function worldToSquare(x: number, z: number): SquareId | null {
  const col = Math.round(x / TILE + (XIANGQI_COLS - 1) / 2);
  const row = Math.round(z / TILE + (XIANGQI_ROWS - 1) / 2);
  if (col < 0 || col >= XIANGQI_COLS || row < 0 || row >= XIANGQI_ROWS) return null;
  return `${XIANGQI_FILES[col]}${row + 1}`;
}

export function isLightSquare(square: SquareId): boolean {
  const position = squareToPosition(square);
  return position ? (position.col + position.row) % 2 === 0 : false;
}

function lineBetween(from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material, thickness = 0.026): THREE.Mesh {
  const length = from.distanceTo(to);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, 0.018, length), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.position.y = BOARD_TOP + 0.025;
  mesh.lookAt(to.x, mesh.position.y, to.z);
  return mesh;
}

function textTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "700 88px 'Noto Serif SC', 'Songti SC', serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(63,36,18,0.92)";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** 9x10 Xiangqi board using the original game's stone, bronze and pooled effects. */
export class BoardView {
  readonly group = new THREE.Group();
  readonly tiles: THREE.Mesh[] = [];

  private lightTileMaterial: THREE.MeshPhysicalMaterial;
  private darkTileMaterial: THREE.MeshPhysicalMaterial;
  private baseMaterial: THREE.MeshStandardMaterial;
  private borderMaterial: THREE.MeshStandardMaterial;
  private trimMaterial: THREE.MeshStandardMaterial;
  private gridMaterial: THREE.MeshStandardMaterial;
  private highlightSlots = new Map<SquareId, HighlightSlot>();
  private shrouds = new Map<SquareId, ShroudSlot>();
  private tileBySquare = new Map<SquareId, THREE.Mesh>();
  private motions: TileMotion[] = [];
  private transients: TransientRing[] = [];
  private hoverRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private disposables: { dispose: () => void }[] = [];
  private elapsed = 0;

  constructor() {
    this.group.name = "xiangqi-board";
    this.lightTileMaterial = this.track(new THREE.MeshPhysicalMaterial({ color: 0xd8c6a0, roughness: 0.28, metalness: 0.08, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.9 }));
    this.darkTileMaterial = this.track(new THREE.MeshPhysicalMaterial({ color: 0x4b3b2d, roughness: 0.38, metalness: 0.16, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.75 }));
    this.baseMaterial = this.track(new THREE.MeshStandardMaterial({ color: 0x3b342b, roughness: 0.72, metalness: 0.24 }));
    this.borderMaterial = this.track(new THREE.MeshStandardMaterial({ color: 0xbfae8e, roughness: 0.5, metalness: 0.48, envMapIntensity: 1.1 }));
    this.trimMaterial = this.track(new THREE.MeshStandardMaterial({ color: 0x8a6a33, roughness: 0.28, metalness: 0.95, emissive: 0x2a1a06, emissiveIntensity: 0.35, envMapIntensity: 1.4 }));
    this.gridMaterial = this.track(new THREE.MeshStandardMaterial({ color: 0x3a2415, roughness: 0.62, metalness: 0.32, emissive: 0x160b04, emissiveIntensity: 0.14 }));

    this.buildBase();
    this.buildTiles();
    this.buildGrid();
    this.buildHighlights();
    this.buildShrouds();

    const hoverMaterial = this.track(new THREE.MeshBasicMaterial({ color: 0xffd88a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.hoverRing = new THREE.Mesh(this.track(new THREE.RingGeometry(TILE * 0.28, TILE * 0.38, 40)), hoverMaterial);
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.position.y = BOARD_TOP + 0.035;
    this.hoverRing.visible = false;
    this.hoverRing.renderOrder = 8;
    this.group.add(this.hoverRing);
  }

  private track<T extends { dispose: () => void }>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private buildBase(): void {
    const sizeX = BOARD_WIDTH + TILE * 1.65;
    const sizeZ = BOARD_DEPTH + TILE * 1.65;
    const base = new THREE.Mesh(
      this.track(new RoundedBoxGeometry(sizeX, 0.64, sizeZ, 4, 0.1)),
      [this.baseMaterial, this.baseMaterial, this.borderMaterial, this.baseMaterial, this.baseMaterial, this.baseMaterial],
    );
    base.position.y = -0.43;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    const trim = new THREE.Mesh(this.track(new RoundedBoxGeometry(sizeX + 0.18, 0.14, sizeZ + 0.18, 3, 0.06)), this.trimMaterial);
    trim.position.y = -0.71;
    trim.castShadow = true;
    this.group.add(trim);

    const riverMaterial = this.track(new THREE.MeshPhysicalMaterial({ color: 0x8b6a42, roughness: 0.6, metalness: 0.1, clearcoat: 0.28 }));
    const river = new THREE.Mesh(this.track(new RoundedBoxGeometry(BOARD_WIDTH + TILE * 0.74, 0.08, TILE * 0.74, 2, 0.04)), riverMaterial);
    river.position.set(0, -0.035, 0);
    river.receiveShadow = true;
    this.group.add(river);
    this.addRiverLabel("楚河", -2.25);
    this.addRiverLabel("汉界", 2.25);
  }

  private addRiverLabel(text: string, x: number): void {
    const texture = this.track(textTexture(text));
    const material = this.track(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    const mesh = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2.35, 0.72)), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, BOARD_TOP + 0.017, 0);
    mesh.renderOrder = 3;
    this.group.add(mesh);
  }

  private buildTiles(): void {
    const geometry = this.track(new RoundedBoxGeometry(TILE * 0.82, 0.18, TILE * 0.82, 3, 0.045));
    for (let row = 0; row < XIANGQI_ROWS; row += 1) {
      for (let col = 0; col < XIANGQI_COLS; col += 1) {
        const square = `${XIANGQI_FILES[col]}${row + 1}`;
        const tile = new THREE.Mesh(geometry, isLightSquare(square) ? this.lightTileMaterial : this.darkTileMaterial);
        const home = squareToWorld(square, -0.09);
        tile.position.copy(home);
        tile.receiveShadow = true;
        tile.userData.square = square;
        tile.userData.home = home.clone();
        this.tiles.push(tile);
        this.tileBySquare.set(square, tile);
        this.group.add(tile);
      }
    }
  }

  private addGridLine(from: SquareId, to: SquareId): void {
    const line = lineBetween(squareToWorld(from), squareToWorld(to), this.gridMaterial);
    this.disposables.push(line.geometry);
    this.group.add(line);
  }

  private buildGrid(): void {
    for (let row = 1; row <= XIANGQI_ROWS; row += 1) this.addGridLine(`a${row}`, `i${row}`);
    for (let col = 0; col < XIANGQI_COLS; col += 1) {
      const file = XIANGQI_FILES[col];
      if (col === 0 || col === XIANGQI_COLS - 1) this.addGridLine(`${file}1`, `${file}10`);
      else {
        this.addGridLine(`${file}1`, `${file}5`);
        this.addGridLine(`${file}6`, `${file}10`);
      }
    }
    this.addGridLine("d1", "f3");
    this.addGridLine("f1", "d3");
    this.addGridLine("d8", "f10");
    this.addGridLine("f8", "d10");
  }

  private buildHighlights(): void {
    const ringGeometry = this.track(new THREE.RingGeometry(TILE * 0.22, TILE * 0.37, 42));
    const glowGeometry = this.track(new THREE.CircleGeometry(TILE * 0.4, 42));
    const beamGeometry = this.track(new THREE.CylinderGeometry(TILE * 0.32, TILE * 0.38, 0.65, 24, 1, true));
    for (let row = 0; row < XIANGQI_ROWS; row += 1) {
      for (let col = 0; col < XIANGQI_COLS; col += 1) {
        const square = `${XIANGQI_FILES[col]}${row + 1}`;
        const ringMaterial = this.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(squareToWorld(square, BOARD_TOP + 0.045));
        ring.visible = false;
        ring.renderOrder = 7;
        this.group.add(ring);

        const glowMaterial = this.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.rotation.x = -Math.PI / 2;
        glow.position.copy(squareToWorld(square, BOARD_TOP + 0.028));
        glow.visible = false;
        glow.renderOrder = 5;
        this.group.add(glow);

        const beamMaterial = this.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.copy(squareToWorld(square, BOARD_TOP + 0.34));
        beam.visible = false;
        beam.renderOrder = 6;
        this.group.add(beam);
        this.highlightSlots.set(square, { ring, glow, beam, kind: null, age: 0, delay: 0, pulse: false });
      }
    }
  }

  private buildShrouds(): void {
    const geometry = this.track(new THREE.PlaneGeometry(TILE * 0.86, TILE * 0.86));
    for (let row = 0; row < XIANGQI_ROWS; row += 1) {
      for (let col = 0; col < XIANGQI_COLS; col += 1) {
        const square = `${XIANGQI_FILES[col]}${row + 1}`;
        const material = this.track(new THREE.MeshBasicMaterial({ color: 0x080604, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(squareToWorld(square, BOARD_TOP + 0.022));
        mesh.visible = false;
        mesh.renderOrder = 4;
        this.group.add(mesh);
        this.shrouds.set(square, { mesh, current: 0, target: 0, delay: 0 });
      }
    }
  }

  setHighlight(square: SquareId, kind: HighlightKind, pulse = false, delay = 0): void {
    const slot = this.highlightSlots.get(square);
    if (!slot) return;
    slot.kind = kind;
    slot.age = 0;
    slot.delay = delay;
    slot.pulse = pulse;
    const color = HIGHLIGHT_COLORS[kind];
    slot.ring.material.color.setHex(color);
    slot.glow.material.color.setHex(color);
    slot.beam.material.color.setHex(color);
    slot.ring.visible = true;
    slot.glow.visible = true;
    slot.beam.visible = kind !== "last";
  }

  clearHighlights(): void {
    for (const slot of this.highlightSlots.values()) {
      slot.kind = null;
      slot.ring.visible = false;
      slot.glow.visible = false;
      slot.beam.visible = false;
      slot.ring.material.opacity = 0;
      slot.glow.material.opacity = 0;
      slot.beam.material.opacity = 0;
    }
  }

  setHover(square: SquareId | null): void {
    if (!square) {
      this.hoverRing.visible = false;
      this.hoverRing.material.opacity = 0;
      return;
    }
    this.hoverRing.position.copy(squareToWorld(square, BOARD_TOP + 0.052));
    this.hoverRing.visible = true;
  }

  setShroud(allowed: SquareId[] | null, origin?: SquareId): void {
    const allowedSet = allowed ? new Set(allowed) : null;
    const originPoint = origin ? squareToWorld(origin) : null;
    for (const [square, slot] of this.shrouds) {
      slot.target = allowedSet && !allowedSet.has(square) ? 0.58 : 0;
      slot.delay = originPoint ? Math.min(0.16, squareToWorld(square).distanceTo(originPoint) * 0.018) : 0;
      if (slot.target > 0) slot.mesh.visible = true;
    }
  }

  impact(square: SquareId, color: number, strength: number): void {
    this.jolt(square, strength, 0.62);
    this.spawnTransient(square, color, Math.min(1.8, strength * 1.15), 0.52);
  }

  land(square: SquareId, color: number, strength: number): void {
    this.jolt(square, strength * 0.45, 0.4);
    this.spawnTransient(square, color, Math.min(1.4, strength), 0.42);
  }

  private jolt(square: SquareId, strength: number, duration: number): void {
    const mesh = this.tileBySquare.get(square);
    if (!mesh) return;
    const existing = this.motions.find((motion) => motion.mesh === mesh);
    if (existing) {
      existing.age = 0;
      existing.strength = Math.max(existing.strength, strength);
      return;
    }
    this.motions.push({ mesh, home: (mesh.userData.home as THREE.Vector3).clone(), age: 0, duration, strength, phase: Math.random() * Math.PI * 2 });
  }

  private spawnTransient(square: SquareId, color: number, strength: number, duration: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(TILE * 0.14, TILE * 0.22, 48), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(squareToWorld(square, BOARD_TOP + 0.06));
    mesh.renderOrder = 9;
    this.group.add(mesh);
    this.transients.push({ mesh, age: 0, duration, strength });
  }

  update(delta: number): void {
    this.elapsed += delta;
    for (const slot of this.highlightSlots.values()) {
      if (!slot.kind) continue;
      slot.age += delta;
      if (slot.age < slot.delay) continue;
      const t = Math.min(1, (slot.age - slot.delay) / 0.24);
      const pulse = slot.pulse ? 0.78 + Math.sin(this.elapsed * 4.2) * 0.22 : 1;
      const base = slot.kind === "last" ? 0.3 : slot.kind === "capture" || slot.kind === "check" ? 0.92 : 0.72;
      slot.ring.material.opacity = base * t * pulse;
      slot.glow.material.opacity = base * 0.28 * t * pulse;
      slot.beam.material.opacity = slot.kind === "last" ? 0 : base * 0.14 * t * pulse;
      slot.ring.rotation.z += delta * (slot.kind === "capture" ? -0.7 : 0.35);
      const scale = 0.82 + t * 0.18 + (slot.pulse ? Math.sin(this.elapsed * 3.6) * 0.035 : 0);
      slot.ring.scale.setScalar(scale);
      slot.glow.scale.setScalar(scale);
    }
    if (this.hoverRing.visible) {
      this.hoverRing.material.opacity = 0.35 + Math.sin(this.elapsed * 5) * 0.12;
      this.hoverRing.rotation.z += delta * 0.45;
    }
    for (const slot of this.shrouds.values()) {
      if (slot.delay > 0) {
        slot.delay = Math.max(0, slot.delay - delta);
        continue;
      }
      slot.current += (slot.target - slot.current) * (1 - Math.exp(-delta * 10));
      slot.mesh.material.opacity = slot.current;
      slot.mesh.visible = slot.current > 0.01;
    }
    for (let index = this.motions.length - 1; index >= 0; index -= 1) {
      const motion = this.motions[index];
      motion.age += delta;
      const t = Math.min(1, motion.age / motion.duration);
      const envelope = 1 - t;
      motion.mesh.position.copy(motion.home);
      motion.mesh.position.y += Math.sin(t * Math.PI * 5 + motion.phase) * 0.075 * motion.strength * envelope;
      motion.mesh.rotation.x = Math.sin(t * Math.PI * 4 + motion.phase) * 0.018 * motion.strength * envelope;
      motion.mesh.rotation.z = Math.cos(t * Math.PI * 4 + motion.phase) * 0.018 * motion.strength * envelope;
      if (t >= 1) {
        motion.mesh.position.copy(motion.home);
        motion.mesh.rotation.set(0, 0, 0);
        this.motions.splice(index, 1);
      }
    }
    for (let index = this.transients.length - 1; index >= 0; index -= 1) {
      const transient = this.transients[index];
      transient.age += delta;
      const t = Math.min(1, transient.age / transient.duration);
      transient.mesh.scale.setScalar(1 + t * (2.5 + transient.strength * 0.65));
      transient.mesh.material.opacity = (1 - t) * 0.85;
      if (t >= 1) {
        this.group.remove(transient.mesh);
        transient.mesh.geometry.dispose();
        transient.mesh.material.dispose();
        this.transients.splice(index, 1);
      }
    }
  }

  applyArena(look: ArenaLook): void {
    this.lightTileMaterial.color.setHex(look.board.light).lerp(new THREE.Color(0xd8c6a0), 0.24);
    this.darkTileMaterial.color.setHex(look.board.dark).lerp(new THREE.Color(0x4b3b2d), 0.18);
    this.baseMaterial.color.setHex(look.board.base);
    this.borderMaterial.color.setHex(look.board.border);
    this.trimMaterial.color.setHex(look.board.trim);
    this.gridMaterial.color.setHex(look.board.trim).multiplyScalar(0.42);
  }

  dispose(): void {
    for (const transient of this.transients) {
      transient.mesh.geometry.dispose();
      transient.mesh.material.dispose();
    }
    this.transients = [];
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables = [];
    this.group.clear();
    this.tiles.length = 0;
    this.highlightSlots.clear();
    this.shrouds.clear();
    this.tileBySquare.clear();
  }
}
