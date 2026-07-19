import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { pieceMoves } from '../src/core/movegen';
import { sqOf, type Move } from '../src/core/types';
import { bare, put, tos } from './helpers';

describe('獅子', () => {
  it('二段移動で2枚を取り、元のマスへ戻る居食いも生成する', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const first = sqOf(3, 4);
    const second = sqOf(2, 4);
    put(s, from, 'lion', 'player');
    put(s, first, 'pawn', 'enemy');
    put(s, second, 'gold', 'enemy');

    const variants = pieceMoves(s, from).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === first,
    );
    expect(variants.some((m) => m.second === null)).toBe(true);
    expect(variants.some((m) => m.second === from)).toBe(true);
    const doubleCapture = variants.find((m) => m.second === second)!;
    const s2 = applyMove(s, doubleCapture);
    expect(s2.board[second]?.defId).toBe('lion');
    expect(s2.hands.player).toMatchObject({ pawn: 1, gold: 1 });
  });

  it('一段目でロイヤルを取ったら二段目なしで即勝利する', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const king = sqOf(3, 4);
    put(s, from, 'lion', 'player');
    put(s, king, 'king', 'enemy');
    const moves = pieceMoves(s, from).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === king,
    );
    expect(moves).toHaveLength(1);
    expect(moves[0].second).toBeNull();
    expect(applyMove(s, moves[0]).winner).toBe('player');
  });
});

describe('奔王', () => {
  it('全8方向へスライドする', () => {
    const s = bare();
    const center = sqOf(4, 4);
    put(s, center, 'honno', 'player');
    const dests = tos(pieceMoves(s, center));
    expect(dests).toContain(sqOf(0, 4));
    expect(dests).toContain(sqOf(4, 8));
    expect(dests).toContain(sqOf(0, 0));
    expect(dests).toContain(sqOf(8, 8));
  });
});

describe('不死鳥', () => {
  it('捕獲時に自陣へ1度だけ復活し、再捕獲では消滅する', () => {
    const s = bare(7);
    const target = sqOf(4, 4);
    put(s, target, 'phoenix_b', 'enemy');
    put(s, sqOf(5, 4), 'rook', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 4), to: target, promote: false });
    const revivedSq = s2.board.findIndex((p) => p?.defId === 'phoenix_b');
    expect(revivedSq).toBeGreaterThanOrEqual(0);
    expect(Math.floor(revivedSq / 9)).toBeLessThanOrEqual(2);
    expect(s2.board[revivedSq]?.revived).toBe(true);

    put(s2, sqOf(Math.floor(revivedSq / 9) + 1, revivedSq % 9), 'rook', 'player');
    s2.turn = 'player';
    const attackerSq = sqOf(Math.floor(revivedSq / 9) + 1, revivedSq % 9);
    const s3 = applyMove(s2, { kind: 'move', from: attackerSq, to: revivedSq, promote: false });
    expect(s3.board.some((p) => p?.defId === 'phoenix_b')).toBe(false);
  });

  it('爆発で消滅した場合は復活しない', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'bomber', 'enemy');
    put(s, sqOf(4, 3), 'phoenix_b', 'enemy');
    put(s, sqOf(5, 4), 'rook', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 4), to: sqOf(4, 4), promote: false });
    expect(s2.board.some((p) => p?.defId === 'phoenix_b')).toBe(false);
  });
});

describe('軍神', () => {
  it('隣接する味方を守るが、軍神自身とロイヤルは守らない', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'gunshin', 'enemy');
    put(s, sqOf(4, 5), 'gold', 'enemy');
    put(s, sqOf(4, 3), 'king', 'enemy');
    put(s, sqOf(6, 5), 'rook', 'player');
    put(s, sqOf(6, 4), 'rook', 'player');
    put(s, sqOf(6, 3), 'rook', 'player');
    expect(tos(pieceMoves(s, sqOf(6, 5)))).not.toContain(sqOf(4, 5));
    expect(tos(pieceMoves(s, sqOf(6, 4)))).toContain(sqOf(4, 4));
    expect(tos(pieceMoves(s, sqOf(6, 3)))).toContain(sqOf(4, 3));
  });
});

describe('傀儡師', () => {
  it('隣接する敵の成り通常駒を成り状態のまま寝返らせ、1回で尽きる', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const target = sqOf(3, 4);
    put(s, from, 'kugutsushi', 'player');
    put(s, target, 'silver', 'enemy', { promoted: true });
    const convert = pieceMoves(s, from).find(
      (m): m is Extract<Move, { kind: 'active' }> => m.kind === 'active' && m.ability === 'convert',
    )!;
    const s2 = applyMove(s, convert);
    expect(s2.board[target]).toMatchObject({ defId: 'silver', owner: 'player', promoted: true });
    expect(s2.board[from]?.usesLeft).toBe(0);
    expect(pieceMoves(s2, from).some((m) => m.kind === 'active')).toBe(false);
  });
});
