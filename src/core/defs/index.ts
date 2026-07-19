import type { Piece, PieceDef } from '../types';
import { GOLD_DIRS, NORMAL_DEFS } from './normal';
import { SPECIAL_DEFS } from './special';
import { BOSS_DEFS } from './boss';

export { DROPPABLE } from './normal';
export { obtainableIds } from './special';

export const PIECE_DEFS: Record<string, PieceDef> = {};
for (const d of [...NORMAL_DEFS, ...SPECIAL_DEFS, ...BOSS_DEFS]) PIECE_DEFS[d.id] = d;

export function def(id: string): PieceDef {
  const d = PIECE_DEFS[id];
  if (!d) throw new Error(`unknown piece def: ${id}`);
  return d;
}

// promotesTo:'gold' の駒: 動きだけ金になり、能力(フック)は保持した合成defを返す
const goldCache: Record<string, PieceDef> = {};
const absorbedCache: Record<string, PieceDef> = {};

function goldPromoted(base: PieceDef): PieceDef {
  let g = goldCache[base.id];
  if (!g) {
    g = {
      ...base,
      id: `${base.id}+`,
      name: `成${base.name}`,
      moves: [{ type: 'step', dirs: GOLD_DIRS }],
      aiValue: Math.max(base.aiValue, 520),
      promotesTo: undefined,
      demotesTo: base.id,
    };
    goldCache[base.id] = g;
  }
  return g;
}

// その駒の「現在の」定義(成り考慮)
export function effectiveDef(p: Piece): PieceDef {
  const base = def(p.defId);
  let current = base;
  if (p.promoted && base.promotesTo) {
    current = base.promotesTo === 'gold' ? goldPromoted(base) : def(base.promotesTo);
  }
  if (!base.absorbMoves || !p.absorbed?.length) return current;
  const absorbed = [...new Set(p.absorbed)].sort();
  const key = `${base.id}:${p.promoted ? '1' : '0'}:${absorbed.join(',')}`;
  let composite = absorbedCache[key];
  if (!composite) {
    composite = {
      ...current,
      id: key,
      moves: [...current.moves, ...absorbed.flatMap((id) => def(id).moves)],
    };
    absorbedCache[key] = composite;
  }
  return composite;
}
