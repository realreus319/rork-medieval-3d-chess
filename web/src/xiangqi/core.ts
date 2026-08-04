export type Color = "red" | "black";
export type PieceType =
  | "general"
  | "advisor"
  | "elephant"
  | "horse"
  | "rook"
  | "cannon"
  | "soldier";

export interface Position {
  row: number;
  col: number;
}

export interface Piece extends Position {
  id: string;
  color: Color;
  type: PieceType;
}

export interface Move {
  pieceId: string;
  from: Position;
  to: Position;
  capturedId?: string;
}

export interface GameState {
  pieces: Piece[];
  turn: Color;
  winner: Color | null;
  check: boolean;
  moveNumber: number;
  lastMove: Move | null;
}

export const ROWS = 10;
export const COLS = 9;

export const PIECE_LABELS: Record<Color, Record<PieceType, string>> = {
  red: {
    general: "帅",
    advisor: "仕",
    elephant: "相",
    horse: "马",
    rook: "车",
    cannon: "炮",
    soldier: "兵",
  },
  black: {
    general: "将",
    advisor: "士",
    elephant: "象",
    horse: "马",
    rook: "车",
    cannon: "砲",
    soldier: "卒",
  },
};

export const PIECE_VALUES: Record<PieceType, number> = {
  general: 100000,
  rook: 900,
  cannon: 480,
  horse: 430,
  elephant: 220,
  advisor: 220,
  soldier: 100,
};

const backRank: PieceType[] = [
  "rook",
  "horse",
  "elephant",
  "advisor",
  "general",
  "advisor",
  "elephant",
  "horse",
  "rook",
];

const opposite = (color: Color): Color => (color === "red" ? "black" : "red");
const inside = ({ row, col }: Position) => row >= 0 && row < ROWS && col >= 0 && col < COLS;
const samePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

export function createInitialState(): GameState {
  const pieces: Piece[] = [];
  const add = (color: Color, type: PieceType, row: number, col: number, index: number) => {
    pieces.push({ id: `${color}-${type}-${index}`, color, type, row, col });
  };

  backRank.forEach((type, col) => add("black", type, 0, col, col));
  add("black", "cannon", 2, 1, 0);
  add("black", "cannon", 2, 7, 1);
  [0, 2, 4, 6, 8].forEach((col, index) => add("black", "soldier", 3, col, index));

  backRank.forEach((type, col) => add("red", type, 9, col, col));
  add("red", "cannon", 7, 1, 0);
  add("red", "cannon", 7, 7, 1);
  [0, 2, 4, 6, 8].forEach((col, index) => add("red", "soldier", 6, col, index));

  return { pieces, turn: "red", winner: null, check: false, moveNumber: 1, lastMove: null };
}

export function pieceAt(state: GameState, position: Position): Piece | undefined {
  return state.pieces.find((piece) => samePosition(piece, position));
}

function inPalace(color: Color, position: Position): boolean {
  if (position.col < 3 || position.col > 5) return false;
  return color === "red" ? position.row >= 7 && position.row <= 9 : position.row >= 0 && position.row <= 2;
}

function crossedRiver(color: Color, row: number): boolean {
  return color === "red" ? row <= 4 : row >= 5;
}

function pushIfAvailable(state: GameState, piece: Piece, target: Position, moves: Move[]) {
  if (!inside(target)) return;
  const occupant = pieceAt(state, target);
  if (!occupant || occupant.color !== piece.color) {
    moves.push({
      pieceId: piece.id,
      from: { row: piece.row, col: piece.col },
      to: target,
      capturedId: occupant?.id,
    });
  }
}

function slideMoves(state: GameState, piece: Piece, directions: Position[], cannon: boolean): Move[] {
  const moves: Move[] = [];
  for (const direction of directions) {
    let row = piece.row + direction.row;
    let col = piece.col + direction.col;
    let screens = 0;
    while (inside({ row, col })) {
      const occupant = pieceAt(state, { row, col });
      if (!cannon) {
        if (!occupant) {
          moves.push({ pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col } });
        } else {
          if (occupant.color !== piece.color) {
            moves.push({
              pieceId: piece.id,
              from: { row: piece.row, col: piece.col },
              to: { row, col },
              capturedId: occupant.id,
            });
          }
          break;
        }
      } else if (screens === 0) {
        if (!occupant) {
          moves.push({ pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col } });
        } else {
          screens = 1;
        }
      } else if (occupant) {
        if (occupant.color !== piece.color) {
          moves.push({
            pieceId: piece.id,
            from: { row: piece.row, col: piece.col },
            to: { row, col },
            capturedId: occupant.id,
          });
        }
        break;
      }
      row += direction.row;
      col += direction.col;
    }
  }
  return moves;
}

