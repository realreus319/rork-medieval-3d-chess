import * as THREE from "three";

import type { Faction, GameSnapshot, MoveEvent, PieceKind, SquareId } from "../core/types";
import { PieceFactory, type PieceView } from "../scene/pieces";
import { CinematicXiangqiController } from "./cinematicController";
import { positionToSquare, squareToPosition } from "./coordinates";
import type { Color, PieceType } from "./core";

/**
 * The original renderer has six internal archetype identifiers. Xiangqi needs a
 * seventh visible role, so `e` is kept as a runtime marker at the adapter edge.
 * It is intercepted before entering the original factory's six-kind tables.
 */
const ELEPHANT_KIND = "e" as unknown as PieceKind;
const PATCH_FLAG = Symbol.for("xiangqi.elephant.visual.patch");

const factionOf = (color: Color): Faction => (color === "red" ? "w" : "b");
const visualKind = (type: PieceType): PieceKind => (type === "elephant" ? ELEPHANT_KIND : ({
  general: "k",
  advisor: "b",
  horse: "n",
  rook: "r",
  cannon: "q",
  soldier: "p",
} as const)[type]);

function patchController(): void {
  const prototype = CinematicXiangqiController.prototype as unknown as Record<PropertyKey, unknown>;
  if (prototype[PATCH_FLAG]) return;
  prototype[PATCH_FLAG] = true;

  const originalGetBoard = CinematicXiangqiController.prototype.getBoard;
  CinematicXiangqiController.prototype.getBoard = function () {
    const elephants = new Set(
      this.getGameState().pieces
        .filter((piece) => piece.type === "elephant")
        .map((piece) => positionToSquare(piece)),
    );
    return originalGetBoard.call(this).map((entry) =>
      elephants.has(entry.square) ? { ...entry, kind: ELEPHANT_KIND } : entry,
    );
  };

  const originalPieceAt = CinematicXiangqiController.prototype.pieceAt;
  CinematicXiangqiController.prototype.pieceAt = function (square: SquareId) {
    const position = squareToPosition(square);
    const piece = position
      ? this.getGameState().pieces.find((candidate) => candidate.row === position.row && candidate.col === position.col)
      : undefined;
    if (piece?.type === "elephant") return { kind: ELEPHANT_KIND, color: factionOf(piece.color) };
    return originalPieceAt.call(this, square);
  };

  const originalSnapshot = CinematicXiangqiController.prototype.getSnapshot;
  CinematicXiangqiController.prototype.getSnapshot = function (): GameSnapshot {
    const snapshot = originalSnapshot.call(this);
    const ledger = this.getLedger();
    return {
      ...snapshot,
      moves: snapshot.moves.map((move, index) => ({
        ...move,
        kind: ledger[index] ? visualKind(ledger[index].type) : move.kind,
      })),
      captured: ledger
        .filter((entry) => entry.captured !== null)
        .map((entry) => ({
          kind: visualKind(entry.captured!.type),
          color: factionOf(entry.captured!.color),
        })),
    };
  };

  const originalSetAnimator = CinematicXiangqiController.prototype.setAnimator;
  CinematicXiangqiController.prototype.setAnimator = function (animator) {
    if (!animator) {
      originalSetAnimator.call(this, null);
      return;
    }
    originalSetAnimator.call(this, async (event: MoveEvent) => {
      const position = squareToPosition(event.to);
      const mover = position
        ? this.getGameState().pieces.find((piece) => piece.row === position.row && piece.col === position.col)
        : undefined;
      const latest = this.getLedger().at(-1);
      await animator({
        ...event,
        kind: mover ? visualKind(mover.type) : event.kind,
        capture: event.capture && latest?.captured
          ? { ...event.capture, kind: visualKind(latest.captured.type) }
          : event.capture,
      });
    });
  };
}

