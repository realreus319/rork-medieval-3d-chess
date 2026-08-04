import { describe, expect, it } from "vitest";
import {
  allLegalMoves,
  createInitialState,
  isInCheck,
  legalMovesForPiece,
  playMove,
  type GameState,
  type Piece,
} from "./core";

function stateWith(pieces: Piece[], turn: GameState["turn"] = "red"): GameState {
  return {
    pieces,
    turn,
    winner: null,
    check: false,
    moveNumber: 1,
    lastMove: null,
  };
}

describe("中国象棋规则", () => {
  it("初始化 32 枚棋子并由红方先行", () => {
    const state = createInitialState();
    expect(state.pieces).toHaveLength(32);
    expect(state.turn).toBe("red");
    expect(allLegalMoves(state).length).toBeGreaterThan(0);
  });

  it("马腿被挡时不能走对应日字", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 4 },
      { id: "horse", color: "red", type: "horse", row: 7, col: 4 },
      { id: "leg", color: "red", type: "soldier", row: 6, col: 4 },
      { id: "screen", color: "red", type: "soldier", row: 5, col: 4 },
    ]);
    const targets = legalMovesForPiece(state, "horse").map((move) => `${move.to.row},${move.to.col}`);
    expect(targets).not.toContain("5,3");
    expect(targets).not.toContain("5,5");
  });

  it("炮吃子必须隔一个炮架", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 4 },
      { id: "cannon", color: "red", type: "cannon", row: 7, col: 1 },
      { id: "screen", color: "red", type: "soldier", row: 5, col: 1 },
      { id: "target", color: "black", type: "rook", row: 3, col: 1 },
      { id: "file-block", color: "red", type: "soldier", row: 4, col: 4 },
    ]);
    const capture = legalMovesForPiece(state, "cannon").find((move) => move.capturedId === "target");
    expect(capture?.to).toEqual({ row: 3, col: 1 });
  });

  it("相不能过河且象眼可被堵塞", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 4 },
      { id: "elephant", color: "red", type: "elephant", row: 7, col: 2 },
      { id: "eye", color: "red", type: "soldier", row: 6, col: 3 },
      { id: "file-block", color: "red", type: "soldier", row: 4, col: 4 },
    ]);
    const targets = legalMovesForPiece(state, "elephant").map((move) => `${move.to.row},${move.to.col}`);
    expect(targets).not.toContain("5,4");
    expect(targets.every((target) => Number(target.split(",")[0]) >= 5)).toBe(true);
  });

  it("将帅照面时处于将军状态", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 4 },
    ]);
    expect(isInCheck(state, "red")).toBe(true);
    expect(isInCheck(state, "black")).toBe(true);
  });

  it("不能走出令己方被将军的着法", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 3 },
      { id: "black-rook", color: "black", type: "rook", row: 3, col: 4 },
      { id: "red-rook", color: "red", type: "rook", row: 6, col: 4 },
    ]);
    const illegalSideMove = legalMovesForPiece(state, "red-rook").find(
      (move) => move.to.row === 6 && move.to.col === 5,
    );
    expect(illegalSideMove).toBeUndefined();
  });

  it("吃掉将后立即判胜", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 4 },
      { id: "red-rook", color: "red", type: "rook", row: 1, col: 4 },
    ]);
    const move = legalMovesForPiece(state, "red-rook").find((candidate) => candidate.capturedId === "black-general");
    expect(move).toBeDefined();
    expect(playMove(state, move!).winner).toBe("red");
  });
});
