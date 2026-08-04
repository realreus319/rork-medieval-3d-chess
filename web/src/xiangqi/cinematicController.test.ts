import { describe, expect, it, vi } from "vitest";
import "./elephantVisualPatch";
import { CinematicXiangqiController } from "./cinematicController";

describe("CinematicXiangqiController", () => {
  it("exposes the 9×10 Xiangqi position through cinematic archetypes", () => {
    const controller = new CinematicXiangqiController();
    controller.start({ mode: "local", difficulty: 2, humanColor: "red" });

    expect(controller.getBoard()).toHaveLength(32);
    expect(controller.pieceAt("e1")).toEqual({ kind: "k", color: "w" });
    expect(controller.pieceAt("b3")).toEqual({ kind: "q", color: "w" });
    expect(controller.pieceAt("c1")).toEqual({ kind: "e", color: "w" });
    expect(controller.pieceAt("a4")).toEqual({ kind: "p", color: "w" });
    expect(controller.legalTargets("a4")).toContainEqual({
      to: "a5",
      capture: false,
      castle: false,
      promotion: false,
    });

    controller.dispose();
  });

  it("emits a SceneEngine-compatible move and awaits its cinematic animator", async () => {
    const controller = new CinematicXiangqiController();
    const animator = vi.fn(async () => undefined);
    controller.setAnimator(animator);
    controller.start({ mode: "local", difficulty: 2, humanColor: "red" });

    await expect(controller.tryMove("a4", "a5")).resolves.toBe(true);
    expect(animator).toHaveBeenCalledWith(expect.objectContaining({
      color: "w",
      kind: "p",
      from: "a4",
      to: "a5",
      rook: null,
      promotion: null,
    }));
    expect(controller.getSnapshot().lastMove).toEqual({ from: "a4", to: "a5" });
    expect(controller.getSnapshot().turn).toBe("b");

    controller.dispose();
  });
});