export function pseudoMovesForPiece(state: GameState, piece: Piece): Move[] {
  const moves: Move[] = [];
  const orthogonal = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  switch (piece.type) {
    case "rook":
      return slideMoves(state, piece, orthogonal, false);
    case "cannon":
      return slideMoves(state, piece, orthogonal, true);
    case "general": {
      for (const direction of orthogonal) {
        const target = { row: piece.row + direction.row, col: piece.col + direction.col };
        if (inPalace(piece.color, target)) pushIfAvailable(state, piece, target, moves);
      }
      const enemyGeneral = state.pieces.find(
        (candidate) => candidate.type === "general" && candidate.color !== piece.color,
      );
      if (enemyGeneral && enemyGeneral.col === piece.col) {
        const min = Math.min(piece.row, enemyGeneral.row) + 1;
        const max = Math.max(piece.row, enemyGeneral.row);
        const blocked = state.pieces.some(
          (candidate) => candidate.col === piece.col && candidate.row >= min && candidate.row < max,
        );
        if (!blocked) {
          moves.push({
            pieceId: piece.id,
            from: { row: piece.row, col: piece.col },
            to: { row: enemyGeneral.row, col: enemyGeneral.col },
            capturedId: enemyGeneral.id,
          });
        }
      }
      return moves;
    }
    case "advisor": {
      for (const delta of [
        { row: -1, col: -1 },
        { row: -1, col: 1 },
        { row: 1, col: -1 },
        { row: 1, col: 1 },
      ]) {
        const target = { row: piece.row + delta.row, col: piece.col + delta.col };
        if (inPalace(piece.color, target)) pushIfAvailable(state, piece, target, moves);
      }
      return moves;
    }
    case "elephant": {
      for (const delta of [
        { row: -2, col: -2 },
        { row: -2, col: 2 },
        { row: 2, col: -2 },
        { row: 2, col: 2 },
      ]) {
        const target = { row: piece.row + delta.row, col: piece.col + delta.col };
        const eye = { row: piece.row + delta.row / 2, col: piece.col + delta.col / 2 };
        const staysHome = piece.color === "red" ? target.row >= 5 : target.row <= 4;
        if (inside(target) && staysHome && !pieceAt(state, eye)) pushIfAvailable(state, piece, target, moves);
      }
      return moves;
    }
    case "horse": {
      const patterns = [
        { leg: { row: -1, col: 0 }, target: { row: -2, col: -1 } },
        { leg: { row: -1, col: 0 }, target: { row: -2, col: 1 } },
        { leg: { row: 1, col: 0 }, target: { row: 2, col: -1 } },
        { leg: { row: 1, col: 0 }, target: { row: 2, col: 1 } },
        { leg: { row: 0, col: -1 }, target: { row: -1, col: -2 } },
        { leg: { row: 0, col: -1 }, target: { row: 1, col: -2 } },
        { leg: { row: 0, col: 1 }, target: { row: -1, col: 2 } },
        { leg: { row: 0, col: 1 }, target: { row: 1, col: 2 } },
      ];
      for (const pattern of patterns) {
        const leg = { row: piece.row + pattern.leg.row, col: piece.col + pattern.leg.col };
        if (pieceAt(state, leg)) continue;
        pushIfAvailable(
          state,
          piece,
          { row: piece.row + pattern.target.row, col: piece.col + pattern.target.col },
          moves,
        );
      }
      return moves;
    }
    case "soldier": {
      const forward = piece.color === "red" ? -1 : 1;
      pushIfAvailable(state, piece, { row: piece.row + forward, col: piece.col }, moves);
      if (crossedRiver(piece.color, piece.row)) {
        pushIfAvailable(state, piece, { row: piece.row, col: piece.col - 1 }, moves);
        pushIfAvailable(state, piece, { row: piece.row, col: piece.col + 1 }, moves);
      }
      return moves;
    }
  }
}

function applyUnchecked(state: GameState, move: Move): GameState {
  return {
    ...state,
    pieces: state.pieces
      .filter((piece) => piece.id !== move.capturedId)
      .map((piece) =>
        piece.id === move.pieceId ? { ...piece, row: move.to.row, col: move.to.col } : { ...piece },
      ),
    lastMove: move,
  };
}

export function isInCheck(state: GameState, color: Color): boolean {
  const general = state.pieces.find((piece) => piece.color === color && piece.type === "general");
  if (!general) return true;
  return state.pieces
    .filter((piece) => piece.color !== color)
    .some((piece) => pseudoMovesForPiece(state, piece).some((move) => samePosition(move.to, general)));
}

export function legalMovesForPiece(state: GameState, pieceId: string): Move[] {
  const piece = state.pieces.find((candidate) => candidate.id === pieceId);
  if (!piece) return [];
  return pseudoMovesForPiece(state, piece).filter((move) => !isInCheck(applyUnchecked(state, move), piece.color));
}

export function allLegalMoves(state: GameState, color: Color = state.turn): Move[] {
  return state.pieces
    .filter((piece) => piece.color === color)
    .flatMap((piece) => legalMovesForPiece(state, piece.id));
}

export function playMove(state: GameState, requested: Move): GameState {
  if (state.winner || state.turn !== state.pieces.find((piece) => piece.id === requested.pieceId)?.color) {
    return state;
  }
  const legal = legalMovesForPiece(state, requested.pieceId).find((move) => samePosition(move.to, requested.to));
  if (!legal) return state;

  const mover = state.turn;
  let next = applyUnchecked(state, legal);
  const enemy = opposite(mover);
  const enemyGeneral = next.pieces.find((piece) => piece.color === enemy && piece.type === "general");
  if (!enemyGeneral) {
    return { ...next, winner: mover, check: false, turn: enemy, moveNumber: state.moveNumber + 1 };
  }

  next = { ...next, turn: enemy, moveNumber: state.moveNumber + 1 };
  const check = isInCheck(next, enemy);
  const enemyMoves = allLegalMoves(next, enemy);
  return {
    ...next,
    check,
    winner: enemyMoves.length === 0 ? mover : null,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    pieces: state.pieces.map((piece) => ({ ...piece })),
    lastMove: state.lastMove
      ? {
          ...state.lastMove,
          from: { ...state.lastMove.from },
          to: { ...state.lastMove.to },
        }
      : null,
  };
}

export function stateKey(state: GameState): string {
  return `${state.turn}|${state.pieces
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((piece) => `${piece.id}:${piece.row},${piece.col}`)
    .join("|")}`;
}
