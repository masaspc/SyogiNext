import type { GameState, Owner, Piece } from './types';
import { onBoard, rowOf, colOf, sqOf } from './types';
import { def } from './defs';

export function forward(owner: Owner): number {
  return owner === 'player' ? -1 : 1;
}

export function inCamp(owner: Owner, sq: number): boolean {
  const row = rowOf(sq);
  return owner === 'player' ? row >= 6 : row <= 2;
}

export function inPromoZone(owner: Owner, sq: number): boolean {
  const row = rowOf(sq);
  return owner === 'player' ? row <= 2 : row >= 6;
}

// 各マスの隣接(周囲8)マス
export const ADJ: readonly number[][] = Array.from({ length: 81 }, (_, sq) => {
  const out: number[] = [];
  const r = rowOf(sq);
  const c = colOf(sq);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      if (onBoard(r + dr, c + dc)) out.push(sqOf(r + dr, c + dc));
    }
  }
  return out;
});

// 通常将棋の初期配置(各ownerの「初期マス→defId」)。col0=画面左。
// player(下側): 飛=row7,col7 / 角=row7,col1。enemyは180度回転。
export function initialSquares(owner: Owner): Record<number, string> {
  const backRank = ['lance', 'knight', 'silver', 'gold', 'king', 'gold', 'silver', 'knight', 'lance'];
  const out: Record<number, string> = {};
  if (owner === 'player') {
    backRank.forEach((id, c) => (out[sqOf(8, c)] = id));
    out[sqOf(7, 1)] = 'bishop';
    out[sqOf(7, 7)] = 'rook';
    for (let c = 0; c < 9; c++) out[sqOf(6, c)] = 'pawn';
  } else {
    backRank.forEach((id, c) => (out[sqOf(0, c)] = id));
    out[sqOf(1, 1)] = 'rook';
    out[sqOf(1, 7)] = 'bishop';
    for (let c = 0; c < 9; c++) out[sqOf(2, c)] = 'pawn';
  }
  return out;
}

function makePiece(id: number, defId: string, owner: Owner): Piece {
  const d = def(defId);
  const p: Piece = { id, defId, owner, promoted: false };
  if (d.active) p.usesLeft = d.active.uses;
  return p;
}

// formation/enemySetup: 初期マスの駒を特殊駒に差し替える(§4.2/§5)
export function newGame(
  formation: Record<number, string>,
  enemySetup: Record<number, string>,
  seed: number,
): GameState {
  const board: (Piece | null)[] = Array(81).fill(null);
  let nextId = 1;
  let bossDodges = 0;
  for (const owner of ['player', 'enemy'] as Owner[]) {
    const setup = initialSquares(owner);
    const overrides = owner === 'player' ? formation : enemySetup;
    for (const [sqStr, baseId] of Object.entries(setup)) {
      const sq = Number(sqStr);
      const defId = overrides[sq] ?? baseId;
      const piece = makePiece(nextId++, defId, owner);
      board[sq] = piece;
      const d = def(defId);
      if (owner === 'enemy' && d.dodge) bossDodges = d.dodge;
    }
  }
  return {
    board,
    hands: { player: {}, enemy: {} },
    turn: 'player',
    moveCount: 0,
    petrified: {},
    graveyard: [],
    cursedKing: { player: false, enemy: false },
    bossDodgesLeft: bossDodges,
    winner: null,
    nextPieceId: nextId,
    rngState: seed,
    events: [],
  };
}

export function findRoyals(state: GameState, owner: Owner): number[] {
  const out: number[] = [];
  for (let sq = 0; sq < 81; sq++) {
    const p = state.board[sq];
    if (p && p.owner === owner) {
      const base = def(p.defId);
      const d = p.promoted && base.promotesTo && base.promotesTo !== 'gold' ? def(base.promotesTo) : base;
      if (d.isRoyal) out.push(sq);
    }
  }
  return out;
}
