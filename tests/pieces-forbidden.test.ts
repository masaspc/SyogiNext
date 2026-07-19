import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { pieceMoves } from '../src/core/movegen';
import { sqOf, type GameState, type Move } from '../src/core/types';
import { bare, put, tos } from './helpers';

function activeAt(state: GameState, from: number, ability: Extract<Move, { kind: 'active' }>['ability']) {
  return pieceMoves(state, from).find(
    (move): move is Extract<Move, { kind: 'active' }> => move.kind === 'active' && move.ability === ability,
  )!;
}

function nextPlayerTurn(state: GameState): GameState {
  return applyMove(applyMove(state, { kind: 'pass' }), { kind: 'pass' });
}

describe('魔王', () => {
  it('全方向スライダー手と獅子の二段手を両方生成する', () => {
    const s = bare();
    const from = sqOf(4, 4);
    put(s, from, 'maou', 'player');
    const moves = pieceMoves(s, from);
    expect(tos(moves)).toContain(sqOf(0, 4));
    expect(moves.some((move) => move.kind === 'move' && move.second === sqOf(2, 4))).toBe(true);
  });

  it('隣接敵を味方より優先して捕食し、墓地へ送る', () => {
    const s = bare(2);
    put(s, sqOf(4, 4), 'maou', 'player');
    put(s, sqOf(3, 4), 'silver', 'enemy');
    put(s, sqOf(5, 4), 'gold', 'player');
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.board[sqOf(3, 4)]).toBeNull();
    expect(s2.board[sqOf(5, 4)]?.defId).toBe('gold');
    expect(s2.graveyard).toEqual([{ defId: 'silver', promoted: false }]);
  });

  it('敵がいなければ味方を喰い、両方いなければ不発になる', () => {
    const s = bare(3);
    put(s, sqOf(4, 4), 'maou', 'player');
    put(s, sqOf(4, 5), 'pawn', 'player');
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.board[sqOf(4, 5)]).toBeNull();
    expect(s2.graveyard[0]?.defId).toBe('pawn');

    const alone = bare();
    put(alone, sqOf(4, 4), 'maou', 'player');
    const alone2 = applyMove(alone, { kind: 'pass' });
    expect(alone2.board[sqOf(4, 4)]?.autoCount).toBe(1);
    expect(alone2.events.some((event) => event.t === 'devour')).toBe(false);
  });
});

describe('下剋上', () => {
  it('playerがrow0へ到達すると敵非ロイヤルだけを全滅させる', () => {
    const s = bare();
    const from = sqOf(1, 4);
    const to = sqOf(0, 4);
    put(s, from, 'gekokujo', 'player');
    put(s, sqOf(2, 2), 'pawn', 'enemy');
    put(s, sqOf(3, 3), 'lion', 'enemy');
    put(s, sqOf(0, 0), 'king', 'enemy');
    put(s, sqOf(0, 8), 'haoh', 'enemy');
    put(s, sqOf(5, 5), 'gold', 'player');
    const s2 = applyMove(s, { kind: 'move', from, to, promote: false });
    expect(s2.board[to]?.defId).toBe('gekokujo');
    expect(s2.board[sqOf(2, 2)]).toBeNull();
    expect(s2.board[sqOf(3, 3)]).toBeNull();
    expect(s2.board[sqOf(0, 0)]?.defId).toBe('king');
    expect(s2.board[sqOf(0, 8)]?.defId).toBe('haoh');
    expect(s2.board[sqOf(5, 5)]?.defId).toBe('gold');
    expect(s2.events.some((event) => event.t === 'doomsday')).toBe(true);
  });

  it('到達前は発動せず、enemyはrow8で発動する', () => {
    const before = bare();
    put(before, sqOf(2, 4), 'gekokujo', 'player');
    put(before, sqOf(4, 4), 'pawn', 'enemy');
    const before2 = applyMove(before, { kind: 'move', from: sqOf(2, 4), to: sqOf(1, 4), promote: false });
    expect(before2.board[sqOf(4, 4)]?.defId).toBe('pawn');

    const enemy = bare();
    enemy.turn = 'enemy';
    put(enemy, sqOf(7, 4), 'gekokujo', 'enemy');
    put(enemy, sqOf(5, 5), 'silver', 'player');
    const enemy2 = applyMove(enemy, { kind: 'move', from: sqOf(7, 4), to: sqOf(8, 4), promote: false });
    expect(enemy2.board[sqOf(5, 5)]).toBeNull();
    expect(enemy2.events.some((event) => event.t === 'doomsday')).toBe(true);
  });
});

