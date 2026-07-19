import { describe, expect, it } from 'vitest';
import { effectiveDef } from '../src/core/defs';
import { pieceMoves } from '../src/core/movegen';
import { createSelector } from '../src/ui/move-selector';
import { sqOf, type GameState, type Move } from '../src/core/types';
import { bare, put } from './helpers';

function selectorFor(state: GameState, from: number) {
  return createSelector(pieceMoves(state, from), (sq) => state.board[sq] ? effectiveDef(state.board[sq]!) : null);
}

describe('move selector', () => {
  it('任意成りは盤上選択を挟み、強制成りはそのまま確定する', () => {
    const s = bare();
    const from = sqOf(3, 4);
    const to = sqOf(2, 4);
    put(s, from, 'pawn', 'player');
    const selector = selectorFor(s, from);
    expect(selector.tap(to)).toEqual({ type: 'stage' });
    expect(selector.stage().kind).toBe('promote');
    expect(selector.choosePromote(true)).toMatchObject({ type: 'commit', move: { promote: true, to } });

    const forced = bare();
    const forcedFrom = sqOf(1, 4);
    const forcedTo = sqOf(0, 4);
    put(forced, forcedFrom, 'pawn', 'player');
    expect(selectorFor(forced, forcedFrom).tap(forcedTo)).toMatchObject({ type: 'commit', move: { promote: true } });
  });

  it('獅子の二段目と停止をタップで選べる', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const first = sqOf(3, 4);
    put(s, from, 'lion', 'player');
    const selector = selectorFor(s, from);
    expect(selector.tap(first)).toEqual({ type: 'stage' });
    expect(selector.stage()).toMatchObject({ kind: 'second', skippable: true, tentative: { from, at: first } });
    expect(selector.stage().moveOptions).toContain(from);
    expect(selector.tap(from)).toMatchObject({ type: 'commit', move: { second: from } });

    const stop = selectorFor(s, from);
    stop.tap(first);
    expect(stop.skip()).toMatchObject({ type: 'commit', move: { second: null } });
  });

  it('刺客は捕獲後だけ追撃段階へ進み、修羅は再追撃段階まで進む', () => {
    const assassin = bare();
    const from = sqOf(4, 4);
    const captured = sqOf(3, 3);
    put(assassin, from, 'assassin', 'player');
    put(assassin, captured, 'pawn', 'enemy');
    const selector = selectorFor(assassin, from);
    selector.tap(captured);
    expect(selector.stage()).toMatchObject({ kind: 'chain', skippable: true });

    const quiet = selectorFor(assassin, from);
    expect(quiet.tap(sqOf(5, 5))).toMatchObject({ type: 'commit' });

    const shura = bare();
    const second = sqOf(2, 2);
    put(shura, from, 'shura', 'player');
    put(shura, captured, 'pawn', 'enemy');
    put(shura, second, 'silver', 'enemy');
    put(shura, sqOf(1, 1), 'gold', 'enemy');
    const multi = selectorFor(shura, from);
    multi.tap(captured);
    expect(multi.stage().kind).toBe('chain');
    multi.tap(second);
    expect(multi.stage()).toMatchObject({ kind: 'chain2', skippable: true });
    expect(multi.stage().tentative?.cleared).toContain(captured);
    expect(multi.tap(sqOf(1, 1))).toMatchObject({ type: 'commit', move: { chain: second, chain2: sqOf(1, 1) } });
  });

  it('磁将と魔女は効果対象または不使用を盤上で選べる', () => {
    const magnet = bare();
    const from = sqOf(4, 4);
    const to = sqOf(4, 5);
    const target = sqOf(4, 8);
    put(magnet, from, 'magnet', 'player');
    put(magnet, target, 'gold', 'enemy');
    const pull = selectorFor(magnet, from);
    pull.tap(to);
    expect(pull.stage()).toMatchObject({ kind: 'pull', skippable: true });
    expect(pull.tap(target)).toMatchObject({ type: 'commit', move: { pull: { target } } });

    const witch = bare();
    put(witch, from, 'witch', 'player');
    put(witch, sqOf(3, 4), 'gold', 'enemy');
    const stone = selectorFor(witch, from);
    stone.tap(sqOf(3, 5));
    expect(stone.stage().kind).toBe('petrify');
    expect(stone.skip()).toMatchObject({ type: 'commit', move: { petrify: null } });
  });

  it('軍師は移動後に連携する味方とその移動先を順に選べる', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const to = sqOf(3, 4);
    const ally = sqOf(3, 3);
    const escortTo = sqOf(2, 3);
    put(s, from, 'gunshi', 'player');
    put(s, ally, 'gold', 'player');
    const selector = selectorFor(s, from);
    expect(selector.tap(to)).toEqual({ type: 'stage' });
    expect(selector.stage()).toMatchObject({ kind: 'escortPiece', skippable: true });
    expect(selector.tap(ally)).toEqual({ type: 'stage' });
    expect(selector.stage()).toMatchObject({ kind: 'escortTo', skippable: false });
    expect(selector.tap(escortTo)).toMatchObject({
      type: 'commit', move: { to, escort: { from: ally, to: escortTo } },
    });
  });

  it('能力対象と自己対象能力を最初から直接選べる', () => {
    const sniper = bare();
    const from = sqOf(4, 4);
    const target = sqOf(2, 4);
    put(sniper, from, 'sniper', 'player');
    put(sniper, target, 'gold', 'enemy');
    const shot = selectorFor(sniper, from);
    expect(shot.stage().activeOptions).toContainEqual(expect.objectContaining({ target, label: '狙撃' }));
    expect(shot.tap(target)).toMatchObject({ type: 'commit', move: { kind: 'active', ability: 'snipe' } });

    const time = bare();
    put(time, from, 'tokinomiko', 'player');
    put(time, sqOf(0, 0), 'gold', 'enemy');
    const stop = selectorFor(time, from);
    expect(stop.stage().activeOptions).toContainEqual(expect.objectContaining({ target: from, selfTarget: true, label: '刻停' }));
    expect(stop.tap(from)).toEqual({ type: 'invalid' });
    const chip = selectorFor(time, from);
    expect(chip.activateSelf(from)).toMatchObject({ type: 'commit', move: { ability: 'timestop' } });
  });

  it('落雷は同じ列のどのマスをタップしても発動する', () => {
    const s = bare();
    const from = sqOf(8, 8);
    put(s, from, 'raijin', 'player');
    put(s, sqOf(0, 3), 'gold', 'enemy');
    const selector = selectorFor(s, from);
    const option = selector.stage().activeOptions.find((active) => active.label === '落雷')!;
    expect(option.lineWash).toEqual(Array.from({ length: 9 }, (_, row) => sqOf(row, 3)));
    expect(selector.tap(sqOf(8, 3))).toMatchObject({ type: 'commit', move: { ability: 'bolt', target: sqOf(0, 3) } });
  });

  it('神罰は3x3をプレビューして同じマスの再タップで確定する', () => {
    const s = bare();
    const from = sqOf(8, 8);
    const target = sqOf(4, 4);
    put(s, from, 'tenbatsu', 'player');
    put(s, target, 'gold', 'enemy');
    const selector = selectorFor(s, from);
    expect(selector.tap(target)).toEqual({ type: 'stage' });
    expect(selector.stage()).toMatchObject({ kind: 'activeConfirm' });
    expect(selector.stage().affected).toHaveLength(9);
    expect(selector.stage().confirmTarget).toBe(target);
    expect(selector.tap(target)).toMatchObject({ type: 'commit', move: { ability: 'smite', target } });

    const canceled = selectorFor(s, from);
    canceled.tap(target);
    expect(canceled.tap(sqOf(0, 0))).toEqual({ type: 'stage' });
    expect(canceled.stage().kind).toBe('destination');
  });

  it('移動先と能力対象が衝突した場合は選択を分岐できる', () => {
    const from = sqOf(4, 4);
    const target = sqOf(3, 4);
    const moves: Move[] = [
      { kind: 'move', from, to: target, promote: false },
      { kind: 'active', from, target, ability: 'execute' },
    ];
    const selector = createSelector(moves, () => null);
    expect(selector.tap(target)).toEqual({ type: 'ambiguous', sq: target });
    expect(selector.chooseAmbiguous('active')).toMatchObject({ type: 'commit', move: { ability: 'execute' } });

    const movement = createSelector(moves, () => null);
    movement.tap(target);
    expect(movement.chooseAmbiguous('move')).toMatchObject({ type: 'commit', move: { kind: 'move' } });
  });

  it('どの段階からもキャンセルして初期状態へ戻る', () => {
    const s = bare();
    const from = sqOf(4, 4);
    put(s, from, 'lion', 'player');
    const selector = selectorFor(s, from);
    selector.tap(sqOf(3, 4));
    expect(selector.stage().kind).toBe('second');
    selector.cancel();
    expect(selector.stage().kind).toBe('destination');
  });
});
