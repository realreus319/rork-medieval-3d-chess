import { Emitter } from "../core/emitter";
import type {
  Animator,
  CapturedPiece,
  Difficulty,
  Faction,
  GameResult,
  GameSnapshot,
  HistoryRow,
  LedgerMove,
  MoveEvent,
  PieceKind,
  SquareId,
} from "../core/types";
import { XiangqiAiClient } from "./aiClient";
import {
  PIECE_VALUES,
  cloneState,
  createInitialState,
  legalMovesForPiece,
  pieceAt,
  playMove,
  stateKey,
  type Color,
  type GameState,
  type Move,
  type Piece,
  type PieceType,
} from "./core";
import { positionToSquare, squareToPosition } from "./coordinates";

export type CinematicMode = "ai" | "local";
export type CinematicDifficulty = 1 | 2 | 3;

export interface CinematicMatchOptions {
  mode: CinematicMode;
  difficulty: CinematicDifficulty;
  humanColor: Color;
}

export interface CinematicLedgerEntry {
  move: Move;
  color: Color;
  type: PieceType;
  captured: Piece | null;
}

interface ControllerEvents {
  state: GameSnapshot;
  move: MoveEvent;
  check: Faction;
  gameover: GameResult;
  reset: CinematicMatchOptions;
  illegal: { from: SquareId; to: SquareId };
}

const VISUAL_KIND: Record<PieceType, PieceKind> = {
  general: "k",
  advisor: "b",
  elephant: "r",
  horse: "n",
  rook: "r",
  cannon: "q",
  soldier: "p",
};

const COLOR_TO_FACTION: Record<Color, Faction> = { red: "w", black: "b" };
const FACTION_TO_COLOR: Record<Faction, Color> = { w: "red", b: "black" };
const INITIAL_PIECES = createInitialState().pieces;

function difficultyName(level: CinematicDifficulty): Difficulty {
  return level === 1 ? "easy" : level === 2 ? "medium" : "hard";
}

function visualKind(type: PieceType): PieceKind {
  return VISUAL_KIND[type];
}

function notation(entry: CinematicLedgerEntry): string {
  return `${positionToSquare(entry.move.from)}-${positionToSquare(entry.move.to)}`;
}

function cloneMove(move: Move): Move {
  return {
    ...move,
    from: { ...move.from },
    to: { ...move.to },
  };
}

