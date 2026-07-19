import { describe, expect, it } from 'vitest';
import { sqOf } from '../src/core/types';
import { activeEffectSquares } from '../src/ui/battle';

describe('敵能力の効果範囲表示', () => {
  it('落雷は列全体、突風は段全体を返す', () => {
    expect(activeEffectSquares({ kind: 'active', from: sqOf(8, 8), target: sqOf(0, 3), ability: 'bolt' }))
      .toEqual(Array.from({ length: 9 }, (_, row) => sqOf(row, 3)));
    expect(activeEffectSquares({ kind: 'active', from: sqOf(0, 0), target: sqOf(5, 8), ability: 'gale' }))
      .toEqual(Array.from({ length: 9 }, (_, col) => sqOf(5, col)));
  });

  it('神罰は爆心3x3、自己AoEは能力範囲全体を返す', () => {
    expect(activeEffectSquares({ kind: 'active', from: sqOf(8, 8), target: sqOf(4, 4), ability: 'smite' })).toHaveLength(9);
    expect(activeEffectSquares({ kind: 'active', from: sqOf(4, 4), target: sqOf(4, 4), ability: 'ohabari' })).toHaveLength(25);
    expect(activeEffectSquares({ kind: 'active', from: sqOf(4, 4), target: sqOf(4, 4), ability: 'apocalypse' })).toHaveLength(81);
  });

  it('波動球は指定方向の盤端までを返す', () => {
    expect(activeEffectSquares({ kind: 'active', from: sqOf(4, 4), target: sqOf(4, 5), ability: 'shockwave' }))
      .toEqual([sqOf(4, 5), sqOf(4, 6), sqOf(4, 7), sqOf(4, 8)]);
  });
});
