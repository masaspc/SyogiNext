import { describe, expect, it } from 'vitest';
import { sqOf } from '../src/core/types';
import { pieceInfoDef } from '../src/ui/piece-info';
import { bare, put } from './helpers';

describe('対局中の駒情報', () => {
  it('王の動き図を通常・契約・呪いの状態に合わせる', () => {
    const s = bare();
    const king = put(s, sqOf(7, 4), 'king', 'player');
    expect(pieceInfoDef(s, king).moves).toMatchObject([{ type: 'step' }]);

    put(s, sqOf(5, 4), 'majin', 'player');
    expect(pieceInfoDef(s, king).moves).toEqual([
      expect.objectContaining({ type: 'slide', max: 2 }),
    ]);

    s.cursedKing.player = true;
    expect(pieceInfoDef(s, king).moves).toEqual([{ type: 'step', dirs: [[-1, 0]] }]);
  });
});
