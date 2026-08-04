/// <reference lib="webworker" />
import { chooseMove } from "./ai";
import type { GameState } from "./core";

self.onmessage = (event: MessageEvent<{ state: GameState; depth: number }>) => {
  const move = chooseMove(event.data.state, event.data.depth);
  self.postMessage(move);
};
