import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { isAttacked, legalMoves, pieceMoves } from '../src/core/movegen';
import { sqOf, type GameState, type Move } from '../src/core/types';
import { bare, put, tos } from './helpers';

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

describe('天上レア', () => {
  it('天照: 隣接する敵非ロイヤルだけを麻痺させる', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'amaterasu', 'player');
    put(s, sqOf(4, 5), 'gold', 'enemy');
    put(s, sqOf(3, 3), 'king', 'enemy');
    put(s, sqOf(7, 0), 'silver', 'enemy');
    expect(pieceMoves(s, sqOf(4, 5))).toEqual([]);
    expect(isAttacked(s, sqOf(5, 5), 'enemy')).toBe(false);
    expect(pieceMoves(s, sqOf(3, 3)).length).toBeGreaterThan(0);
    expect(pieceMoves(s, sqOf(7, 0)).length).toBeGreaterThan(0);
  });

  it('天照: 麻痺中は敵の自動行動カウントも進めない', () => {
    const s = bare();
    const autoSq = sqOf(4, 5);
    put(s, sqOf(4, 4), 'amaterasu', 'player');
    put(s, autoSq, 'chibosin', 'enemy');
    s.turn = 'enemy';
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.board[autoSq]?.autoCount).toBeUndefined();
    expect(s2.board.some((piece) => piece?.defId === 'pawn')).toBe(false);
  });

  it('須佐之男: 十拳剣で5×5内の敵非ロイヤルだけを消滅させる', () => {
    const s = bare();
    const from = sqOf(4, 4);
    put(s, from, 'susanoo', 'player');
    put(s, sqOf(2, 2), 'pawn', 'enemy');
    put(s, sqOf(6, 6), 'bomber', 'enemy');
    put(s, sqOf(3, 3), 'king', 'enemy');
    put(s, sqOf(1, 4), 'gold', 'enemy');
    const s2 = applyMove(s, activeAt(s, from, 'ohabari'));
    expect(s2.board[sqOf(2, 2)]).toBeNull();
    expect(s2.board[sqOf(6, 6)]).toBeNull();
    expect(s2.board[sqOf(3, 3)]?.defId).toBe('king');
    expect(s2.board[sqOf(1, 4)]?.defId).toBe('gold');
  });

  it('月読: 盤上にいる間だけ敵の打ち駒を封印する', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'tsukuyomi', 'player');
    s.hands.enemy.pawn = 1;
    expect(legalMoves(s, 'enemy').some((move) => move.kind === 'drop')).toBe(false);
    s.board[sqOf(4, 4)] = null;
    expect(legalMoves(s, 'enemy').some((move) => move.kind === 'drop')).toBe(true);
  });

  it('稲荷: 毎手番、銀→金→角→飛→馬の順に生成する', () => {
    let s = bare(9);
    put(s, sqOf(4, 4), 'inari', 'player');
    for (let i = 0; i < 5; i++) s = nextPlayerTurn(s);
    expect(s.board.some((piece) => piece?.defId === 'silver')).toBe(true);
    expect(s.board.some((piece) => piece?.defId === 'gold')).toBe(true);
    expect(s.board.some((piece) => piece?.defId === 'bishop' && !piece.promoted)).toBe(true);
    expect(s.board.some((piece) => piece?.defId === 'rook')).toBe(true);
    expect(s.board.some((piece) => piece?.defId === 'bishop' && piece.promoted)).toBe(true);
    s = nextPlayerTurn(s);
    expect(s.board.filter((piece) => piece?.defId === 'silver')).toHaveLength(2);
  });

  it('八岐大蛇: 守護を通し、守られていない隣接敵だけを捕食する', () => {
    const s = bare(10);
    put(s, sqOf(4, 4), 'orochi', 'player');
    put(s, sqOf(4, 5), 'pawn', 'enemy');
    put(s, sqOf(3, 6), 'gunshin', 'enemy');
    put(s, sqOf(5, 4), 'silver', 'enemy');
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.board[sqOf(4, 5)]?.defId).toBe('pawn');
    expect(s2.board[sqOf(5, 4)]).toBeNull();
    expect(s2.hands.player.silver).toBeUndefined();
  });

  it('八岐大蛇: 捕食対象がなくても自動行動カウントは進む', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'orochi', 'player');
    const s2 = applyMove(s, { kind: 'pass' });
    expect(s2.board[sqOf(4, 4)]?.autoCount).toBe(1);
    expect(s2.events.some((event) => event.t === 'devour')).toBe(false);
  });

  it('禍津神: 2手番ごとに敵の通常駒だけを成り状態ごと寝返らせる', () => {
    let s = bare(11);
    put(s, sqOf(4, 4), 'magatsukami', 'player');
    put(s, sqOf(3, 4), 'silver', 'enemy', { promoted: true });
    put(s, sqOf(3, 3), 'lion', 'enemy');
    s = nextPlayerTurn(s);
    s = nextPlayerTurn(s);
    expect(s.board[sqOf(3, 4)]).toMatchObject({ owner: 'player', promoted: true });
    expect(s.board[sqOf(3, 3)]?.owner).toBe('enemy');
  });

  it('閻魔: 距離に関係なく任意の敵非ロイヤルを3回まで断罪する', () => {
    const s = bare();
    const from = sqOf(8, 8);
    const target = sqOf(0, 0);
    put(s, from, 'enma', 'player');
    put(s, target, 'phoenix_b', 'enemy');
    put(s, sqOf(0, 2), 'gold', 'enemy');
    put(s, sqOf(0, 3), 'silver', 'enemy');
    put(s, sqOf(0, 1), 'king', 'enemy');
    let s2 = applyMove(s, activeAt(s, from, 'execute', target));
    expect(s2.board[target]).toBeNull();
    s2.turn = 'player';
    s2 = applyMove(s2, activeAt(s2, from, 'execute', sqOf(0, 2)));
    s2.turn = 'player';
    s2 = applyMove(s2, activeAt(s2, from, 'execute', sqOf(0, 3)));
    expect(s2.board[sqOf(0, 1)]?.defId).toBe('king');
    expect(s2.board[from]?.usesLeft).toBe(0);
    expect(pieceMoves(s2, from).some((move) => move.kind === 'active')).toBe(false);
    expect(s2.board.some((piece) => piece?.defId === 'phoenix_b')).toBe(false);
  });

  it('龍神: 駒1枚を越えて進めるが、2枚目より先へは進めない', () => {
    const s = bare();
    const from = sqOf(4, 4);
    put(s, from, 'ryujin', 'player');
    put(s, sqOf(3, 4), 'pawn', 'player');
    put(s, sqOf(1, 4), 'silver', 'enemy');
    const dests = tos(pieceMoves(s, from));
    expect(dests).toContain(sqOf(2, 4));
    expect(dests).toContain(sqOf(1, 4));
    expect(dests).not.toContain(sqOf(0, 4));
  });
});
