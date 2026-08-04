import type { GameState, Move } from "./core";

export class XiangqiAiClient {
  private worker: Worker | null = null;
  private request = 0;

  constructor() {
    if (typeof Worker !== "undefined") {
      this.worker = new Worker(new URL("./xiangqi.worker.ts", import.meta.url), { type: "module" });
    }
  }

  choose(state: GameState, depth: number): Promise<Move | null> {
    if (!this.worker) return Promise.resolve(null);
    const request = ++this.request;
    return new Promise((resolve) => {
      const handler = (event: MessageEvent<Move | null>) => {
        if (request !== this.request) return;
        this.worker?.removeEventListener("message", handler);
        resolve(event.data);
      };
      this.worker.addEventListener("message", handler);
      this.worker.postMessage({ state, depth });
    });
  }

  cancel() {
    this.request += 1;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
