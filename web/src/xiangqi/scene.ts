import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  COLS,
  PIECE_LABELS,
  ROWS,
  type GameState,
  type Move,
  type Piece,
  type Position,
} from "./core";

const CELL = 1.05;
const BOARD_WIDTH = (COLS - 1) * CELL;
const BOARD_DEPTH = (ROWS - 1) * CELL;
const PIECE_Y = 0.31;

interface PieceView {
  group: THREE.Group;
  target: THREE.Vector3;
  captured: boolean;
}

function boardPoint(position: Position): THREE.Vector3 {
  return new THREE.Vector3(
    (position.col - (COLS - 1) / 2) * CELL,
    PIECE_Y,
    (position.row - (ROWS - 1) / 2) * CELL,
  );
}

function roundedCanvasTexture(
  text: string,
  foreground: string,
  border: string,
  background = "rgba(250,235,198,0.98)",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.clearRect(0, 0, 256, 256);
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.lineWidth = 15;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.font = "bold 118px 'Noto Serif SC', 'Songti SC', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = foreground;
  ctx.fillText(text, 128, 132);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function labelPlane(text: string, color: string, border: string, size = 0.72): THREE.Mesh {
  const texture = roundedCanvasTexture(text, color, border);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.23;
  return plane;
}

function addLine(
  group: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  material: THREE.Material,
  thickness = 0.025,
) {
  const length = from.distanceTo(to);
  const geometry = new THREE.BoxGeometry(thickness, 0.018, length);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.position.y = 0.17;
  mesh.lookAt(to.x, mesh.position.y, to.z);
  group.add(mesh);
}

export class XiangqiScene {
  private readonly container: HTMLElement;
  private readonly onCell: (position: Position) => void;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly pieceViews = new Map<string, PieceView>();
  private readonly highlightGroup = new THREE.Group();
  private readonly interactivePlane: THREE.Mesh;
  private readonly clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private pointerDown = { x: 0, y: 0 };
  private disposed = false;
  private redPerspective = true;

  constructor(container: HTMLElement, onCell: (position: Position) => void) {
    this.container = container;
    this.onCell = onCell;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x15100c);
    this.scene.fog = new THREE.FogExp2(0x15100c, 0.035);
    this.camera.position.set(0, 10.5, 11.5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.target.set(0, 0, 0);

    this.interactivePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_WIDTH + CELL, BOARD_DEPTH + CELL),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.interactivePlane.rotation.x = -Math.PI / 2;
    this.interactivePlane.position.y = 0.2;
    this.interactivePlane.name = "board-hit-plane";

    this.buildEnvironment();
    this.buildBoard();
    this.scene.add(this.interactivePlane, this.highlightGroup);

    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  private buildEnvironment() {
    const hemisphere = new THREE.HemisphereLight(0xffedd0, 0x34251c, 2.3);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xffd59b, 4.2);
    key.position.set(-6, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    this.scene.add(key);

    const rim = new THREE.PointLight(0xb24324, 35, 24, 2);
    rim.position.set(7, 4, -7);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 64),
      new THREE.MeshStandardMaterial({ color: 0x211913, roughness: 0.92, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.34;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8.5, 0.025, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x8d5f34, transparent: true, opacity: 0.55 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.31;
    this.scene.add(ring);
  }

  private buildBoard() {
    const board = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_WIDTH + 1.25, 0.46, BOARD_DEPTH + 1.25),
      new THREE.MeshStandardMaterial({ color: 0x8d5a2f, roughness: 0.76, metalness: 0.02 }),
    );
    base.position.y = -0.08;
    base.castShadow = true;
    base.receiveShadow = true;
    board.add(base);

    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_WIDTH + 0.62, 0.13, BOARD_DEPTH + 0.62),
      new THREE.MeshStandardMaterial({ color: 0xd4a35d, roughness: 0.84 }),
    );
    inset.position.y = 0.11;
    inset.receiveShadow = true;
    board.add(inset);

    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2314, roughness: 0.7 });
    for (let row = 0; row < ROWS; row += 1) {
      addLine(board, boardPoint({ row, col: 0 }), boardPoint({ row, col: COLS - 1 }), lineMaterial);
    }
    for (let col = 0; col < COLS; col += 1) {
      if (col === 0 || col === COLS - 1) {
        addLine(board, boardPoint({ row: 0, col }), boardPoint({ row: ROWS - 1, col }), lineMaterial);
      } else {
        addLine(board, boardPoint({ row: 0, col }), boardPoint({ row: 4, col }), lineMaterial);
        addLine(board, boardPoint({ row: 5, col }), boardPoint({ row: ROWS - 1, col }), lineMaterial);
      }
    }
    addLine(board, boardPoint({ row: 0, col: 3 }), boardPoint({ row: 2, col: 5 }), lineMaterial);
    addLine(board, boardPoint({ row: 0, col: 5 }), boardPoint({ row: 2, col: 3 }), lineMaterial);
    addLine(board, boardPoint({ row: 7, col: 3 }), boardPoint({ row: 9, col: 5 }), lineMaterial);
    addLine(board, boardPoint({ row: 7, col: 5 }), boardPoint({ row: 9, col: 3 }), lineMaterial);

    const riverLeft = labelPlane("楚河", "#4a2b18", "#8c633f", 1.85);
    riverLeft.position.set(-2.15, 0.18, 0);
    riverLeft.scale.set(1.35, 0.62, 1);
    board.add(riverLeft);
    const riverRight = labelPlane("汉界", "#4a2b18", "#8c633f", 1.85);
    riverRight.position.set(2.15, 0.18, 0);
    riverRight.scale.set(1.35, 0.62, 1);
    board.add(riverRight);

    this.scene.add(board);
  }

  private createPiece(piece: Piece): PieceView {
    const group = new THREE.Group();
    group.userData.pieceId = piece.id;
    const red = piece.color === "red";
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: red ? 0xbab09c : 0x2b2925,
      roughness: 0.42,
      metalness: 0.12,
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: red ? 0xd7c9ad : 0x5a5248,
      roughness: 0.34,
      metalness: 0.28,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.24, 48), [edgeMaterial, bodyMaterial, bodyMaterial]);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.pieceId = piece.id;
    group.add(body);
    const label = labelPlane(
      PIECE_LABELS[piece.color][piece.type],
      red ? "#aa1d1d" : "#191713",
      red ? "#a94831" : "#686055",
      0.78,
    );
    label.userData.pieceId = piece.id;
    group.add(label);
    group.position.copy(boardPoint(piece));
    this.scene.add(group);
    return { group, target: group.position.clone(), captured: false };
  }

  update(state: GameState, selectedPieceId: string | null, legalMoves: Move[]) {
    const liveIds = new Set(state.pieces.map((piece) => piece.id));
    for (const [id, view] of this.pieceViews) {
      if (!liveIds.has(id) && !view.captured) {
        view.captured = true;
        view.target.y = 1.1;
      }
    }

    for (const piece of state.pieces) {
      let view = this.pieceViews.get(piece.id);
      if (!view) {
        view = this.createPiece(piece);
        this.pieceViews.set(piece.id, view);
      }
      view.target.copy(boardPoint(piece));
      view.captured = false;
      const selected = selectedPieceId === piece.id;
      view.group.scale.setScalar(selected ? 1.13 : 1);
      view.group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
          object.material.emissive.set(selected ? 0x5f351d : 0x000000);
          object.material.emissiveIntensity = selected ? 0.45 : 0;
        }
      });
    }

    this.highlightGroup.clear();
    for (const move of legalMoves) {
      const capture = Boolean(move.capturedId);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(capture ? 0.26 : 0.13, capture ? 0.39 : 0.22, 40),
        new THREE.MeshBasicMaterial({
          color: capture ? 0xe34f35 : 0xf4c66e,
          transparent: true,
          opacity: capture ? 0.82 : 0.68,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(boardPoint(move.to));
      ring.position.y = 0.205;
      this.highlightGroup.add(ring);
    }

    if (state.lastMove) {
      for (const position of [state.lastMove.from, state.lastMove.to]) {
        const mark = new THREE.Mesh(
          new THREE.RingGeometry(0.34, 0.39, 40),
          new THREE.MeshBasicMaterial({ color: 0x6fd5c6, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
        );
        mark.rotation.x = -Math.PI / 2;
        mark.position.copy(boardPoint(position));
        mark.position.y = 0.202;
        this.highlightGroup.add(mark);
      }
    }
  }

  flip() {
    this.redPerspective = !this.redPerspective;
    const target = this.redPerspective ? new THREE.Vector3(0, 10.5, 11.5) : new THREE.Vector3(0, 10.5, -11.5);
    this.camera.position.copy(target);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  overhead() {
    this.camera.position.set(0, 15.5, 0.01);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private resize = () => {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private handlePointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private handlePointerUp = (event: PointerEvent) => {
    const moved = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y);
    if (moved > 7) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects([this.interactivePlane, ...this.scene.children], true);
    const hit = intersections.find((intersection) => intersection.object.userData.pieceId || intersection.object === this.interactivePlane);
    if (!hit) return;
    if (hit.object.userData.pieceId) {
      const view = this.pieceViews.get(hit.object.userData.pieceId as string);
      if (view) {
        const x = Math.round(view.target.x / CELL + (COLS - 1) / 2);
        const row = Math.round(view.target.z / CELL + (ROWS - 1) / 2);
        this.onCell({ row, col: x });
        return;
      }
    }
    const point = hit.point;
    const col = Math.round(point.x / CELL + (COLS - 1) / 2);
    const row = Math.round(point.z / CELL + (ROWS - 1) / 2);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) this.onCell({ row, col });
  };

  private animate = () => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.controls.update();
    for (const [id, view] of this.pieceViews) {
      if (view.captured) {
        view.group.rotation.y += delta * 5;
        view.group.scale.multiplyScalar(Math.max(0.01, 1 - delta * 4.8));
        view.group.position.lerp(view.target, 1 - Math.exp(-delta * 5));
        if (view.group.scale.x < 0.035) {
          this.scene.remove(view.group);
          view.group.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => {
                if (material instanceof THREE.MeshBasicMaterial && material.map) material.map.dispose();
                material.dispose();
              });
            }
          });
          this.pieceViews.delete(id);
        }
      } else {
        view.group.position.lerp(view.target, 1 - Math.exp(-delta * 10));
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.controls.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
