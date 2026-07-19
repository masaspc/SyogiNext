import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { pieceMoves } from '../src/core/movegen';
import { onBattleEnd } from '../src/core/run';
import { sqOf, type GameState, type Move, type RunState } from '../src/core/types';
import { bare, put } from './helpers';

function activeAt(state: GameState, from: number, ability: Extract<Move, { kind: 'active' }>['ability'], target?: number) {
  return pieceMoves(state, from).find(
    (move): move is Extract<Move, { kind: 'active' }> => move.kind === 'active'
      && move.ability === ability
      && (target === undefined || move.target === target),
  )!;
}

describe('天罰と不動明王', () => {
  it('神罰は指定点の3x3を無差別に消し、ロイヤルと完全防護された駒を残す', () => {
    const s = bare();
    const caster = sqOf(8, 8);
    const center = sqOf(4, 4);
    put(s, caster, 'tenbatsu', 'player');
    put(s, center, 'rook', 'enemy');
    put(s, sqOf(4, 3), 'gold', 'player');
    put(s, sqOf(3, 3), 'king', 'enemy');
    put(s, sqOf(5, 5), 'silver', 'enemy');
    put(s, sqOf(6, 5), 'fudomyoo', 'enemy');
    const next = applyMove(s, activeAt(s, caster, 'smite', center));
    expect(next.board[center]).toBeNull();
    expect(next.board[sqOf(4, 3)]).toBeNull();
    expect(next.board[sqOf(3, 3)]?.defId).toBe('king');
    expect(next.board[sqOf(5, 5)]?.defId).toBe('silver');
    expect(next.board[caster]?.usesLeft).toBe(1);
    expect(next.events.some((event) => event.t === 'smite')).toBe(true);
  });

  it('不動明王の隣接味方は捕獲も石化も受けず、自身は捕獲できる', () => {
    const s = bare();
    const warded = sqOf(4, 4);
    put(s, warded, 'gold', 'enemy');
    put(s, sqOf(5, 4), 'fudomyoo', 'enemy');
    put(s, sqOf(4, 1), 'rook', 'player');
    expect(pieceMoves(s, sqOf(4, 1)).some((m) => m.kind === 'move' && m.to === warded)).toBe(false);

    const witch = sqOf(5, 3);
    put(s, witch, 'witch', 'player');
    expect(pieceMoves(s, witch).some((m) => m.kind === 'move' && m.petrify === warded)).toBe(false);

    put(s, sqOf(7, 4), 'rook', 'player');
    expect(pieceMoves(s, sqOf(7, 4)).some((m) => m.kind === 'move' && m.to === sqOf(5, 4))).toBe(true);
  });
});

describe('酒呑童子と修羅', () => {
  it('酒呑童子はプレイヤーが捕獲した特殊駒を記録し、勝利後に控えへ加える', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'shuten', 'player');
    put(s, sqOf(3, 3), 'lion', 'enemy');
    const wonGame = applyMove(s, { kind: 'move', from: sqOf(4, 4), to: sqOf(3, 3), promote: false });
    expect(wonGame.stolen).toEqual(['lion']);
    expect(wonGame.graveyard).toContainEqual({ defId: 'lion', promoted: false });
    const run = { mode: 'normal', stage: 1, roster: [], formation: {}, game: wonGame, phase: 'battle', rewardOffer: null, rngState: 1 } satisfies RunState;
    const ended = onBattleEnd(run, 'player');
    expect(ended.roster).toContain('lion');
    expect(ended.lastStolen).toEqual(['lion']);
  });

  it('修羅は捕獲が続けば3回目までの追撃を生成し適用する', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const first = sqOf(3, 3);
    const second = sqOf(2, 2);
    const third = sqOf(1, 1);
    put(s, from, 'shura', 'player');
    put(s, first, 'pawn', 'enemy');
    put(s, second, 'silver', 'enemy');
    put(s, third, 'gold', 'enemy');
    const move = pieceMoves(s, from).find((m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move'
      && m.to === first && m.chain === second && m.chain2 === third)!;
    expect(move).toBeTruthy();
    const next = applyMove(s, move);
    expect(next.board[third]?.defId).toBe('shura');
    expect(next.hands.player).toMatchObject({ pawn: 1, silver: 1, gold: 1 });
  });

  it('修羅が追撃中の道連れで消えたら3回目は不発になる', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const first = sqOf(3, 3);
    const second = sqOf(2, 2);
    const third = sqOf(1, 1);
    put(s, from, 'shura', 'player');
    put(s, first, 'pawn', 'enemy');
    put(s, second, 'grudge', 'enemy');
    put(s, third, 'gold', 'enemy');
    const next = applyMove(s, { kind: 'move', from, to: first, promote: false, chain: second, chain2: third });
    expect(next.board[second]).toBeNull();
    expect(next.board[third]?.defId).toBe('gold');
  });

  it('修羅の2回目が非捕獲なら3回目の選択を生成しない', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const first = sqOf(3, 3);
    const quiet = sqOf(2, 2);
    put(s, from, 'shura', 'player');
    put(s, first, 'pawn', 'enemy');
    const moves = pieceMoves(s, from).filter((move) => move.kind === 'move' && move.to === first && move.chain === quiet);
    expect(moves).toHaveLength(1);
    expect(moves[0]).not.toHaveProperty('chain2');
  });

  it('修羅は王を捕獲した段階で追撃を終了する', () => {
    const from = sqOf(4, 4);
    const royal = sqOf(3, 3);
    const primary = bare();
    put(primary, from, 'shura', 'player');
    put(primary, royal, 'king', 'enemy');
    const primaryMoves = pieceMoves(primary, from).filter((move) => move.kind === 'move' && move.to === royal);
    expect(primaryMoves).toHaveLength(1);
    expect(primaryMoves[0]).not.toHaveProperty('chain');

    const chained = bare();
    const first = sqOf(3, 3);
    const second = sqOf(2, 2);
    put(chained, from, 'shura', 'player');
    put(chained, first, 'pawn', 'enemy');
    put(chained, second, 'king', 'enemy');
    const royalChain = pieceMoves(chained, from).find((move) => move.kind === 'move'
      && move.to === first && move.chain === second)!;
    expect(royalChain).not.toHaveProperty('chain2');
  });
});

