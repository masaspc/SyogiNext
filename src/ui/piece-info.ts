import { effectiveDef } from '../core/defs';
import { kingMovePatterns } from '../core/movegen';
import type { GameState, Piece, PieceDef } from '../core/types';

export function pieceInfoDef(state: GameState, piece: Piece): PieceDef {
  const current = effectiveDef(piece);
  return piece.defId === 'king' ? { ...current, moves: kingMovePatterns(state, piece.owner) } : current;
}
