import type { Position } from "./core";

export const XIANGQI_FILES = "abcdefghi";
export const XIANGQI_ROWS = 10;
export const XIANGQI_COLS = 9;

/**
 * SceneEngine follows the original chess orientation: faction `w` starts near
 * rank 1. Red maps to `w`, so red's home row (logical row 9) must be rank 1 and
 * black's home row (logical row 0) rank 10.
 */
export function positionToSquare(position: Position): string {
  if (
    position.row < 0 ||
    position.row >= XIANGQI_ROWS ||
    position.col < 0 ||
    position.col >= XIANGQI_COLS
  ) {
    throw new Error(`Invalid Xiangqi position: ${position.row},${position.col}`);
  }
  return `${XIANGQI_FILES[position.col]}${XIANGQI_ROWS - position.row}`;
}

export function squareToPosition(square: string): Position | null {
  const col = XIANGQI_FILES.indexOf(square[0] ?? "");
  const rank = Number.parseInt(square.slice(1), 10);
  const row = XIANGQI_ROWS - rank;
  if (!Number.isInteger(rank) || rank < 1 || rank > XIANGQI_ROWS || col < 0) return null;
  return { row, col };
}