describe('産土神・絡新婦・常世神', () => {
  it('産土神は持ち駒を自陣へ通常駒として自動配置する', () => {
    const s = bare(4);
    put(s, sqOf(4, 4), 'ubusuna', 'player');
    s.hands.player.gold = 1;
    const next = applyMove(s, { kind: 'pass' });
    const deployed = next.board.find((p) => p?.defId === 'gold');
    expect(deployed).toMatchObject({ owner: 'player' });
    expect(deployed?.conjured).toBeUndefined();
    expect(next.hands.player.gold).toBeUndefined();
  });

  it('産土神は月読の打ち封印中と持ち駒ゼロでは不発になる', () => {
    const sealed = bare();
    put(sealed, sqOf(4, 4), 'ubusuna', 'player');
    put(sealed, sqOf(0, 0), 'tsukuyomi', 'enemy');
    sealed.hands.player.gold = 1;
    expect(applyMove(sealed, { kind: 'pass' }).hands.player.gold).toBe(1);

    const empty = bare();
    put(empty, sqOf(4, 4), 'ubusuna', 'player');
    expect(() => applyMove(empty, { kind: 'pass' })).not.toThrow();
  });

  it('絡新婦は直線上の最寄り敵を隣まで引きずり、ロイヤルと防護対象を除外する', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'jorogumo', 'player');
    put(s, sqOf(4, 8), 'gold', 'enemy');
    const next = applyMove(s, { kind: 'pass' });
    expect(next.board[sqOf(4, 5)]?.defId).toBe('gold');
    expect(next.board[sqOf(4, 8)]).toBeNull();

    const protectedState = bare();
    put(protectedState, sqOf(4, 4), 'jorogumo', 'player');
    put(protectedState, sqOf(4, 8), 'gold', 'enemy');
    put(protectedState, sqOf(5, 8), 'fudomyoo', 'enemy');
    expect(applyMove(protectedState, { kind: 'pass' }).board[sqOf(4, 8)]?.defId).toBe('gold');
  });

  it('常世神がいれば残数0でも能力を生成し、発動しても残数を減らさない', () => {
    const s = bare();
    const raijin = sqOf(8, 8);
    put(s, raijin, 'raijin', 'player', { usesLeft: 0 });
    put(s, sqOf(8, 7), 'tokoyo', 'player');
    put(s, sqOf(0, 0), 'gold', 'enemy');
    const bolt = activeAt(s, raijin, 'bolt');
    expect(bolt).toBeTruthy();
    const next = applyMove(s, bolt);
    expect(next.board[raijin]?.usesLeft).toBe(0);

    const without = bare();
    put(without, raijin, 'raijin', 'player', { usesLeft: 0 });
    put(without, sqOf(0, 0), 'gold', 'enemy');
    expect(pieceMoves(without, raijin).some((m) => m.kind === 'active')).toBe(false);
  });

  it('常世神が盤上から消えると、次の能力から残数を消費する', () => {
    const s = bare();
    const caster = sqOf(8, 8);
    const tokoyo = sqOf(8, 7);
    put(s, caster, 'tenbatsu', 'player');
    put(s, tokoyo, 'tokoyo', 'player');
    put(s, sqOf(4, 4), 'gold', 'enemy');
    let next = applyMove(s, activeAt(s, caster, 'smite', sqOf(4, 4)));
    expect(next.board[caster]?.usesLeft).toBe(2);

    next.board[tokoyo] = null;
    next.turn = 'player';
    put(next, sqOf(0, 0), 'silver', 'enemy');
    next = applyMove(next, activeAt(next, caster, 'smite', sqOf(0, 0)));
    expect(next.board[caster]?.usesLeft).toBe(1);
  });
});
