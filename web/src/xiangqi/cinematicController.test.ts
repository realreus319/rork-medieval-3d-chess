import { describe, expect, it, vi } from "vitest";
import { CinematicXiangqiController } from "./cinematicController";

describe("CinematicXiangqiController", () => {
  it("exposes the 9×10 Xiangqi position through original cinematic archetypes", () => {
    const controller = new CinematicXiangqiController();
    controller.start({ mode: "local", difficulty: 2, humanColor: "red" });

    expect(controller.getBoard()).toHaveLength(32);
    expect(controller.pieceAt("e10")).toEqual({ kind: "k", color: "w" });
    expect(controller.pieceAt("b8")).toEqual({ kind: "q", color: "w" });
    expect(controller.pieceAt("a7")).toEqual({ kind: "p", color: "w" });
    expect(controller.legalTargets("a7")).toContainEqual({
      to: "a6",
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

    await expect(controller.tryMove("a7", "a6")).resolves.toBe(true);
    expect(animator).toHaveBeenCalledWith(expect.objectContaining({
      color: "w",
      kind: "p",
      from: "a7",
      to: "a6",
      rook: null,
      promotion: null,
    }));
    expect(controller.getSnapshot().lastMove).toEqual({ from: "a7", to: "a6" });
    expect(controller.getSnapshot().turn).toBe("b");

    controller.dispose();
  });
});
