import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { pieceMoves } from '../src/core/movegen';
import { sqOf, type GameState, type Move } from '../src/core/types';
import { bare, put } from './helpers';

function activeAt(state: GameState, from: number, ability: Extract<Move, { kind: 'active' }>['ability'], target?: number) {
  return pieceMoves(state, from).find(
    (move): move is Extract<Move, { kind: 'active' }> => move.kind === 'active'
      && move.ability === ability
      && (target === undefined || move.target === target),
  )!;
}

function nextPlayerTurn(state: GameState): GameState {
  return applyMove(applyMove(state, { kind: 'pass' }), { kind: 'pass' });
}

describe('追加神話レア', () => {
  it('雷神: 選んだ列の敵非ロイヤルだけを落雷で消滅させる', () => {
    const s = bare();
    const from = sqOf(7, 4);
    put(s, from, 'raijin', 'player');
    put(s, sqOf(2, 2), 'pawn', 'enemy');
    put(s, sqOf(5, 2), 'fox', 'enemy');
    put(s, sqOf(0, 2), 'king', 'enemy');
    put(s, sqOf(5, 3), 'gold', 'enemy');

    const s2 = applyMove(s, activeAt(s, from, 'bolt', sqOf(2, 2)));
    expect(s2.board[sqOf(2, 2)]).toBeNull();
    expect(s2.board[sqOf(5, 2)]).toBeNull();
    expect(s2.board[sqOf(0, 2)]?.defId).toBe('king');
    expect(s2.board[sqOf(5, 3)]?.defId).toBe('gold');
    expect(s2.hands.enemy.pawn).toBeUndefined();
    expect(s2.board[from]?.usesLeft).toBe(0);
  });

  it('風神: 選んだ段の後退可能な敵駒をロイヤルも含めて押し戻す', () => {
    const s = bare();
    const from = sqOf(7, 4);
    put(s, from, 'fujin', 'player');
    put(s, sqOf(3, 2), 'pawn', 'enemy');
    put(s, sqOf(3, 4), 'silver', 'enemy');
    put(s, sqOf(2, 4), 'gold', 'enemy');
    put(s, sqOf(3, 6), 'king', 'enemy');

    const s2 = applyMove(s, activeAt(s, from, 'gale', sqOf(3, 2)));
    expect(s2.board[sqOf(2, 2)]?.defId).toBe('pawn');
    expect(s2.board[sqOf(3, 4)]?.defId).toBe('silver');
    expect(s2.board[sqOf(2, 6)]?.defId).toBe('king');
  });

  it('地母神: 自分の毎手番終了時に隣接空きマスへ歩を生成する', () => {
    const s = bare(4);
    put(s, sqOf(4, 4), 'chibosin', 'player');
    const s2 = applyMove(s, { kind: 'pass' });
    const pawn = s2.board.findIndex((piece) => piece?.defId === 'pawn' && piece.owner === 'player');
    expect(pawn).toBeGreaterThanOrEqual(0);
    expect(s2.events.some((event) => event.t === 'spawn' && event.defId === 'pawn')).toBe(true);
  });

  it('地母神: 周囲に空きがなくても自動行動カウントは進む', () => {
    const s = bare();
    const from = sqOf(4, 4);
    put(s, from, 'chibosin', 'player');
    for (let row = 3; row <= 5; row++) for (let col = 3; col <= 5; col++) {
      if (sqOf(row, col) !== from) put(s, sqOf(row, col), 'gold', 'player');
    }
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.board[from]?.autoCount).toBe(1);
    expect(s2.board.filter((piece) => piece?.defId === 'pawn')).toHaveLength(0);
  });

  it('鍛冶神: 2手番ごとに金、銀の順で生成する', () => {
    let s = bare(5);
    put(s, sqOf(4, 4), 'kajishin', 'player');
    s = nextPlayerTurn(s);
    expect(s.board.some((piece) => piece?.defId === 'gold')).toBe(false);
    s = nextPlayerTurn(s);
    expect(s.board.some((piece) => piece?.defId === 'gold')).toBe(true);
    s = nextPlayerTurn(nextPlayerTurn(s));
    expect(s.board.some((piece) => piece?.defId === 'silver')).toBe(true);
  });

  it('死神: 捕獲後に周囲の敵だけを消滅させ、消滅時効果は発動しない', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const to = sqOf(3, 3);
    put(s, from, 'shinigami', 'player');
    put(s, to, 'pawn', 'enemy');
    put(s, sqOf(3, 4), 'bomber', 'enemy');
    put(s, sqOf(2, 3), 'king', 'enemy');
    put(s, sqOf(2, 2), 'silver', 'player');
    put(s, sqOf(3, 5), 'gold', 'player');

    const s2 = applyMove(s, { kind: 'move', from, to, promote: false });
    expect(s2.board[to]?.defId).toBe('shinigami');
    expect(s2.board[sqOf(3, 4)]).toBeNull();
    expect(s2.board[sqOf(2, 3)]?.defId).toBe('king');
    expect(s2.board[sqOf(2, 2)]?.defId).toBe('silver');
    expect(s2.board[sqOf(3, 5)]?.defId).toBe('gold');
  });

  it('死神: 怨念を取って道連れになった場合は周囲消滅を発動しない', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const to = sqOf(3, 3);
    put(s, from, 'shinigami', 'player');
    put(s, to, 'grudge', 'enemy');
    put(s, sqOf(3, 4), 'pawn', 'enemy');
    const s2 = applyMove(s, { kind: 'move', from, to, promote: false });
    expect(s2.board[to]).toBeNull();
    expect(s2.board[sqOf(3, 4)]?.defId).toBe('pawn');
  });

  it('時の巫女: 敵の全非ロイヤルを次の敵手番だけ停止させる', () => {
    const s = bare();
    const from = sqOf(6, 4);
    put(s, from, 'tokinomiko', 'player');
    const pawn = put(s, sqOf(2, 3), 'pawn', 'enemy');
    const king = put(s, sqOf(1, 4), 'king', 'enemy');
    const s2 = applyMove(s, activeAt(s, from, 'timestop'));
    expect(s2.petrified[pawn.id]).toBe(1);
    expect(s2.petrified[king.id]).toBeUndefined();
    expect(pieceMoves(s2, sqOf(2, 3))).toEqual([]);
    const s3 = applyMove(s2, { kind: 'pass' });
    expect(s3.petrified[pawn.id]).toBeUndefined();
  });

  it('時の巫女: 刻停中は敵の自動行動カウントも進めない', () => {
    const s = bare();
    const from = sqOf(6, 4);
    const autoSq = sqOf(2, 4);
    put(s, from, 'tokinomiko', 'player');
    put(s, autoSq, 'chibosin', 'enemy');
    const stopped = applyMove(s, activeAt(s, from, 'timestop'));
    const afterEnemyPass = applyMove(stopped, { kind: 'pass' });
    expect(afterEnemyPass.board[autoSq]?.autoCount).toBeUndefined();
    expect(afterEnemyPass.board.some((piece) => piece?.defId === 'pawn')).toBe(false);
  });

  it('残影: 通常移動の最初の移動元へ歩を残す', () => {
    const s = bare();
    const from = sqOf(5, 4);
    const to = sqOf(3, 4);
    put(s, from, 'zanei', 'player');
    const s2 = applyMove(s, { kind: 'move', from, to, promote: false });
    expect(s2.board[to]?.defId).toBe('zanei');
    expect(s2.board[from]).toMatchObject({ defId: 'pawn', owner: 'player' });
  });

  it('残影: アクティブ移動では移動元へ歩を残さない', () => {
    const s = bare();
    const from = sqOf(7, 4);
    const to = sqOf(8, 3);
    put(s, from, 'zanei', 'player', { usesLeft: 1 });
    const s2 = applyMove(s, { kind: 'active', from, ability: 'warp', target: to });
    expect(s2.board[to]?.defId).toBe('zanei');
    expect(s2.board[from]).toBeNull();
  });

  it('分身武者: 2手番ごとに複製し、新しい分身は次のフェーズから数える', () => {
    let s = bare(8);
    const original = put(s, sqOf(4, 4), 'bunshin', 'player');
    s = nextPlayerTurn(s);
    s = nextPlayerTurn(s);
    const copies = s.board.filter((piece) => piece?.defId === 'bunshin');
    expect(copies).toHaveLength(2);
    expect(copies.find((piece) => piece?.id === original.id)?.autoCount).toBe(2);
    expect(copies.find((piece) => piece?.id !== original.id)?.autoCount).toBe(0);
    s = nextPlayerTurn(nextPlayerTurn(s));
    expect(s.board.filter((piece) => piece?.defId === 'bunshin').length).toBeGreaterThanOrEqual(4);
  });
});
