import type { GameState, Move } from "./core";

interface PendingSearch {
  handler: (event: MessageEvent<Move | null>) => void;
  resolve: (move: Move | null) => void;
}

export class XiangqiAiClient {
  private worker: Worker | null = null;
  private request = 0;
  private pending: PendingSearch | null = null;

  constructor() {
    if (typeof Worker !== "undefined") {
      this.worker = new Worker(new URL("./xiangqi.worker.ts", import.meta.url), { type: "module" });
    }
  }

  choose(state: GameState, depth: number): Promise<Move | null> {
    if (!this.worker) return Promise.resolve(null);
    this.cancel();
    const request = ++this.request;
    return new Promise((resolve) => {
      const handler = (event: MessageEvent<Move | null>) => {
        if (request !== this.request) return;
        this.worker?.removeEventListener("message", handler);
        this.pending = null;
        resolve(event.data);
      };
      this.pending = { handler, resolve };
      this.worker?.addEventListener("message", handler);
      this.worker?.postMessage({ state, depth });
    });
  }

  cancel() {
    this.request += 1;
    if (!this.pending) return;
    this.worker?.removeEventListener("message", this.pending.handler);
    this.pending.resolve(null);
    this.pending = null;
  }

  dispose() {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }
}