describe('冥府の門', () => {
  it('一切動けず、墓地の古い駒から自軍として成り状態を保って蘇生する', () => {
    let s = bare(4);
    const gateSq = sqOf(4, 4);
    put(s, gateSq, 'meifu', 'player');
    s.graveyard = [
      { defId: 'fox', promoted: false },
      { defId: 'silver', promoted: true },
    ];
    expect(pieceMoves(s, gateSq)).toEqual([]);
    s = applyMove(s, { kind: 'pass' });
    expect(s.board.some((piece) => piece?.defId === 'fox' && piece.owner === 'player')).toBe(true);
    expect(s.graveyard).toEqual([{ defId: 'silver', promoted: true }]);
    s = nextPlayerTurn(s);
    expect(s.board.some((piece) => piece?.defId === 'silver' && piece.owner === 'player' && piece.promoted)).toBe(true);
    expect(s.graveyard).toEqual([]);
  });

  it('隣接空きがなければ墓地の先頭を消費しない', () => {
    const s = bare();
    const gateSq = sqOf(4, 4);
    put(s, gateSq, 'meifu', 'player');
    for (let row = 3; row <= 5; row++) for (let col = 3; col <= 5; col++) {
      if (sqOf(row, col) !== gateSq) put(s, sqOf(row, col), 'gold', 'player');
    }
    s.graveyard = [{ defId: 'lion', promoted: false }];
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.graveyard).toEqual([{ defId: 'lion', promoted: false }]);
  });
});

describe('天邪鬼', () => {
  it('敵非ロイヤルと自軍非ロイヤルを強制交換し、状態を保つ', () => {
    const s = bare(5);
    const selfSq = sqOf(4, 4);
    const enemySq = sqOf(1, 1);
    const self = put(s, selfSq, 'amanojaku', 'player');
    const enemy = put(s, enemySq, 'silver', 'enemy', { promoted: true });
    put(s, sqOf(0, 0), 'king', 'enemy');
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.board[enemySq]?.id).toBe(self.id);
    expect(s2.board[selfSq]).toMatchObject({ id: enemy.id, promoted: true, owner: 'enemy' });
    expect(s2.board[sqOf(0, 0)]?.defId).toBe('king');
  });
});

describe('契約の魔神', () => {
  it('盤上にいる間は王を8方向2まで強化し、失うと前1だけに呪う', () => {
    const s = bare();
    const kingSq = sqOf(7, 4);
    const majinSq = sqOf(4, 4);
    put(s, kingSq, 'king', 'player');
    put(s, majinSq, 'majin', 'player');
    expect(tos(pieceMoves(s, kingSq))).toContain(sqOf(5, 4));

    put(s, sqOf(4, 2), 'rook', 'enemy');
    s.turn = 'enemy';
    const cursed = applyMove(s, { kind: 'move', from: sqOf(4, 2), to: majinSq, promote: false });
    expect(cursed.cursedKing.player).toBe(true);
    expect(tos(pieceMoves(cursed, kingSq))).toEqual([sqOf(6, 4)]);
    expect(cursed.events.some((event) => event.t === 'curse')).toBe(true);
  });

  it('呪いは太子の動きに影響しない', () => {
    const s = bare();
    const princeSq = sqOf(4, 4);
    put(s, princeSq, 'elephant', 'player', { promoted: true });
    s.cursedKing.player = true;
    expect(pieceMoves(s, princeSq).filter((move) => move.kind === 'move')).toHaveLength(8);
  });
});

