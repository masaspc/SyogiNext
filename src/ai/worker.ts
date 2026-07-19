import { findBestMove } from './search';
import type { GameState } from '../core/types';

interface SearchRequest {
  state: GameState;
  depth: number;
  timeMs: number;
}

self.onmessage = (event: MessageEvent<SearchRequest>) => {
  const { state, depth, timeMs } = event.data;
  const move = findBestMove(state, state.turn, depth, timeMs);
  self.postMessage({ move });
};
