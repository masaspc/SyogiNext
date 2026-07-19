import { describe, expect, it } from 'vitest';
import { applyMove, attacked } from '../src/core/apply';
import { ADJ } from '../src/core/board';
import { pieceMoves } from '../src/core/movegen';
import { sqOf } from '../src/core/types';
import { bare, put, tos } from './helpers';

describe('ボス駒の動き', () => {
  it('鬼武者は8方向1マスと前2マスまで動く', () => {
    const s = bare();
    const center = sqOf(4, 4);
    put(s, center, 'onimusha', 'enemy');
    const dests = tos(pieceMoves(s, center));
    expect(dests).toContain(sqOf(6, 4));
    expect(dests).toContain(sqOf(3, 3));
    expect(dests).not.toContain(sqOf(2, 4));
  });

  it('九尾と覇王は全8方向に2マスまで動く', () => {
    for (const id of ['kyubi', 'haoh']) {
      const s = bare();
      const center = sqOf(4, 4);
      put(s, center, id, 'enemy');
      const dests = tos(pieceMoves(s, center));
      expect(dests).toContain(sqOf(2, 2));
      expect(dests).toContain(sqOf(6, 4));
      expect(dests).not.toContain(sqOf(1, 1));
    }
  });
});

describe('回避ワープ', () => {
  it('九尾が利きに入ると移動後も安全な隣接空きマスへ逃げ、残回数を減らす', () => {
    const s = bare(3);
    const bossSq = sqOf(4, 4);
    put(s, bossSq, 'kyubi', 'enemy');
    put(s, sqOf(4, 0), 'rook', 'player');
    put(s, sqOf(8, 8), 'pawn', 'player');
    s.bossDodgesLeft = 2;

    const s2 = applyMove(s, { kind: 'move', from: sqOf(8, 8), to: sqOf(7, 8), promote: false });
    const escaped = s2.board.findIndex((p) => p?.defId === 'kyubi');
    expect(escaped).not.toBe(bossSq);
    expect(ADJ[bossSq]).toContain(escaped);
    expect(attacked(s2, escaped, 'player')).toBe(false);
    expect(s2.bossDodgesLeft).toBe(1);
  });

  it('安全な空きマスがなければ逃げず、回数も消費しない', () => {
    const s = bare();
    const bossSq = sqOf(4, 4);
    put(s, bossSq, 'kyubi', 'enemy');
    for (const a of ADJ[bossSq]) put(s, a, 'pawn', 'enemy');
    put(s, sqOf(4, 0), 'rook', 'player');
    put(s, sqOf(8, 8), 'pawn', 'player');
    s.bossDodgesLeft = 2;

    const s2 = applyMove(s, { kind: 'move', from: sqOf(8, 8), to: sqOf(7, 8), promote: false });
    expect(s2.board[bossSq]?.defId).toBe('kyubi');
    expect(s2.bossDodgesLeft).toBe(2);
  });

  it('残回数0なら攻撃されても回避しない', () => {
    const s = bare();
    const bossSq = sqOf(4, 4);
    put(s, bossSq, 'kyubi', 'enemy');
    put(s, sqOf(4, 0), 'rook', 'player');
    put(s, sqOf(8, 8), 'pawn', 'player');
    s.bossDodgesLeft = 0;
    const s2 = applyMove(s, { kind: 'move', from: sqOf(8, 8), to: sqOf(7, 8), promote: false });
    expect(s2.board[bossSq]?.defId).toBe('kyubi');
  });
});

describe('覇王のオーラと勝敗', () => {
  it('隣接する配下を守るが、覇王自身は捕獲できる', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'haoh', 'enemy');
    put(s, sqOf(4, 5), 'gold', 'enemy');
    put(s, sqOf(6, 5), 'rook', 'player');
    put(s, sqOf(6, 4), 'rook', 'player');
    expect(tos(pieceMoves(s, sqOf(6, 5)))).not.toContain(sqOf(4, 5));
    expect(tos(pieceMoves(s, sqOf(6, 4)))).toContain(sqOf(4, 4));
  });

  it('ボスを取ると勝利する', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'onimusha', 'enemy');
    put(s, sqOf(5, 4), 'rook', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 4), to: sqOf(4, 4), promote: false });
    expect(s2.winner).toBe('player');
  });
});