describe('血の女王', () => {
  it('持ち駒がある時だけ追撃を生成し、最安の通常駒を供物にする', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const first = sqOf(3, 3);
    const second = sqOf(2, 2);
    put(s, from, 'chinojoou', 'player');
    put(s, first, 'lion', 'enemy');
    s.hands.player = { pawn: 1, gold: 1 };
    const chain = pieceMoves(s, from).find(
      (move): move is Extract<Move, { kind: 'move' }> => move.kind === 'move' && move.to === first && move.chain === second,
    )!;
    const s2 = applyMove(s, chain);
    expect(s2.board[second]?.defId).toBe('chinojoou');
    expect(s2.hands.player.pawn).toBeUndefined();
    expect(s2.hands.player.gold).toBe(1);
    expect(s2.events.some((event) => event.t === 'sacrifice' && event.defId === 'pawn')).toBe(true);

    const empty = bare();
    put(empty, from, 'chinojoou', 'player');
    put(empty, first, 'lion', 'enemy');
    expect(pieceMoves(empty, from).some((move) => move.kind === 'move' && move.chain != null)).toBe(false);
  });
});

describe('星喰い', () => {
  it('終焉で自身を含む全非ロイヤルと両軍の持ち駒を消し、ロイヤルだけ残す', () => {
    const s = bare();
    const from = sqOf(4, 4);
    put(s, from, 'hoshikui', 'player');
    put(s, sqOf(8, 4), 'king', 'player');
    put(s, sqOf(7, 4), 'elephant', 'player', { promoted: true });
    put(s, sqOf(0, 4), 'haoh', 'enemy');
    put(s, sqOf(3, 3), 'pawn', 'player');
    put(s, sqOf(3, 4), 'bomber', 'enemy');
    put(s, sqOf(5, 5), 'meifu', 'enemy');
    put(s, sqOf(5, 4), 'majin', 'player');
    s.hands = { player: { pawn: 2 }, enemy: { rook: 1 } };
    const s2 = applyMove(s, activeAt(s, from, 'apocalypse'));
    expect(s2.board.filter(Boolean).map((piece) => piece!.defId).sort()).toEqual(['elephant', 'haoh', 'king']);
    expect(s2.hands).toEqual({ player: {}, enemy: {} });
    expect(s2.graveyard.map((entry) => entry.defId)).toEqual(expect.arrayContaining(['hoshikui', 'pawn', 'bomber', 'meifu', 'majin']));
    expect(s2.cursedKing.player).toBe(true);
    expect(s2.events.some((event) => event.t === 'apocalypse')).toBe(true);
  });
});

describe('墓地の既存除去経路', () => {
  it('断罪と捕食は墓地へ送り、通常捕獲・妖狐・復活成功は送らない', () => {
    const execute = bare();
    const enmaSq = sqOf(8, 8);
    put(execute, enmaSq, 'enma', 'player');
    put(execute, sqOf(0, 0), 'lion', 'enemy');
    const executed = applyMove(execute, activeAt(execute, enmaSq, 'execute'));
    expect(executed.graveyard.map((entry) => entry.defId)).toContain('lion');

    const capture = bare();
    put(capture, sqOf(4, 4), 'rook', 'player');
    put(capture, sqOf(4, 5), 'gold', 'enemy');
    const captured = applyMove(capture, { kind: 'move', from: sqOf(4, 4), to: sqOf(4, 5), promote: false });
    expect(captured.graveyard).toEqual([]);

    const fox = bare();
    put(fox, sqOf(4, 4), 'rook', 'player');
    put(fox, sqOf(4, 5), 'fox', 'enemy');
    const foxed = applyMove(fox, { kind: 'move', from: sqOf(4, 4), to: sqOf(4, 5), promote: false });
    expect(foxed.graveyard).toEqual([]);

    const phoenix = bare(7);
    put(phoenix, sqOf(4, 4), 'rook', 'player');
    put(phoenix, sqOf(4, 5), 'phoenix_b', 'enemy');
    const revived = applyMove(phoenix, { kind: 'move', from: sqOf(4, 4), to: sqOf(4, 5), promote: false });
    expect(revived.graveyard).toEqual([]);
    expect(revived.board.some((piece) => piece?.defId === 'phoenix_b')).toBe(true);
  });

  it('爆発で消滅した駒を墓地へ記録する', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'bomber', 'enemy');
    put(s, sqOf(4, 3), 'silver', 'enemy');
    put(s, sqOf(5, 4), 'rook', 'player');
    const s2 = applyMove(s, { kind: 'move', from: sqOf(5, 4), to: sqOf(4, 4), promote: false });
    expect(s2.graveyard.map((entry) => entry.defId)).toEqual(expect.arrayContaining(['bomber', 'rook', 'silver']));
  });
});
