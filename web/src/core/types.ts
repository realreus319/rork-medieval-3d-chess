/**
 * Shared, render-agnostic game types.
 * The chess core never imports anything from `src/scene` — the scene subscribes to it.
 */

export type Faction = "w" | "b";

/** Original cinematic engine archetypes. Xiangqi elephant uses a runtime visual marker. */
export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";

export type SquareId = string;
export type Difficulty = "easy" | "medium" | "hard";
export type GameMode = "ai" | "hotseat" | "attract" | "demo";

export interface DemoOptions {
  white: Difficulty;
  black: Difficulty;
  speed: number;
  autoRematch: boolean;
}

export type GameStatus = "idle" | "playing" | "over";
export type EndReason = "checkmate" | "stalemate" | "resignation" | "timeout" | "threefold" | "insufficient" | "fiftymove" | "draw";

export interface GameResult {
  winner: Faction | null;
  reason: EndReason;
}

export interface ClockState {
  enabled: boolean;
  initialMs: number;
  whiteMs: number;
  blackMs: number;
}

export interface CapturedPiece {
  kind: PieceKind;
  color: Faction;
}

export interface HistoryRow {
  number: number;
  white: string | null;
  black: string | null;
}

export interface LedgerMove {
  ply: number;
  number: number;
  color: Faction;
  kind: PieceKind;
  san: string;
  from: SquareId;
  to: SquareId;
  capture: boolean;
  castle: boolean;
  promotion: PieceKind | null;
  check: boolean;
  mate: boolean;
}

export interface GameSnapshot {
  status: GameStatus;
  mode: GameMode;
  difficulty: Difficulty;
  playerColor: Faction;
  turn: Faction;
  fen: string;
  pgn: string;
  inCheck: boolean;
  thinking: boolean;
  busy: boolean;
  result: GameResult | null;
  history: HistoryRow[];
  sanList: string[];
  moves: LedgerMove[];
  captured: CapturedPiece[];
  materialDiff: number;
  lastMove: { from: SquareId; to: SquareId } | null;
  clock: ClockState;
  canUndo: boolean;
  demo: DemoOptions | null;
  paused: boolean;
  demoRound: number;
}

export interface MoveEvent {
  color: Faction;
  kind: PieceKind;
  from: SquareId;
  to: SquareId;
  san: string;
  capture: { square: SquareId; kind: PieceKind; color: Faction } | null;
  rook: { from: SquareId; to: SquareId } | null;
  promotion: PieceKind | null;
  isCheck: boolean;
  isGameOver: boolean;
}

export type Animator = (event: MoveEvent) => Promise<void>;

export const PIECE_VALUE: Record<PieceKind, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const PIECE_LABEL: Record<PieceKind, string> = {
  p: "Soldier",
  n: "Horse",
  b: "Advisor",
  r: "Chariot",
  q: "Cannon",
  k: "General",
};