function cloneLedger(entry: CinematicLedgerEntry): CinematicLedgerEntry {
  return {
    move: cloneMove(entry.move),
    color: entry.color,
    type: entry.type,
    captured: entry.captured ? { ...entry.captured } : null,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Xiangqi rules controller with the same runtime contract consumed by the
 * original cinematic SceneEngine. The renderer still receives its six visual
 * archetypes; the actual seven Xiangqi roles remain in the rules state.
 */
export class CinematicXiangqiController extends Emitter<ControllerEvents> {
  private state: GameState = createInitialState();
  private history: GameState[] = [];
  private ledger: CinematicLedgerEntry[] = [];
  private options: CinematicMatchOptions = { mode: "ai", difficulty: 2, humanColor: "red" };
  private status: GameSnapshot["status"] = "idle";
  private result: GameResult | null = null;
  private thinking = false;
  private busy = false;
  private generation = 0;
  private animator: Animator | null = null;
  private ai = new XiangqiAiClient();
  private snapshot: GameSnapshot = this.buildSnapshot();

  setAnimator(animator: Animator | null): void {
    this.animator = animator;
  }

  start(options: CinematicMatchOptions): void {
    this.generation += 1;
    this.ai.cancel();
    this.options = { ...options };
    this.state = createInitialState();
    this.history = [];
    this.ledger = [];
    this.status = "playing";
    this.result = null;
    this.thinking = false;
    this.busy = false;
    this.emit("reset", { ...this.options });
    this.publish();
    void this.maybeRunAi();
  }

  stop(): void {
    this.generation += 1;
    this.ai.cancel();
    this.status = "idle";
    this.thinking = false;
    this.busy = false;
    this.publish();
  }

  getSnapshot(): GameSnapshot {
    return this.snapshot;
  }

  getGameState(): GameState {
    return cloneState(this.state);
  }

  getLedger(): CinematicLedgerEntry[] {
    return this.ledger.map(cloneLedger);
  }

  getBoard(): { square: SquareId; kind: PieceKind; color: Faction }[] {
    return this.state.pieces.map((piece) => ({
      square: positionToSquare(piece),
      kind: visualKind(piece.type),
      color: COLOR_TO_FACTION[piece.color],
    }));
  }

  legalTargets(from: SquareId): { to: SquareId; capture: boolean; castle: boolean; promotion: boolean }[] {
    const position = squareToPosition(from);
    if (!position) return [];
    const piece = pieceAt(this.state, position);
    if (!piece) return [];
    return legalMovesForPiece(this.state, piece.id).map((move) => ({
      to: positionToSquare(move.to),
      capture: Boolean(move.capturedId),
      castle: false,
      promotion: false,
    }));
  }

  isPromotion(): boolean {
    return false;
  }

  pieceAt(square: SquareId): { kind: PieceKind; color: Faction } | null {
    const position = squareToPosition(square);
    if (!position) return null;
    const piece = pieceAt(this.state, position);
    return piece ? { kind: visualKind(piece.type), color: COLOR_TO_FACTION[piece.color] } : null;
  }

  isHumanTurn(): boolean {
    if (this.status !== "playing" || this.busy || this.thinking || this.state.winner) return false;
    return this.options.mode === "local" || this.state.turn === this.options.humanColor;
  }

  async tryMove(from: SquareId, to: SquareId): Promise<boolean> {
    if (!this.isHumanTurn()) return false;
    const source = squareToPosition(from);
    const target = squareToPosition(to);
    if (!source || !target) return false;
    const piece = pieceAt(this.state, source);
    if (!piece || piece.color !== this.state.turn) return false;
    const move = legalMovesForPiece(this.state, piece.id).find(
      (candidate) => candidate.to.row === target.row && candidate.to.col === target.col,
    );
    if (!move) {
      this.emit("illegal", { from, to });
      return false;
    }
    await this.commit(move);
    return true;
  }

  undo(): boolean {
    if (this.busy) return false;
    const minimum = this.options.mode === "local" ? 1 : this.options.humanColor === "black" ? 3 : 2;
    if (this.history.length < minimum) return false;

    this.generation += 1;
    this.ai.cancel();
    this.thinking = false;
    this.status = "playing";
    this.result = null;

    const targetIndex = this.options.mode === "local" ? this.history.length - 1 : this.history.length - 2;
    this.state = cloneState(this.history[targetIndex]);
    this.history = this.history.slice(0, targetIndex);
    this.ledger = this.ledger.slice(0, targetIndex);
    this.emit("reset", { ...this.options });
    this.publish();
    return true;
  }

  resign(): void {
    if (this.status !== "playing") return;
    const loser = this.options.mode === "ai" ? this.options.humanColor : this.state.turn;
    const winner: Color = loser === "red" ? "black" : "red";
    this.state = { ...this.state, winner };
    this.finish(winner);
  }

  private async commit(move: Move): Promise<void> {
    const generation = this.generation;
    const current = this.state;
    const mover = current.pieces.find((piece) => piece.id === move.pieceId);
    if (!mover) return;
    const captured = move.capturedId
      ? current.pieces.find((piece) => piece.id === move.capturedId) ?? null
      : pieceAt(current, move.to) ?? null;
    const next = playMove(current, move);
    if (next === current) return;

    const from = positionToSquare(move.from);
    const to = positionToSquare(move.to);
    const event: MoveEvent = {
      color: COLOR_TO_FACTION[mover.color],
      kind: visualKind(mover.type),
      from,
      to,
      san: `${from}-${to}`,
      capture: captured
        ? {
            square: to,
            kind: visualKind(captured.type),
            color: COLOR_TO_FACTION[captured.color],
          }
        : null,
      rook: null,
      promotion: null,
      isCheck: next.check,
      isGameOver: Boolean(next.winner),
    };

    this.busy = true;
    this.history.push(cloneState(current));
    this.ledger.push({ move: cloneMove(next.lastMove ?? move), color: mover.color, type: mover.type, captured });
    this.state = next;
    this.publish();
    this.emit("move", event);
    if (next.check) this.emit("check", COLOR_TO_FACTION[next.turn]);

    if (this.animator) {
      try {
        await this.animator(event);
      } catch (error) {
        console.error("[xiangqi] cinematic animator failed", error);
      }
    }
    if (generation !== this.generation) return;

    this.busy = false;
    if (next.winner) {
      this.finish(next.winner);
      return;
    }
    this.publish();
    void this.maybeRunAi();
  }

  private finish(winner: Color): void {
    this.generation += 1;
    this.ai.cancel();
    this.status = "over";
    this.thinking = false;
    this.busy = false;
    this.result = { winner: COLOR_TO_FACTION[winner], reason: "checkmate" };
    this.publish();
    this.emit("gameover", this.result);
  }

  private async maybeRunAi(): Promise<void> {
    if (
      this.status !== "playing" ||
      this.options.mode !== "ai" ||
      this.state.turn === this.options.humanColor ||
      this.state.winner ||
      this.thinking ||
      this.busy
    ) {
      return;
    }

    const generation = this.generation;
    this.thinking = true;
    this.publish();
    const started = performance.now();
    const move = await this.ai.choose(this.state, this.options.difficulty);
    const elapsed = performance.now() - started;
    if (elapsed < 420) await wait(420 - elapsed);
    if (generation !== this.generation || this.status !== "playing") return;
    this.thinking = false;
    if (!move) {
      this.publish();
      return;
    }
    await this.commit(move);
  }

  private buildSnapshot(): GameSnapshot {
    const sanList = this.ledger.map(notation);
    const history: HistoryRow[] = [];
    for (let index = 0; index < sanList.length; index += 2) {
      history.push({
        number: index / 2 + 1,
        white: sanList[index] ?? null,
        black: sanList[index + 1] ?? null,
      });
    }

    const moves: LedgerMove[] = this.ledger.map((entry, index) => ({
      ply: index,
      number: Math.floor(index / 2) + 1,
      color: COLOR_TO_FACTION[entry.color],
      kind: visualKind(entry.type),
      san: notation(entry),
      from: positionToSquare(entry.move.from),
      to: positionToSquare(entry.move.to),
      capture: Boolean(entry.captured),
      castle: false,
      promotion: null,
      check: index === this.ledger.length - 1 && this.state.check,
      mate: index === this.ledger.length - 1 && Boolean(this.state.winner),
    }));

    const liveIds = new Set(this.state.pieces.map((piece) => piece.id));
    const missing = INITIAL_PIECES.filter((piece) => !liveIds.has(piece.id));
    const captured: CapturedPiece[] = missing.map((piece) => ({
      kind: visualKind(piece.type),
      color: COLOR_TO_FACTION[piece.color],
    }));

    let materialDiff = 0;
    for (const piece of this.state.pieces) {
      const value = PIECE_VALUES[piece.type] / 100;
      materialDiff += piece.color === "red" ? value : -value;
    }

    const lastMove = this.state.lastMove
      ? { from: positionToSquare(this.state.lastMove.from), to: positionToSquare(this.state.lastMove.to) }
      : null;
    const canUndo =
      !this.busy &&
      !this.thinking &&
      (this.options.mode === "local"
        ? this.history.length >= 1
        : this.history.length >= (this.options.humanColor === "black" ? 3 : 2));

    return {
      status: this.status,
      mode: this.options.mode === "local" ? "hotseat" : "ai",
      difficulty: difficultyName(this.options.difficulty),
      playerColor: COLOR_TO_FACTION[this.options.humanColor],
      turn: COLOR_TO_FACTION[this.state.turn],
      fen: stateKey(this.state),
      pgn: sanList.join(" "),
      inCheck: this.state.check,
      thinking: this.thinking,
      busy: this.busy,
      result: this.result,
      history,
      sanList,
      moves,
      captured,
      materialDiff,
      lastMove,
      clock: { enabled: false, initialMs: 0, whiteMs: 0, blackMs: 0 },
      canUndo,
      demo: null,
      paused: false,
      demoRound: 1,
    };
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    this.emit("state", this.snapshot);
  }

  dispose(): void {
    this.generation += 1;
    this.ai.dispose();
    this.clear();
  }
}

export function factionToColor(faction: Faction): Color {
  return FACTION_TO_COLOR[faction];
}
