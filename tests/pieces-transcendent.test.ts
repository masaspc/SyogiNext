import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/apply';
import { pieceMoves } from '../src/core/movegen';
import { sqOf, type GameState, type Move } from '../src/core/types';
import { bare, put, tos } from './helpers';

function activeAt(state: GameState, from: number, ability: Extract<Move, { kind: 'active' }>['ability'], target?: number) {
  return pieceMoves(state, from).find(
    (move): move is Extract<Move, { kind: 'active' }> => move.kind === 'active'
      && move.ability === ability
      && (target === undefined || move.target === target),
  )!;
}

function nextTurnFor(state: GameState, owner: 'player' | 'enemy'): GameState {
  let next = state;
  do next = applyMove(next, { kind: 'pass' }); while (!next.winner && next.turn !== owner);
  return next;
}

describe('輪廻', () => {
  it('盤端を越えて反対側へ抜け、一周して自身には戻らない', () => {
    const s = bare();
    const from = sqOf(4, 8);
    put(s, from, 'rinne', 'player');
    const destinations = tos(pieceMoves(s, from));
    expect(destinations).toContain(sqOf(4, 0));
    expect(destinations).toContain(sqOf(0, 8));
    expect(destinations).not.toContain(from);
  });

  it('反対側へ抜けた後も途中の敵で捕獲停止する', () => {
    const s = bare();
    const from = sqOf(4, 8);
    put(s, from, 'rinne', 'player');
    put(s, sqOf(4, 7), 'gold', 'player');
    put(s, sqOf(4, 1), 'gold', 'enemy');
    const destinations = tos(pieceMoves(s, from));
    expect(destinations).toContain(sqOf(4, 0));
    expect(destinations).toContain(sqOf(4, 1));
    expect(destinations).not.toContain(sqOf(4, 2));
  });
});

describe('天下人', () => {
  it('5五で自分の手番終了を3回迎えると勝利する', () => {
    let s = bare();
    put(s, sqOf(4, 4), 'tenkabito', 'player');
    s = nextTurnFor(s, 'player');
    expect(s.board[sqOf(4, 4)]?.throneCount).toBe(1);
    s = nextTurnFor(s, 'player');
    expect(s.board[sqOf(4, 4)]?.throneCount).toBe(2);
    s = applyMove(s, { kind: 'pass' });
    expect(s.winner).toBe('player');
    expect(s.events.some((event) => event.t === 'throne')).toBe(true);
  });

  it('中央から離れて手番を終えるとカウントが0へ戻る', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'tenkabito', 'player', { throneCount: 2 });
    const next = applyMove(s, { kind: 'move', from: sqOf(4, 4), to: sqOf(4, 5), promote: false });
    expect(next.board[sqOf(4, 5)]?.throneCount).toBe(0);
    expect(next.winner).toBeNull();
  });

  it('敵側も同じ条件で勝利する', () => {
    const s = bare();
    s.turn = 'enemy';
    put(s, sqOf(4, 4), 'tenkabito', 'enemy', { throneCount: 2 });
    expect(applyMove(s, { kind: 'pass' }).winner).toBe('enemy');
  });
});

describe('写し身', () => {
  it('捕獲した基礎駒の動きを永続習得し、重複登録しない', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'utsushimi', 'player');
    put(s, sqOf(3, 3), 'knight', 'enemy');
    let next = applyMove(s, { kind: 'move', from: sqOf(4, 4), to: sqOf(3, 3), promote: false });
    expect(next.board[sqOf(3, 3)]?.absorbed).toEqual(['knight']);
    expect(tos(pieceMoves(next, sqOf(3, 3)))).toContain(sqOf(1, 2));

    next.turn = 'player';
    put(next, sqOf(2, 2), 'knight', 'enemy');
    next = applyMove(next, { kind: 'move', from: sqOf(3, 3), to: sqOf(2, 2), promote: false });
    expect(next.board[sqOf(2, 2)]?.absorbed).toEqual(['knight']);
  });
});

