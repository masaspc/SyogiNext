import { describe, it, expect } from 'vitest';
import { pieceMoves } from '../src/core/movegen';
import { applyMove } from '../src/core/apply';
import { sqOf, type Move } from '../src/core/types';
import { bare, put, tos } from './helpers';

const C = sqOf(4, 4);

describe('レア特殊駒の動き', () => {
  it('酔象: 真後ろ以外7方向', () => {
    const s = bare();
    put(s, C, 'elephant', 'player');
    const dests = tos(pieceMoves(s, C));
    expect(dests.length).toBe(7);
    expect(dests).not.toContain(sqOf(5, 4)); // 真後ろ
  });

  it('麒麟: 縦横2ジャンプ+斜め1', () => {
    const s = bare();
    put(s, C, 'kirin', 'player');
    put(s, sqOf(3, 4), 'pawn', 'player'); // 縦の間に味方(跳べる)
    const dests = tos(pieceMoves(s, C));
    expect(dests).toContain(sqOf(2, 4));
    expect(dests).toContain(sqOf(4, 2));
    expect(dests).toContain(sqOf(3, 3));
    expect(dests).not.toContain(sqOf(4, 3));
  });

  it('鳳凰: 斜め2ジャンプ+縦横1', () => {
    const s = bare();
    put(s, C, 'phoenix', 'player');
    const dests = tos(pieceMoves(s, C));
    expect(dests).toContain(sqOf(2, 2));
    expect(dests).toContain(sqOf(6, 6));
    expect(dests).toContain(sqOf(3, 4));
    expect(dests).not.toContain(sqOf(3, 3));
  });
});

describe('太子(酔象の成り)', () => {
  it('王が取られても太子がいれば敗北しない。太子も取られたら敗北', () => {
    const s = bare();
    put(s, sqOf(8, 4), 'king', 'player');
    put(s, sqOf(6, 6), 'elephant', 'player', { promoted: true }); // 太子
    put(s, sqOf(7, 4), 'rook', 'enemy');
    s.turn = 'enemy';
    const s2 = applyMove(s, { kind: 'move', from: sqOf(7, 4), to: sqOf(8, 4), promote: false });
    expect(s2.winner).toBeNull(); // 太子が残っている
    // 太子も取る
    s2.turn = 'enemy';
    const s3 = applyMove(s2, { kind: 'move', from: sqOf(8, 4), to: sqOf(7, 4), promote: false });
    // 竜(成り飛)で太子に迫る代わりに、直接取れる位置に動かして検証
    const s4 = bare();
    put(s4, sqOf(6, 6), 'elephant', 'player', { promoted: true });
    put(s4, sqOf(5, 6), 'rook', 'enemy');
    s4.turn = 'enemy';
    const s5 = applyMove(s4, { kind: 'move', from: sqOf(5, 6), to: sqOf(6, 6), promote: false });
    expect(s5.winner).toBe('enemy');
    expect(s3.winner).toBeNull(); // (中間局面の確認)
  });
});

describe('爆弾兵', () => {
  it('取られると取った駒と周囲8マスを消滅させる。王は生き残り、連鎖する', () => {
    const s = bare();
    put(s, C, 'bomber', 'enemy');
    put(s, sqOf(3, 4), 'gold', 'enemy'); // 隣接: 巻き添え
    put(s, sqOf(5, 5), 'silver', 'player'); // 取りに行く駒
    put(s, sqOf(4, 3), 'bomber', 'enemy'); // 隣接爆弾: 連鎖
    put(s, sqOf(4, 2), 'pawn', 'player'); // 連鎖爆発の巻き添え
    put(s, sqOf(3, 3), 'king', 'enemy'); // 王は生き残る
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 5), to: C, promote: false });
    expect(s2.board[C]).toBeNull(); // 取った銀も消滅
    expect(s2.board[sqOf(3, 4)]).toBeNull();
    expect(s2.board[sqOf(4, 3)]).toBeNull(); // 連鎖爆弾
    expect(s2.board[sqOf(4, 2)]).toBeNull(); // 連鎖の巻き添え
    expect(s2.board[sqOf(3, 3)]!.defId).toBe('king');
    expect(s2.hands.player['gold']).toBeUndefined(); // 爆発消滅は持ち駒にならない
  });

  it('爆発では妖狐の歩返還は発動しない(§7.4)', () => {
    const s = bare();
    put(s, C, 'bomber', 'enemy');
    put(s, sqOf(3, 4), 'fox', 'enemy'); // 爆発で消える妖狐
    put(s, sqOf(5, 5), 'silver', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 5), to: C, promote: false });
    expect(s2.board[sqOf(3, 4)]).toBeNull();
    expect(s2.hands.enemy['pawn']).toBeUndefined();
  });
});

