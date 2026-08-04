import { describe, expect, it } from "vitest";
import { positionToSquare, squareToPosition, XIANGQI_COLS, XIANGQI_ROWS } from "./coordinates";

describe("中国象棋场景坐标", () => {
  it("红方本营映射到原引擎 rank 1，黑方本营映射到 rank 10", () => {
    expect(positionToSquare({ row: 9, col: 0 })).toBe("a1");
    expect(positionToSquare({ row: 9, col: 8 })).toBe("i1");
    expect(positionToSquare({ row: 0, col: 0 })).toBe("a10");
    expect(positionToSquare({ row: 0, col: 8 })).toBe("i10");
  });

  it("全部九十个交点均能无损往返", () => {
    for (let row = 0; row < XIANGQI_ROWS; row += 1) {
      for (let col = 0; col < XIANGQI_COLS; col += 1) {
        const position = { row, col };
        expect(squareToPosition(positionToSquare(position))).toEqual(position);
      }
    }
  });

  it("拒绝越界和不完整坐标", () => {
    expect(squareToPosition("a0")).toBeNull();
    expect(squareToPosition("a11")).toBeNull();
    expect(squareToPosition("j1")).toBeNull();
    expect(squareToPosition("a")).toBeNull();
  });
});
