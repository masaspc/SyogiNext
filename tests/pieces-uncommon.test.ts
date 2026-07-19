import { describe, it, expect } from 'vitest';
import { pieceMoves, legalMoves } from '../src/core/movegen';
import { applyMove } from '../src/core/apply';
import { sqOf } from '../src/core/types';
import { bare, put, tos } from './helpers';

const C = sqOf(4, 4);

describe('アンコモン特殊駒の動き', () => {
  it('猛豹: 6方向1マス、成ると角', () => {
    const s = bare();
    put(s, C, 'leopard', 'player');
    expect(tos(pieceMoves(s, C)).length).toBe(6);
    const s2 = bare();
    put(s2, C, 'leopard', 'player', { promoted: true });
    expect(tos(pieceMoves(s2, C))).toContain(sqOf(0, 0)); // 角スライド
  });

  it('風車: 横スライダー+前後1、成ると飛', () => {
    const s = bare();
    put(s, C, 'windmill', 'player');
    const dests = tos(pieceMoves(s, C));
    expect(dests).toContain(sqOf(4, 0));
    expect(dests).toContain(sqOf(4, 8));
    expect(dests).toContain(sqOf(3, 4));
    expect(dests).toContain(sqOf(5, 4));
    expect(dests).not.toContain(sqOf(2, 4));
    const s2 = bare();
    put(s2, C, 'windmill', 'player', { promoted: true });
    expect(tos(pieceMoves(s2, C))).toContain(sqOf(0, 4)); // 飛スライド
  });

  it('八方桂: チェスナイト8方向ジャンプ', () => {
    const s = bare();
    put(s, C, 'knight8', 'player');
    // 周囲を味方で囲んでも跳べる
    for (const a of [sqOf(3, 4), sqOf(5, 4), sqOf(4, 3), sqOf(4, 5)]) put(s, a, 'pawn', 'player');
    expect(tos(pieceMoves(s, C)).length).toBe(8);
  });

  it('槍兵: 前2まで+横1、成ると長槍(前3まで+横+斜め前)', () => {
    const s = bare();
    put(s, C, 'spearman', 'player');
    expect(tos(pieceMoves(s, C))).toEqual(
      [sqOf(2, 4), sqOf(3, 4), sqOf(4, 3), sqOf(4, 5)].sort((a, b) => a - b),
    );
    const s2 = bare();
    put(s2, C, 'spearman', 'player', { promoted: true });
    const dests = tos(pieceMoves(s2, C));
    expect(dests).toContain(sqOf(1, 4));
    expect(dests).toContain(sqOf(3, 3));
  });
});

describe('アンコモン特殊駒の能力', () => {
  it('盾兵は正面からの直進では取られない(香・飛)が、斜めからは取られる', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'shieldman', 'player'); // playerの盾兵: 正面=row3側
    put(s, sqOf(0, 4), 'lance', 'enemy'); // 敵香が上から直進
    const lanceMoves = tos(pieceMoves(s, sqOf(0, 4)));
    expect(lanceMoves).not.toContain(sqOf(4, 4));
    expect(lanceMoves).toContain(sqOf(3, 4)); // 手前までは来られる
    put(s, sqOf(3, 3), 'silver', 'enemy'); // 斜めから銀
    expect(tos(pieceMoves(s, sqOf(3, 3)))).toContain(sqOf(4, 4));
  });

  it('盾兵はジャンプ攻撃なら正面からでも取られる(敵弓兵の前2ジャンプ)', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'shieldman', 'player');
    put(s, sqOf(2, 4), 'archer', 'enemy'); // 敵弓兵: 前(下向き)2マスジャンプで捕獲
    expect(tos(pieceMoves(s, sqOf(2, 4)))).toContain(sqOf(4, 4));
  });

  it('怨念: 道連れ。ただし王は道連れにならない', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'grudge', 'enemy');
    put(s, sqOf(5, 5), 'silver', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 5), to: sqOf(4, 4), promote: false });
    expect(s2.board[sqOf(4, 4)]).toBeNull(); // 両方消滅
    const s3 = bare();
    put(s3, sqOf(4, 4), 'grudge', 'enemy');
    put(s3, sqOf(5, 5), 'king', 'player');
    const s4 = applyMove(s3, { kind: 'move', from: sqOf(5, 5), to: sqOf(4, 4), promote: false });
    expect(s4.board[sqOf(4, 4)]!.defId).toBe('king'); // 王は生存
  });

  it('妖狐: 取られると持ち主の駒台に歩として戻る', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'fox', 'enemy');
    put(s, sqOf(5, 5), 'silver', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 5), to: sqOf(4, 4), promote: false });
    expect(s2.hands.enemy['pawn']).toBe(1); // 敵の駒台に歩
    expect(s2.hands.player['fox']).toBeUndefined();
  });

  it('隠密: 自陣の空きマスへワープ、1回で尽きる', () => {
    const s = bare();
    put(s, sqOf(2, 4), 'ninja', 'player');
    const warps = pieceMoves(s, sqOf(2, 4)).filter((m) => m.kind === 'active');
    expect(warps.length).toBe(27); // 自陣3段は全て空き
    const s2 = applyMove(s, warps[0]);
    const newSq = (warps[0] as { target: number }).target;
    expect(s2.board[newSq]!.defId).toBe('ninja');
    expect(s2.board[newSq]!.usesLeft).toBe(0);
    expect(pieceMoves(s2, newSq).filter((m) => m.kind === 'active').length).toBe(0);
  });

  it('影武者: 味方の王と位置を交換できる', () => {
    const s = bare();
    put(s, sqOf(2, 2), 'kagemusha', 'player');
    put(s, sqOf(8, 4), 'king', 'player');
    const swaps = pieceMoves(s, sqOf(2, 2)).filter((m) => m.kind === 'active');
    expect(swaps.length).toBe(1);
    const s2 = applyMove(s, swaps[0]);
    expect(s2.board[sqOf(8, 4)]!.defId).toBe('kagemusha');
    expect(s2.board[sqOf(2, 2)]!.defId).toBe('king');
  });

  it('王手されている状態から影武者交換で退避できる(合法手として存在)', () => {
    const s = bare();
    put(s, sqOf(8, 4), 'king', 'player');
    put(s, sqOf(0, 4), 'rook', 'enemy');
    put(s, sqOf(7, 0), 'kagemusha', 'player');
    const ms = legalMoves(s, 'player');
    expect(ms.some((m) => m.kind === 'active' && m.ability === 'kingSwap')).toBe(true);
  });
});