describe('磁将', () => {
  it('移動手に引き寄せバリアントが生成され、適用で敵駒が1マス寄る', () => {
    const s = bare();
    put(s, sqOf(8, 4), 'magnet', 'player');
    put(s, sqOf(4, 4), 'gold', 'enemy'); // 磁将の移動後、縦の直線上
    const ms = pieceMoves(s, sqOf(8, 4)).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === sqOf(7, 4),
    );
    const withPull = ms.find((m) => m.pull);
    expect(withPull).toBeDefined();
    expect(withPull!.pull!.target).toBe(sqOf(4, 4));
    expect(withPull!.pull!.to).toBe(sqOf(5, 4));
    const s2 = applyMove(s, withPull!);
    expect(s2.board[sqOf(5, 4)]!.defId).toBe('gold');
    expect(s2.board[sqOf(4, 4)]).toBeNull();
  });

  it('隣接(距離1)の敵駒は引き寄せられない', () => {
    const s = bare();
    put(s, sqOf(8, 4), 'magnet', 'player');
    put(s, sqOf(6, 4), 'gold', 'enemy'); // 移動後(7,4)の隣
    const ms = pieceMoves(s, sqOf(8, 4)).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === sqOf(7, 4),
    );
    expect(ms.every((m) => !m.pull)).toBe(true);
  });
});

describe('狙撃手', () => {
  it('前方3マス以内の敵駒を狙撃できる(遮蔽あり・王不可・2回まで)', () => {
    const s = bare();
    put(s, sqOf(6, 4), 'sniper', 'player');
    put(s, sqOf(3, 4), 'gold', 'enemy'); // 3マス先
    let snipes = pieceMoves(s, sqOf(6, 4)).filter((m) => m.kind === 'active');
    expect(snipes.length).toBe(1);
    const s2 = applyMove(s, snipes[0]);
    expect(s2.board[sqOf(3, 4)]).toBeNull();
    expect(s2.hands.player['gold']).toBeUndefined(); // 戦利品なし
    expect(s2.board[sqOf(6, 4)]!.usesLeft).toBe(1);
    // 遮蔽: 間に駒があると狙えない
    const s3 = bare();
    put(s3, sqOf(6, 4), 'sniper', 'player');
    put(s3, sqOf(5, 4), 'pawn', 'player');
    put(s3, sqOf(3, 4), 'gold', 'enemy');
    expect(pieceMoves(s3, sqOf(6, 4)).filter((m) => m.kind === 'active').length).toBe(0);
    // 王は狙撃不可
    const s4 = bare();
    put(s4, sqOf(6, 4), 'sniper', 'player');
    put(s4, sqOf(4, 4), 'king', 'enemy');
    expect(pieceMoves(s4, sqOf(6, 4)).filter((m) => m.kind === 'active').length).toBe(0);
  });
});

describe('影の刺客', () => {
  it('敵駒を取ると追撃バリアントが生成され、1手で2枚取れる', () => {
    const s = bare();
    put(s, sqOf(6, 2), 'assassin', 'player');
    put(s, sqOf(4, 4), 'pawn', 'enemy');
    put(s, sqOf(2, 2), 'gold', 'enemy'); // (4,4)から斜めに見える
    const ms = pieceMoves(s, sqOf(6, 2)).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === sqOf(4, 4),
    );
    const chain = ms.find((m) => m.chain === sqOf(2, 2));
    expect(chain).toBeDefined();
    const s2 = applyMove(s, chain!);
    expect(s2.board[sqOf(2, 2)]!.defId).toBe('assassin');
    expect(s2.hands.player['pawn']).toBe(1);
    expect(s2.hands.player['gold']).toBe(1);
  });

  it('捕獲なしの移動には追撃がつかない', () => {
    const s = bare();
    put(s, sqOf(6, 2), 'assassin', 'player');
    const ms = pieceMoves(s, sqOf(6, 2)).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move',
    );
    expect(ms.every((m) => m.chain === undefined)).toBe(true);
  });

  it('怨念を取ると道連れで死に、追撃は不発(安全に処理される)', () => {
    const s = bare();
    put(s, sqOf(6, 2), 'assassin', 'player');
    put(s, sqOf(4, 4), 'grudge', 'enemy');
    put(s, sqOf(2, 2), 'gold', 'enemy');
    const ms = pieceMoves(s, sqOf(6, 2)).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === sqOf(4, 4) && m.chain === sqOf(2, 2),
    );
    const s2 = applyMove(s, ms[0]);
    expect(s2.board[sqOf(4, 4)]).toBeNull(); // 刺客は道連れ
    expect(s2.board[sqOf(2, 2)]!.defId).toBe('gold'); // 追撃されない
  });
});

describe('石化の魔女', () => {
  it('移動後に隣接敵駒を石化でき、相手はその駒を1手番動かせない', () => {
    const s = bare();
    put(s, sqOf(6, 4), 'witch', 'player');
    put(s, sqOf(4, 2), 'rook', 'enemy'); // witchが(5,3)へ動くと隣接
    const ms = pieceMoves(s, sqOf(6, 4)).filter(
      (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === sqOf(5, 3),
    );
    const pet = ms.find((m) => m.petrify === sqOf(4, 2));
    expect(pet).toBeDefined();
    const s2 = applyMove(s, pet!);
    const rook = s2.board[sqOf(4, 2)]!;
    expect(s2.petrified[rook.id]).toBe(1);
    expect(pieceMoves(s2, sqOf(4, 2))).toEqual([]); // 敵手番で動けない
    // 敵が別の手を指すと石化解除
    put(s2, sqOf(0, 0), 'pawn', 'enemy');
    s2.turn = 'enemy';
    const s3 = applyMove(s2, { kind: 'move', from: sqOf(0, 0), to: sqOf(1, 0), promote: false });
    expect(s3.petrified[rook.id]).toBeUndefined();
    expect(pieceMoves(s3, sqOf(4, 2)).length).toBeGreaterThan(0);
  });
});
