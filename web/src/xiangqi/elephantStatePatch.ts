import { CinematicXiangqiController } from "./cinematicController";

const STATE_PATCH = Symbol.for("xiangqi.elephant.state.events");
const prototype = CinematicXiangqiController.prototype as unknown as Record<PropertyKey, unknown>;

if (!prototype[STATE_PATCH]) {
  prototype[STATE_PATCH] = true;
  const originalOn = CinematicXiangqiController.prototype.on;

  CinematicXiangqiController.prototype.on = function (event, listener) {
    if (event === "state") {
      return originalOn.call(this, event, (() => {
        (listener as (snapshot: ReturnType<CinematicXiangqiController["getSnapshot"]>) => void)(this.getSnapshot());
      }) as typeof listener);
    }
    return originalOn.call(this, event, listener);
  };
}
