/// <reference lib="webworker" />
import { chooseMove } from "./ai";
import type { GameState } from "./core";

interface SearchRequest {
  request: number;
  state: GameState;
  depth: number;
}

self.onmessage = (event: MessageEvent<SearchRequest>) => {
  const { request, state, depth } = event.data;
  const move = chooseMove(state, depth);
  self.postMessage({ request, move });
};
