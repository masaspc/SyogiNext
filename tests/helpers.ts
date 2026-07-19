import type { GameState, Owner, Piece } from '../src/core/types';
import { def } from '../src/core/defs';

// 空盤のGameState(テスト用)
export function bare(seed = 1): GameState {
  return {
    board: Array(81).fill(null),
    hands: { player: {}, enemy: {} },
    turn: 'player',
    moveCount: 0,
    petrified: {},
    bossDodgesLeft: 0,
    winner: null,
    nextPieceId: 1,
    rngState: seed,
    events: [],
  };
}

export function put(
  state: GameState,
  sq: number,
  defId: string,
  owner: Owner,
  opts: Partial<Pick<Piece, 'promoted' | 'usesLeft' | 'revived'>> = {},
): Piece {
  const d = def(defId);
  const p: Piece = {
    id: state.nextPieceId++,
    defId,
    owner,
    promoted: opts.promoted ?? false,
    ...(d.active ? { usesLeft: opts.usesLeft ?? d.active.uses } : {}),
    ...(opts.revived !== undefined ? { revived: opts.revived } : {}),
  };
  if (opts.usesLeft !== undefined) p.usesLeft = opts.usesLeft;
  state.board[sq] = p;
  return p;
}

export function tos(moves: { kind: string; to?: number }[]): number[] {
  return [...new Set(moves.filter((m) => m.kind === 'move').map((m) => (m as { to: number }).to))].sort((a, b) => a - b);
}
