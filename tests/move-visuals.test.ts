import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { sqOf } from '../src/core/types';
import { createMoveVisual } from '../src/ui/move-visuals';
import { bare, put } from './helpers';

describe('指し手の表示情報', () => {
  it('通常移動の始点・終点と変更マスを検出する', () => {
    const state = bare();
    const from = sqOf(6, 4);
    const to = sqOf(5, 4);
    put(state, from, 'pawn', 'player');
    const move = { kind: 'move', from, to, promote: false } as const;
    const next = applyMove(state, move);
    const visual = createMoveVisual(state, move, next);
    expect(visual.origin).toBe(from);
    expect(visual.destination).toBe(to);
    expect([...visual.changed].sort((a, b) => a - b)).toEqual([to, from].sort((a, b) => a - b));
    expect(visual.historyLabel).toContain('歩兵');
  });

  it('獅子の二段目を最終着地点とし、捕獲効果も履歴へ含める', () => {
    const state = bare();
    const from = sqOf(4, 4);
    const first = sqOf(3, 4);
    const second = sqOf(2, 4);
    put(state, from, 'lion', 'player');
    put(state, first, 'pawn', 'enemy');
    const move = { kind: 'move', from, to: first, promote: false, second } as const;
    const next = applyMove(state, move);
    const visual = createMoveVisual(state, move, next);
    expect(visual.destination).toBe(second);
    expect(visual.changed).toEqual(new Set([from, first, second]));
    expect(visual.historyLabel).toContain('捕獲');
  });

  it('持ち駒を打った手は始点なしで記録する', () => {
    const state = bare();
    const to = sqOf(4, 4);
    state.hands.player.pawn = 1;
    const move = { kind: 'drop', defId: 'pawn', to } as const;
    const next = applyMove(state, move);
    const visual = createMoveVisual(state, move, next);
    expect(visual.origin).toBeNull();
    expect(visual.destination).toBe(to);
    expect(visual.historyLabel).toContain('歩兵打');
  });

  it('パスは始点・終点なしで履歴へ記録する', () => {
    const state = bare();
    const move = { kind: 'pass' } as const;
    const visual = createMoveVisual(state, move, applyMove(state, move));
    expect(visual.origin).toBeNull();
    expect(visual.destination).toBeNull();
    expect(visual.historyLabel).toBe('▲パス');
  });
});
