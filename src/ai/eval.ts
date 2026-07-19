import { attacked } from '../core/apply';
import { findRoyals } from '../core/board';
import { def, effectiveDef } from '../core/defs';
import type { GameState, Owner } from '../core/types';
import { rowOf } from '../core/types';

const opponent = (owner: Owner): Owner => (owner === 'player' ? 'enemy' : 'player');

// pov視点の静的評価。評価の微小項も外部乱数を使わず、呼び出し側が渡すtickで決定する。
export function evaluate(state: GameState, pov: Owner, rngTick: number): number {
  if (state.winner) return state.winner === pov ? 1_000_000 : -1_000_000;
  let score = 0;
  for (let sq = 0; sq < 81; sq++) {
    const piece = state.board[sq];
    if (!piece) continue;
    const sign = piece.owner === pov ? 1 : -1;
    const progress = piece.owner === 'player' ? 8 - rowOf(sq) : rowOf(sq);
    score += sign * (effectiveDef(piece).aiValue + progress * 2);
  }
  for (const owner of ['player', 'enemy'] as Owner[]) {
    const sign = owner === pov ? 1 : -1;
    for (const [id, count] of Object.entries(state.hands[owner])) {
      score += sign * def(id).aiValue * count * 0.9;
    }
  }
  for (const royalSq of findRoyals(state, pov)) {
    if (attacked(state, royalSq, opponent(pov))) score -= 400;
  }
  for (const royalSq of findRoyals(state, opponent(pov))) {
    if (attacked(state, royalSq, pov)) score += 400;
  }
  return score + ((rngTick >>> 0) % 11);
}
