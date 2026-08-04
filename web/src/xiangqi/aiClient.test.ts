import { afterEach, describe, expect, it, vi } from "vitest";
import { XiangqiAiClient } from "./aiClient";
import { createInitialState, type Move } from "./core";

interface WorkerMessage {
  request: number;
  move: Move | null;
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly posts: Array<{ request: number }> = [];
  private listeners = new Set<(event: MessageEvent<WorkerMessage>) => void>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent<WorkerMessage>) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent<WorkerMessage>) => void) {
    this.listeners.delete(listener);
  }

  postMessage(message: { request: number }) {
    this.posts.push(message);
  }

  emit(message: WorkerMessage) {
    for (const listener of this.listeners) listener({ data: message } as MessageEvent<WorkerMessage>);
  }

  terminate() {}
}

afterEach(() => {
  FakeWorker.instances = [];
  vi.unstubAllGlobals();
});

describe("XiangqiAiClient", () => {
  it("cancels the previous promise and ignores its late worker reply", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = new XiangqiAiClient();
    const worker = FakeWorker.instances[0];
    const state = createInitialState();

    const first = client.choose(state, 1);
    const firstRequest = worker.posts[0].request;
    const second = client.choose(state, 2);
    const secondRequest = worker.posts[1].request;

    await expect(first).resolves.toBeNull();

    let secondSettled = false;
    void second.then(() => {
      secondSettled = true;
    });

    worker.emit({ request: firstRequest, move: null });
    await Promise.resolve();
    expect(secondSettled).toBe(false);

    worker.emit({ request: secondRequest, move: null });
    await expect(second).resolves.toBeNull();
    client.dispose();
  });
});
