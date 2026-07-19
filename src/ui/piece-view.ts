import { def } from '../core/defs';
import type { Dir, Owner, Piece, PieceDef } from '../core/types';

export function pieceToken(piece: Piece): HTMLElement {
  const d = piece.promoted ? (() => {
    const base = def(piece.defId);
    return base.promotesTo && base.promotesTo !== 'gold' ? def(base.promotesTo) : base;
  })() : def(piece.defId);
  const token = document.createElement('span');
  token.className = `piece-token owner-${piece.owner} rarity-${def(piece.defId).rarity ?? 'normal'}${piece.promoted ? ' promoted' : ''}${d.kanji.length > 1 ? ' long-label' : ''}`;
  token.textContent = d.kanji;
  token.title = d.name;
  return token;
}

function orient(dir: Dir, owner: Owner): Dir {
  return owner === 'player' ? dir : [-dir[0], -dir[1]];
}

export function moveDiagram(pieceDef: PieceDef, owner: Owner = 'player'): HTMLElement {
  const marks = new Map<number, string>();
  const center = 4 * 9 + 4;
  const mark = (row: number, col: number, symbol: string) => {
    if (row >= 0 && row < 9 && col >= 0 && col < 9) marks.set(row * 9 + col, symbol);
  };
  for (const pattern of pieceDef.moves) {
    if (pattern.type === 'lion') {
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        if ((dr || dc) && Math.max(Math.abs(dr), Math.abs(dc)) <= 2) mark(4 + dr, 4 + dc, '●');
      }
      continue;
    }
    const dirs = pattern.type === 'jump' ? pattern.offsets : pattern.dirs;
    for (const raw of dirs) {
      const [dy, dx] = orient(raw, owner);
      if (pattern.type === 'slide') {
        for (let n = 1; n <= (pattern.max ?? 4); n++) mark(4 + dy * n, 4 + dx * n, '•');
      } else {
        mark(4 + dy, 4 + dx, pattern.type === 'jump' ? '◆' : '●');
      }
    }
  }
  const grid = document.createElement('div');
  grid.className = 'move-diagram';
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('span');
    if (i === center) {
      cell.className = 'origin';
      cell.textContent = pieceDef.kanji;
    } else {
      cell.textContent = marks.get(i) ?? '';
    }
    grid.append(cell);
  }
  return grid;
}
