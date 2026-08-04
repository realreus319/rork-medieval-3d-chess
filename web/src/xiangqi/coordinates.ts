import type { Position } from "./core";

export const XIANGQI_FILES = "abcdefghi";
export const XIANGQI_ROWS = 10;
export const XIANGQI_COLS = 9;

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
  const row = Number.parseInt(square.slice(1), 10) - 1;
  if (!Number.isInteger(row) || row < 0 || row >= XIANGQI_ROWS || col < 0) return null;
  return { row, col };
}
