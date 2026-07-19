import { describe, it, expect } from 'vitest';
import { pieceMoves } from '../src/core/movegen';
import { sqOf } from '../src/core/types';
import { bare, put, tos } from './helpers';

const C = sqOf(4, 4); // 中央

function movesAt(defId: string, opts: { promoted?: boolean } = {}) {
  const s = bare();
  put(s, C, defId, 'player', opts);
  return tos(pieceMoves(s, C));
}

describe('コモン特殊駒の動き', () => {
  it('仲人: 前後1', () => {
    expect(movesAt('chunin')).toEqual([sqOf(3, 4), sqOf(5, 4)]);
  });
  it('石将: 斜め前2方向', () => {
    expect(movesAt('sekisho')).toEqual([sqOf(3, 3), sqOf(3, 5)]);
  });
  it('鉄将: 前3方向', () => {
    expect(movesAt('tessho')).toEqual([sqOf(3, 3), sqOf(3, 4), sqOf(3, 5)]);
  });
  it('銅将: 前3方向+真後ろ', () => {
    expect(movesAt('dosho')).toEqual([sqOf(3, 3), sqOf(3, 4), sqOf(3, 5), sqOf(5, 4)]);
  });
  it('犬: 前+斜め後ろ、成ると狼(前後+斜め前)', () => {
    expect(movesAt('dog')).toEqual([sqOf(3, 4), sqOf(5, 3), sqOf(5, 5)]);
    expect(movesAt('dog', { promoted: true })).toEqual([sqOf(3, 3), sqOf(3, 4), sqOf(3, 5), sqOf(5, 4)]);
  });
  it('兎: 前1+斜め前2ジャンプ', () => {
    expect(movesAt('rabbit')).toEqual([sqOf(2, 2), sqOf(2, 6), sqOf(3, 4)]);
  });
  it('弓兵: 前1または前2ジャンプ、成ると大弓', () => {
    expect(movesAt('archer')).toEqual([sqOf(2, 4), sqOf(3, 4)]);
    expect(movesAt('archer', { promoted: true })).toEqual(
      [sqOf(2, 4), sqOf(3, 3), sqOf(3, 4), sqOf(3, 5), sqOf(4, 3), sqOf(4, 5)].sort((a, b) => a - b),
    );
  });
  it('土竜: 前後1', () => {
    expect(movesAt('mole')).toEqual([sqOf(3, 4), sqOf(5, 4)]);
  });
  it('木将: 斜め4方向', () => {
    expect(movesAt('mokusho')).toEqual(
      [sqOf(3, 3), sqOf(3, 5), sqOf(5, 3), sqOf(5, 5)].sort((a, b) => a - b),
    );
  });
  it('旗兵: 前+横', () => {
    expect(movesAt('kihei')).toEqual([sqOf(3, 4), sqOf(4, 3), sqOf(4, 5)]);
  });
});

describe('コモン特殊駒の能力', () => {
  it('弓兵は間の駒を飛び越えて捕獲できる', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'archer', 'player');
    put(s, sqOf(3, 4), 'pawn', 'enemy'); // 目の前(取れる)
    put(s, sqOf(2, 4), 'silver', 'enemy'); // 2マス先(跳んで取れる)
    const dests = tos(pieceMoves(s, sqOf(4, 4)));
    expect(dests).toContain(sqOf(3, 4));
    expect(dests).toContain(sqOf(2, 4));
  });

  it('土竜は生駒の歩・香から取られないが、と金からは取られる', () => {
    const s = bare();
    put(s, sqOf(4, 4), 'mole', 'enemy');
    put(s, sqOf(5, 4), 'pawn', 'player'); // 歩の利きに土竜
    expect(tos(pieceMoves(s, sqOf(5, 4)))).toEqual([]); // 取れない(前が塞がれ動けない)
    const s2 = bare();
    put(s2, sqOf(4, 4), 'mole', 'enemy');
    put(s2, sqOf(8, 4), 'lance', 'player');
    const dests = tos(pieceMoves(s2, sqOf(8, 4)));
    expect(dests).not.toContain(sqOf(4, 4)); // 香も取れない(手前まで)
    expect(dests).toContain(sqOf(5, 4));
    const s3 = bare();
    put(s3, sqOf(4, 4), 'mole', 'enemy');
    put(s3, sqOf(5, 4), 'pawn', 'player', { promoted: true }); // と金
    expect(tos(pieceMoves(s3, sqOf(5, 4)))).toContain(sqOf(4, 4));
  });

  it('石将・鉄将・兎・弓兵は行き所がなくなると強制成り', () => {
    for (const defId of ['sekisho', 'tessho', 'rabbit', 'archer']) {
      const s = bare();
      put(s, sqOf(1, 4), defId, 'player');
      const ms = pieceMoves(s, sqOf(1, 4)).filter((m) => m.kind === 'move' && m.to < 9);
      expect(ms.length).toBeGreaterThan(0);
      expect(ms.every((m) => (m as { promote: boolean }).promote)).toBe(true);
    }
  });

  it('金成りしたコモン駒は金の動きで能力を保持する', () => {
    // 成り土竜: 動きは金、歩から取られない能力は保持(§3.3)
    const s = bare();
    put(s, sqOf(4, 4), 'mole', 'enemy', { promoted: true });
    put(s, sqOf(5, 4), 'pawn', 'player');
    expect(tos(pieceMoves(s, sqOf(5, 4)))).toEqual([]);
    const s2 = bare();
    put(s2, sqOf(4, 4), 'mole', 'player', { promoted: true });
    const dests = tos(pieceMoves(s2, sqOf(4, 4)));
    expect(dests.length).toBe(6); // 金の動き
  });
});
