import {
  PIECE_VALUES,
  allLegalMoves,
  playMove,
  type Color,
  type GameState,
  type Move,
  type Piece,
} from "./core";

function positionalBonus(piece: Piece): number {
  const center = 4 - Math.abs(piece.col - 4);
  switch (piece.type) {
    case "soldier": {
      const advance = piece.color === "red" ? 9 - piece.row : piece.row;
      return advance * 8 + center * 3;
    }
    case "horse":
    case "cannon":
      return center * 5;
    case "rook":
      return center * 2;
    default:
      return 0;
  }
}

export function evaluate(state: GameState, perspective: Color): number {
  if (state.winner) return state.winner === perspective ? 1_000_000 : -1_000_000;
  let score = 0;
  for (const piece of state.pieces) {
    const value = PIECE_VALUES[piece.type] + positionalBonus(piece);
    score += piece.color === perspective ? value : -value;
  }
  const myMobility = allLegalMoves(state, perspective).length;
  const enemyMobility = allLegalMoves(state, perspective === "red" ? "black" : "red").length;
  return score + (myMobility - enemyMobility) * 2;
}

function moveOrderScore(state: GameState, move: Move): number {
  if (!move.capturedId) return 0;
  const captured = state.pieces.find((piece) => piece.id === move.capturedId);
  const attacker = state.pieces.find((piece) => piece.id === move.pieceId);
  return captured && attacker ? PIECE_VALUES[captured.type] * 10 - PIECE_VALUES[attacker.type] : 0;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  perspective: Color,
): number {
  if (depth === 0 || state.winner) return evaluate(state, perspective);
  const moves = allLegalMoves(state).sort((a, b) => moveOrderScore(state, b) - moveOrderScore(state, a));
  if (moves.length === 0) return evaluate(state, perspective);

  const maximizing = state.turn === perspective;
  if (maximizing) {
    let value = -Infinity;
    for (const move of moves) {
      value = Math.max(value, minimax(playMove(state, move), depth - 1, alpha, beta, perspective));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of moves) {
    value = Math.min(value, minimax(playMove(state, move), depth - 1, alpha, beta, perspective));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

export function chooseMove(state: GameState, depth: number): Move | null {
  const moves = allLegalMoves(state).sort((a, b) => moveOrderScore(state, b) - moveOrderScore(state, a));
  if (moves.length === 0) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = minimax(playMove(state, move), Math.max(0, depth - 1), -Infinity, Infinity, state.turn);
    if (score > bestScore || (score === bestScore && Math.random() > 0.5)) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}
