import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { sqOf } from '../src/core/types';
import { bare, put } from './helpers';

describe('顕現駒', () => {
  it('自動生成・残影・冥府の門の生成物に顕現属性が付く', () => {
    const spawn = bare(1);
    put(spawn, sqOf(4, 4), 'inari', 'player');
    const spawned = applyMove(spawn, { kind: 'pass' });
    expect(spawned.board.find((p) => p?.defId === 'silver')).toMatchObject({ conjured: true, owner: 'player' });

    const trail = bare(2);
    put(trail, sqOf(4, 4), 'zanei', 'player');
    const trailed = applyMove(trail, { kind: 'move', from: sqOf(4, 4), to: sqOf(3, 4), promote: false });
    expect(trailed.board[sqOf(4, 4)]).toMatchObject({ defId: 'pawn', conjured: true });

    const gate = bare(3);
    put(gate, sqOf(4, 4), 'meifu', 'player');
    gate.graveyard.push({ defId: 'rook', promoted: false });
    const revived = applyMove(gate, { kind: 'pass' });
    expect(revived.board.find((p) => p?.defId === 'rook')).toMatchObject({ conjured: true, owner: 'player' });
  });

  it('顕現した通常駒は捕獲されても持ち駒にならず墓地へ行く', () => {
    const s = bare();
    const target = sqOf(4, 5);
    put(s, sqOf(4, 4), 'rook', 'enemy');
    put(s, target, 'gold', 'player', { conjured: true });
    s.turn = 'enemy';
    const next = applyMove(s, { kind: 'move', from: sqOf(4, 4), to: target, promote: false });
    expect(next.hands.enemy.gold).toBeUndefined();
    expect(next.graveyard).toContainEqual({ defId: 'gold', promoted: false });
  });

  it('初期配置相当と打った通常駒は従来どおり持ち駒になる', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'rook', 'enemy');
    put(s, sqOf(4, 5), 'gold', 'player');
    s.turn = 'enemy';
    const captured = applyMove(s, { kind: 'move', from: sqOf(4, 4), to: sqOf(4, 5), promote: false });
    expect(captured.hands.enemy.gold).toBe(1);

    const drop = bare();
    drop.hands.player.pawn = 1;
    const dropped = applyMove(drop, { kind: 'drop', defId: 'pawn', to: sqOf(6, 4) });
    expect(dropped.board[sqOf(6, 4)]?.conjured).toBeUndefined();
  });
});
