import type { Position } from "./core";

export const XIANGQI_FILES = "abcdefghi";
export const XIANGQI_ROWS = 10;
export const XIANGQI_COLS = 9;

/**
 * The Xiangqi board renderer places logical row 0 at rank 1 and logical row 9
 * at rank 10. Red starts on logical row 9, which is also the near side of the
 * original white/red camera in the adapted 9×10 scene.
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
  return `${XIANGQI_FILES[position.col]}${position.row + 1}`;
}

export function squareToPosition(square: string): Position | null {
  const col = XIANGQI_FILES.indexOf(square[0] ?? "");
  const rank = Number.parseInt(square.slice(1), 10);
  if (!Number.isInteger(rank) || rank < 1 || rank > XIANGQI_ROWS || col < 0) return null;
  return { row: rank - 1, col };
}