describe('波動', () => {
  it('直線上の敵を遠い順に盤端へ押し詰める', () => {
    const s = bare();
    const from = sqOf(4, 0);
    put(s, from, 'hadou', 'player');
    put(s, sqOf(4, 2), 'pawn', 'enemy');
    put(s, sqOf(4, 4), 'silver', 'enemy');
    put(s, sqOf(4, 6), 'gold', 'enemy');
    const next = applyMove(s, activeAt(s, from, 'shockwave', sqOf(4, 1)));
    expect([6, 7, 8].map((col) => next.board[sqOf(4, col)]?.defId)).toEqual(['pawn', 'silver', 'gold']);
    expect(next.board[from]?.usesLeft).toBe(1);
  });

  it('味方とロイヤルは押されず壁になる', () => {
    const s = bare();
    const from = sqOf(4, 0);
    put(s, from, 'hadou', 'player');
    put(s, sqOf(4, 3), 'pawn', 'enemy');
    put(s, sqOf(4, 5), 'king', 'enemy');
    put(s, sqOf(4, 7), 'gold', 'player');
    const next = applyMove(s, activeAt(s, from, 'shockwave', sqOf(4, 1)));
    expect(next.board[sqOf(4, 4)]?.defId).toBe('pawn');
    expect(next.board[sqOf(4, 5)]?.defId).toBe('king');
    expect(next.board[sqOf(4, 7)]?.defId).toBe('gold');
  });
});

describe('後の先', () => {
  it('敵手番終了時、利きにいる最高価値の敵を自動捕獲して持ち駒にする', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'gonosen', 'enemy');
    put(s, sqOf(3, 4), 'pawn', 'player');
    put(s, sqOf(4, 6), 'rook', 'player');
    const next = applyMove(s, { kind: 'move', from: sqOf(4, 6), to: sqOf(4, 5), promote: false });
    expect(next.board[sqOf(4, 5)]?.defId).toBe('gonosen');
    expect(next.hands.enemy.rook).toBe(1);
    expect(next.events.some((event) => event.t === 'counter')).toBe(true);
  });

  it('石化中は不発で、ロイヤルは対象にしない', () => {
    const s = bare();
    const counter = put(s, sqOf(4, 4), 'gonosen', 'enemy');
    s.petrified[counter.id] = 1;
    put(s, sqOf(4, 5), 'rook', 'player');
    put(s, sqOf(3, 4), 'king', 'player');
    const next = applyMove(s, { kind: 'pass' });
    expect(next.board[sqOf(4, 4)]?.defId).toBe('gonosen');
    expect(next.board[sqOf(4, 5)]?.defId).toBe('rook');
  });
});

describe('軍師・天地返し・未来視', () => {
  it('軍師は移動後に隣接味方を1歩連携移動させ、捕獲できる', () => {
    const s = bare();
    const from = sqOf(4, 4);
    const to = sqOf(3, 4);
    const ally = sqOf(3, 3);
    const escortTo = sqOf(2, 3);
    put(s, from, 'gunshi', 'player');
    put(s, ally, 'gold', 'player');
    put(s, escortTo, 'silver', 'enemy');
    const move = pieceMoves(s, from).find((m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move'
      && m.to === to && m.escort?.from === ally && m.escort.to === escortTo)!;
    expect(move).toBeTruthy();
    const next = applyMove(s, move);
    expect(next.board[to]?.defId).toBe('gunshi');
    expect(next.board[escortTo]).toMatchObject({ defId: 'gold', promoted: false });
    expect(next.hands.player.silver).toBe(1);
  });

  it('天地返しは全駒を点対称へ移し、成り状態を保つ', () => {
    const s = bare();
    const from = sqOf(8, 8);
    put(s, from, 'tenchigaeshi', 'player');
    put(s, sqOf(2, 3), 'silver', 'enemy', { promoted: true });
    const next = applyMove(s, activeAt(s, from, 'boardFlip'));
    expect(next.board[sqOf(0, 0)]?.defId).toBe('tenchigaeshi');
    expect(next.board[80 - sqOf(2, 3)]).toMatchObject({ defId: 'silver', promoted: true });
  });

  it('未来視タグは合法手と手の適用を変更しない', () => {
    const s = bare();
    const from = sqOf(4, 4);
    put(s, from, 'miraishi', 'player');
    expect(tos(pieceMoves(s, from))).toEqual([
      sqOf(0, 0), sqOf(0, 8), sqOf(1, 1), sqOf(1, 7), sqOf(2, 2), sqOf(2, 6), sqOf(3, 3), sqOf(3, 5),
      sqOf(5, 3), sqOf(5, 5), sqOf(6, 2), sqOf(6, 6), sqOf(7, 1), sqOf(7, 7), sqOf(8, 0), sqOf(8, 8),
    ].sort((a, b) => a - b));
    expect(() => applyMove(s, { kind: 'move', from, to: sqOf(3, 3), promote: false })).not.toThrow();
  });
});
