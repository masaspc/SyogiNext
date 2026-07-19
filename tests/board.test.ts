import { describe, it, expect } from 'vitest';
import { newGame, inCamp, inPromoZone, findRoyals } from '../src/core/board';
import { sqOf } from '../src/core/types';

describe('initial board', () => {
  it('通常編成で両軍40枚が正しく並ぶ', () => {
    const g = newGame({}, {}, 1);
    const pieces = g.board.filter((p) => p !== null);
    expect(pieces.length).toBe(40);
    expect(pieces.filter((p) => p!.owner === 'player').length).toBe(20);
    // 王の位置
    expect(g.board[sqOf(8, 4)]!.defId).toBe('king');
    expect(g.board[sqOf(0, 4)]!.defId).toBe('king');
    // 飛角
    expect(g.board[sqOf(7, 7)]!.defId).toBe('rook');
    expect(g.board[sqOf(7, 1)]!.defId).toBe('bishop');
    expect(g.board[sqOf(1, 1)]!.defId).toBe('rook');
    // 歩の段
    for (let c = 0; c < 9; c++) {
      expect(g.board[sqOf(6, c)]!.defId).toBe('pawn');
      expect(g.board[sqOf(2, c)]!.defId).toBe('pawn');
    }
  });

  it('formationで通常駒が特殊駒に差し替わる', () => {
    const g = newGame({ [sqOf(6, 4)]: 'lance' }, { [sqOf(2, 0)]: 'rook' }, 1);
    expect(g.board[sqOf(6, 4)]!.defId).toBe('lance');
    expect(g.board[sqOf(6, 4)]!.owner).toBe('player');
    expect(g.board[sqOf(2, 0)]!.defId).toBe('rook');
    expect(g.board[sqOf(2, 0)]!.owner).toBe('enemy');
  });

  it('inCamp/inPromoZoneの境界', () => {
    expect(inCamp('player', sqOf(6, 0))).toBe(true);
    expect(inCamp('player', sqOf(5, 0))).toBe(false);
    expect(inCamp('enemy', sqOf(2, 8))).toBe(true);
    expect(inCamp('enemy', sqOf(3, 8))).toBe(false);
    expect(inPromoZone('player', sqOf(2, 3))).toBe(true);
    expect(inPromoZone('player', sqOf(3, 3))).toBe(false);
    expect(inPromoZone('enemy', sqOf(6, 3))).toBe(true);
    expect(inPromoZone('enemy', sqOf(5, 3))).toBe(false);
  });

  it('findRoyalsが王を見つける', () => {
    const g = newGame({}, {}, 1);
    expect(findRoyals(g, 'player')).toEqual([sqOf(8, 4)]);
    expect(findRoyals(g, 'enemy')).toEqual([sqOf(0, 4)]);
  });
});
