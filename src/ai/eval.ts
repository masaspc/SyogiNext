import { attacked } from '../core/apply';
import { findRoyals } from '../core/board';
import { def, effectiveDef } from '../core/defs';
import type { GameState, Owner } from '../core/types';
import { colOf, rowOf } from '../core/types';

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
    const pieceDef = effectiveDef(piece);
    score += sign * (pieceDef.aiValue + progress * 2);
    if (pieceDef.doomsday) score += sign * progress * 300;
    if (pieceDef.throne) {
      const centerDistance = Math.abs(rowOf(sq) - 4) + Math.abs(colOf(sq) - 4);
      score += sign * ((piece.throneCount ?? 0) * 1200 + (8 - centerDistance) * 40);
    }
    if (pieceDef.absorbMoves) score += sign * (piece.absorbed?.length ?? 0) * 300;
  }
  for (const owner of ['player', 'enemy'] as Owner[]) {
    const sign = owner === pov ? 1 : -1;
    for (const [id, count] of Object.entries(state.hands[owner])) {
      score += sign * def(id).aiValue * count * 0.9;
    }
    if (state.cursedKing[owner]) score -= sign * 800;
    const hasGate = state.board.some((piece) => piece
      && piece.owner === owner
      && effectiveDef(piece).auto?.kind === 'gate');
    if (hasGate) score += sign * state.graveyard.length * 40;
  }
  for (const royalSq of findRoyals(state, pov)) {
    if (attacked(state, royalSq, opponent(pov))) score -= 400;
  }
  for (const royalSq of findRoyals(state, opponent(pov))) {
    if (attacked(state, royalSq, pov)) score += 400;
  }
  return score + ((rngTick >>> 0) % 11);
}
