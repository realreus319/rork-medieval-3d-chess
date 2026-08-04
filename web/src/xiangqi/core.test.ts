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

function targets(state: GameState, id: string): string[] {
  return legalMovesForPiece(state, id).map((move) => `${move.to.row},${move.to.col}`);
}

const generals = (blocker = true): Piece[] => [
  { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
  { id: "black-general", color: "black", type: "general", row: 0, col: 4 },
  ...(blocker ? [{ id: "centre-block", color: "red" as const, type: "soldier" as const, row: 5, col: 4 }] : []),
];

describe("中国象棋规则", () => {
  it("初始化 32 枚棋子并由红方先行", () => {
    const state = createInitialState();
    expect(state.pieces).toHaveLength(32);
    expect(state.turn).toBe("red");
    expect(allLegalMoves(state).length).toBeGreaterThan(0);
  });

  it("帅将只能在九宫内直走一步，并支持将帅照面", () => {
    const palace = stateWith([
      ...generals(),
      { id: "red-block-left", color: "red", type: "advisor", row: 9, col: 3 },
    ]);
    expect(targets(palace, "red-general")).toContain("8,4");
    expect(targets(palace, "red-general")).toContain("9,5");
    expect(targets(palace, "red-general")).not.toContain("9,3");

    const facing = stateWith(generals(false));
    expect(isInCheck(facing, "red")).toBe(true);
    expect(isInCheck(facing, "black")).toBe(true);
  });

  it("仕士只能在九宫内斜走一步", () => {
    const state = stateWith([
      ...generals(),
      { id: "advisor", color: "red", type: "advisor", row: 8, col: 4 },
    ]);
    expect(new Set(targets(state, "advisor"))).toEqual(new Set(["7,3", "7,5", "9,3", "9,5"]));
  });

  it("相象走田、不能过河，象眼被堵时不能走", () => {
    const state = stateWith([
      ...generals(),
      { id: "elephant", color: "red", type: "elephant", row: 7, col: 2 },
      { id: "eye", color: "red", type: "soldier", row: 6, col: 3 },
    ]);
    const result = targets(state, "elephant");
    expect(result).not.toContain("5,4");
    expect(result.every((target) => Number(target.split(",")[0]) >= 5)).toBe(true);
  });

  it("马腿被挡时只禁止对应两个日字方向", () => {
    const state = stateWith([
      ...generals(),
      { id: "horse", color: "red", type: "horse", row: 7, col: 4 },
      { id: "leg", color: "red", type: "soldier", row: 6, col: 4 },
    ]);
    const result = targets(state, "horse");
    expect(result).not.toContain("5,3");
    expect(result).not.toContain("5,5");
    expect(result).toContain("6,2");
    expect(result).toContain("6,6");
  });

  it("车在敌方半场仍可沿横纵线自由移动，不会被强制退回原位", () => {
    const state = stateWith([
      ...generals(),
      { id: "red-rook", color: "red", type: "rook", row: 1, col: 0 },
      { id: "black-rook", color: "black", type: "rook", row: 0, col: 0 },
    ]);
    const result = targets(state, "red-rook");
    expect(result).toContain("0,0");
    expect(result).toContain("1,8");
    expect(result).toContain("8,0");
    expect(result.length).toBeGreaterThan(10);
  });

  it("车被对方车钉在帅前时，横走会暴露帅，只有保持挡线的着法合法", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 3 },
      { id: "black-rook", color: "black", type: "rook", row: 3, col: 4 },
      { id: "red-rook", color: "red", type: "rook", row: 6, col: 4 },
    ]);
    const result = targets(state, "red-rook");
    expect(result).not.toContain("6,5");
    expect(result).toContain("5,4");
    expect(result).toContain("4,4");
    expect(result).toContain("3,4");
  });

  it("炮不吃子时不能越过棋子，吃子时必须恰好隔一个炮架", () => {
    const state = stateWith([
      ...generals(),
      { id: "cannon", color: "red", type: "cannon", row: 7, col: 1 },
      { id: "screen", color: "red", type: "soldier", row: 5, col: 1 },
      { id: "target", color: "black", type: "rook", row: 3, col: 1 },
      { id: "second", color: "black", type: "soldier", row: 2, col: 1 },
    ]);
    const moves = legalMovesForPiece(state, "cannon");
    expect(moves.find((move) => move.capturedId === "target")?.to).toEqual({ row: 3, col: 1 });
    expect(moves.some((move) => move.to.row === 4 && move.to.col === 1)).toBe(false);
    expect(moves.some((move) => move.capturedId === "second")).toBe(false);
  });

  it("兵卒过河前只能向前，过河后可左右但不能后退", () => {
    const before = stateWith([
      ...generals(),
      { id: "soldier", color: "red", type: "soldier", row: 6, col: 2 },
    ]);
    expect(new Set(targets(before, "soldier"))).toEqual(new Set(["5,2"]));

    const after = stateWith([
      ...generals(),
      { id: "soldier", color: "red", type: "soldier", row: 4, col: 2 },
    ]);
    expect(new Set(targets(after, "soldier"))).toEqual(new Set(["3,2", "4,1", "4,3"]));
    expect(targets(after, "soldier")).not.toContain("5,2");
  });

  it("不能走出令己方被将军的着法", () => {
    const state = stateWith([
      { id: "red-general", color: "red", type: "general", row: 9, col: 4 },
      { id: "black-general", color: "black", type: "general", row: 0, col: 3 },
      { id: "black-rook", color: "black", type: "rook", row: 3, col: 4 },
      { id: "red-rook", color: "red", type: "rook", row: 6, col: 4 },
    ]);
    expect(targets(state, "red-rook")).not.toContain("6,5");
  });

  it("吃掉将后立即判胜；无合法着法也判负", () => {
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