function canvasTexture(color: Faction, tactical: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable for elephant identity");

  const red = color === "w";
  const gradient = ctx.createRadialGradient(105, 82, 12, 128, 128, 112);
  gradient.addColorStop(0, red ? "#f7e7bd" : "#683027");
  gradient.addColorStop(1, red ? "#7f241e" : "#130b0a");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  if (tactical) ctx.arc(128, 128, 105, 0, Math.PI * 2);
  else {
    ctx.moveTo(45, 32);
    ctx.quadraticCurveTo(128, 5, 211, 32);
    ctx.lineTo(211, 135);
    ctx.quadraticCurveTo(205, 208, 128, 240);
    ctx.quadraticCurveTo(51, 208, 45, 135);
    ctx.closePath();
  }
  ctx.fill();
  ctx.strokeStyle = red ? "#e8c56f" : "#ef9a45";
  ctx.lineWidth = 13;
  ctx.stroke();
  ctx.strokeStyle = red ? "#77c7b0" : "#4ecfbb";
  ctx.lineWidth = 5;
  ctx.stroke();

  // Elephant-head silhouette behind the Chinese role name.
  ctx.fillStyle = red ? "rgba(119,199,176,.45)" : "rgba(78,207,187,.38)";
  ctx.beginPath();
  ctx.ellipse(88, 105, 38, 48, -0.18, 0, Math.PI * 2);
  ctx.ellipse(168, 105, 38, 48, 0.18, 0, Math.PI * 2);
  ctx.ellipse(128, 105, 50, 60, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = red ? "#fff0c9" : "#ffd89c";
  ctx.font = `bold ${tactical ? 112 : 104}px "Noto Serif SC", "Songti SC", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,.72)";
  ctx.shadowBlur = 10;
  ctx.fillText(red ? "相" : "象", 128, 132);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

interface ElephantDecoration {
  badge: THREE.Sprite;
  token: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  meshes: THREE.Mesh[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
  badgeEnabled: boolean;
  flat: boolean;
  opacity: number;
}

function decorateElephant(view: PieceView, color: Faction, badgeEnabled: boolean): ElephantDecoration {
  const jade = new THREE.MeshStandardMaterial({
    color: color === "w" ? 0x75c9b0 : 0x32b39a,
    roughness: 0.28,
    metalness: 0.38,
    emissive: color === "w" ? 0x123b35 : 0x0c3b32,
    emissiveIntensity: 0.65,
    transparent: true,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: color === "w" ? 0xe9ca72 : 0xc98334,
    roughness: 0.24,
    metalness: 0.92,
    emissive: 0x2b1804,
    emissiveIntensity: 0.35,
    transparent: true,
  });
  const meshes: THREE.Mesh[] = [];

  // Large jade halo and elephant-mask armour create a silhouette that is
  // visibly different from both the advisor mage and the chariot guardian.
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.03, 12, 36), jade);
  halo.position.set(0, 0.7, -0.1);
  view.visual.add(halo);
  meshes.push(halo);

  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), gold);
  brow.scale.set(1.45, 0.62, 0.58);
  brow.position.set(0, 0.77, 0.11);
  view.visual.add(brow);
  meshes.push(brow);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), jade);
    shoulder.scale.set(1.4, 0.58, 0.9);
    shoulder.position.set(side * 0.21, 0.56, 0);
    view.visual.add(shoulder);
    meshes.push(shoulder);

    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.2, 14), gold);
    tusk.position.set(side * 0.105, 0.63, 0.15);
    tusk.rotation.x = Math.PI * 0.52;
    tusk.rotation.z = side * 0.62;
    view.visual.add(tusk);
    meshes.push(tusk);
  }

  const badgeTexture = canvasTexture(color, false);
  const badgeMaterial = new THREE.SpriteMaterial({
    map: badgeTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const badge = new THREE.Sprite(badgeMaterial);
  badge.scale.setScalar(0.42);
  badge.position.y = 1.22;
  badge.renderOrder = 45;
  badge.visible = badgeEnabled;
  view.container.add(badge);

  const tokenTexture = canvasTexture(color, true);
  const tokenMaterial = new THREE.MeshBasicMaterial({
    map: tokenTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const token = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), tokenMaterial);
  token.rotation.x = -Math.PI / 2;
  token.position.y = 0.085;
  token.renderOrder = 18;
  token.visible = false;
  view.container.add(token);

  return {
    badge,
    token,
    meshes,
    materials: [jade, gold, badgeMaterial, tokenMaterial],
    textures: [badgeTexture, tokenTexture],
    badgeEnabled,
    flat: false,
    opacity: 1,
  };
}

function patchElephantView(view: PieceView, decoration: ElephantDecoration): void {
  const originalBadge = view.setBadgeEnabled.bind(view);
  const originalFlat = view.setFlat.bind(view);
  const originalOpacity = view.setOpacity.bind(view);
  const originalDissolve = view.setDissolve.bind(view);
  const originalDeath = view.playDeath.bind(view);
  const originalReset = view.resetPose.bind(view);
  const originalDispose = view.dispose.bind(view);

  view.setBadgeEnabled = (enabled: boolean): void => {
    decoration.badgeEnabled = enabled;
    originalBadge(false);
    decoration.badge.visible = enabled && !decoration.flat;
  };

  view.setFlat = (enabled: boolean): void => {
    decoration.flat = enabled;
    originalFlat(enabled);
    decoration.badge.visible = decoration.badgeEnabled && !enabled;
    decoration.token.visible = enabled;
  };

  view.setOpacity = (value: number): void => {
    decoration.opacity = value;
    originalOpacity(value);
    for (const material of decoration.materials) {
      material.transparent = value < 1;
      material.opacity = value;
      material.depthWrite = value > 0.6;
    }
  };

  view.setDissolve = (amount: number): void => {
    originalDissolve(amount);
    const opacity = decoration.opacity * (1 - THREE.MathUtils.smoothstep(amount, 0.05, 0.95));
    for (const material of decoration.materials) material.opacity = opacity;
  };

  view.playDeath = (): number => {
    decoration.badge.visible = false;
    return originalDeath();
  };

  view.resetPose = (): void => {
    originalReset();
    for (const material of decoration.materials) material.opacity = decoration.opacity;
    decoration.badge.visible = decoration.badgeEnabled && !decoration.flat;
    decoration.token.visible = decoration.flat;
  };

  view.dispose = (): void => {
    for (const mesh of decoration.meshes) mesh.geometry.dispose();
    decoration.token.geometry.dispose();
    for (const material of decoration.materials) material.dispose();
    for (const texture of decoration.textures) texture.dispose();
    originalDispose();
  };
}

function patchFactory(): void {
  const prototype = PieceFactory.prototype as unknown as Record<PropertyKey, unknown>;
  if (prototype[PATCH_FLAG]) return;
  prototype[PATCH_FLAG] = true;
  const originalCreate = PieceFactory.prototype.create;

  PieceFactory.prototype.create = function (kind, color, options) {
    if (String(kind) !== "e") return originalCreate.call(this, kind, color, options);
    const view = originalCreate.call(this, "b", color, { ...options, rankBadge: false });
    const decoration = decorateElephant(view, color, options.rankBadge !== false);
    patchElephantView(view, decoration);
    return view;
  };
}

patchController();
patchFactory();
