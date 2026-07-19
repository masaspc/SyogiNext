import { describe, it, expect } from 'vitest';
import { legalMoves, pieceMoves, isAttacked } from '../src/core/movegen';
import { sqOf } from '../src/core/types';
import { bare, put, tos } from './helpers';

describe('通常駒の合法手', () => {
  it('歩: 前1マスのみ、味方がいれば動けない', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'pawn', 'player');
    expect(tos(pieceMoves(s, sqOf(4, 4)))).toEqual([sqOf(3, 4)]);
    put(s, sqOf(3, 4), 'gold', 'player');
    expect(pieceMoves(s, sqOf(4, 4))).toEqual([]);
  });

  it('敵の歩は下向きに進む', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'pawn', 'enemy');
    expect(tos(pieceMoves(s, sqOf(4, 4)))).toEqual([sqOf(5, 4)]);
  });

  it('香: 直進スライダー、敵駒で捕獲して止まる', () => {
    const s = bare();
    put(s, sqOf(8, 0), 'lance', 'player');
    put(s, sqOf(3, 0), 'pawn', 'enemy');
    const dests = tos(pieceMoves(s, sqOf(8, 0)));
    expect(dests).toEqual([sqOf(3, 0), sqOf(4, 0), sqOf(5, 0), sqOf(6, 0), sqOf(7, 0)]);
  });

  it('桂: 駒を飛び越えられる', () => {
    const s = bare();
    put(s, sqOf(8, 4), 'knight', 'player');
    put(s, sqOf(7, 4), 'pawn', 'player'); // 目の前に味方
    expect(tos(pieceMoves(s, sqOf(8, 4)))).toEqual([sqOf(6, 3), sqOf(6, 5)]);
  });

  it('銀と金の動き', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'silver', 'player');
    expect(tos(pieceMoves(s, sqOf(4, 4)))).toEqual(
      [sqOf(3, 3), sqOf(3, 4), sqOf(3, 5), sqOf(5, 3), sqOf(5, 5)].sort((a, b) => a - b),
    );
    const s2 = bare();
    put(s2, sqOf(4, 4), 'gold', 'player');
    expect(tos(pieceMoves(s2, sqOf(4, 4)))).toEqual(
      [sqOf(3, 3), sqOf(3, 4), sqOf(3, 5), sqOf(4, 3), sqOf(4, 5), sqOf(5, 4)].sort((a, b) => a - b),
    );
  });

  it('馬: 斜めスライダー+縦横1', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'bishop', 'player', { promoted: true });
    const dests = tos(pieceMoves(s, sqOf(4, 4)));
    expect(dests).toContain(sqOf(0, 0));
    expect(dests).toContain(sqOf(3, 4));
    expect(dests).toContain(sqOf(4, 5));
    expect(dests).not.toContain(sqOf(2, 4));
  });

  it('成り: 敵陣に入る手は成り/不成の2手、行き所がなければ強制成り', () => {
    const s = bare();
    put(s, sqOf(3, 4), 'pawn', 'player');
    const ms = pieceMoves(s, sqOf(3, 4)).filter((m) => m.kind === 'move');
    expect(ms.length).toBe(2); // row2へ: 成り選択
    expect(ms.map((m) => (m as { promote: boolean }).promote).sort()).toEqual([false, true]);

    const s2 = bare();
    put(s2, sqOf(1, 4), 'pawn', 'player');
    const ms2 = pieceMoves(s2, sqOf(1, 4)).filter((m) => m.kind === 'move');
    expect(ms2.length).toBe(1); // row0へ: 強制成り
    expect((ms2[0] as { promote: boolean }).promote).toBe(true);
  });

  it('桂は敵陣2段目でも強制成り', () => {
    const s = bare();
    put(s, sqOf(3, 4), 'knight', 'player');
    const ms = pieceMoves(s, sqOf(3, 4)).filter((m) => m.kind === 'move');
    // 行き先はrow1: そこから桂は動けない→全て強制成り
    expect(ms.every((m) => (m as { promote: boolean }).promote)).toBe(true);
  });

  it('成り駒(と金)は再成りしない', () => {
    const s = bare();
    put(s, sqOf(3, 4), 'pawn', 'player', { promoted: true });
    const ms = pieceMoves(s, sqOf(3, 4)).filter((m) => m.kind === 'move');
    expect(ms.every((m) => (m as { promote: boolean }).promote === false)).toBe(true);
  });
});

describe('打ち', () => {
  it('持ち駒は空きマスに打てる、二歩は禁止', () => {
    const s = bare();
    put(s, sqOf(6, 4), 'pawn', 'player');
    s.hands.player = { pawn: 1 };
    const drops = legalMoves(s, 'player').filter((m) => m.kind === 'drop');
    const cols = new Set(drops.map((m) => (m as { to: number }).to % 9));
    expect(cols.has(4)).toBe(false); // 二歩
    expect(cols.has(0)).toBe(true);
    // 最奥段(row0)には歩は打てない
    expect(drops.some((m) => (m as { to: number }).to < 9)).toBe(false);
  });

  it('桂は敵陣2段以内に打てない', () => {
    const s = bare();
    s.hands.player = { knight: 1 };
    const drops = legalMoves(s, 'player').filter((m) => m.kind === 'drop');
    expect(drops.some((m) => (m as { to: number }).to < 18)).toBe(false);
    expect(drops.some((m) => (m as { to: number }).to >= 18)).toBe(true);
  });

  it('と金として取られた歩は歩として打つ(handsに歩で入る前提の駆動確認)', () => {
    const s = bare();
    s.hands.player = { gold: 2 };
    const drops = legalMoves(s, 'player').filter((m) => m.kind === 'drop');
    expect(drops.length).toBe(81); // 金は全マスに打てる(全マス空き)
  });
});

describe('石化と王手', () => {
  it('石化中の駒は手を生成しない', () => {
    const s = bare();
    const p = put(s, sqOf(4, 4), 'rook', 'player');
    s.petrified[p.id] = 1;
    expect(pieceMoves(s, sqOf(4, 4))).toEqual([]);
  });

  it('王手中でも手は自由に生成される(王手放置合法)', () => {
    const s = bare();
    put(s, sqOf(8, 4), 'king', 'player');
    put(s, sqOf(0, 4), 'rook', 'enemy'); // 同列で王手
    put(s, sqOf(8, 0), 'pawn', 'player');
    expect(isAttacked(s, sqOf(8, 4), 'enemy')).toBe(true);
    const ms = legalMoves(s, 'player');
    // 歩を突く手(王手放置)も含まれる
    expect(ms.some((m) => m.kind === 'move' && m.from === sqOf(8, 0))).toBe(true);
  });
});
