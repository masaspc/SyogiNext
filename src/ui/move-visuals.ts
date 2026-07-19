import { def } from '../core/defs';
import type { GameEvent, GameState, Move } from '../core/types';

export interface MoveVisual {
  origin: number | null;
  destination: number | null;
  changed: Set<number>;
  historyLabel: string;
}

function coord(sq: number): string {
  return `${9 - (sq % 9)}筋${Math.floor(sq / 9) + 1}段`;
}

function effectNames(events: GameEvent[]): string[] {
  const labels: Partial<Record<GameEvent['t'], string>> = {
    capture: '捕獲', vanish: '消滅', explode: '爆発', revive: '復活', warp: 'ワープ',
    petrify: '石化', convert: '寝返り', pull: '引寄', snipe: '狙撃', swap: '交換', win: '勝利',
    bolt: '落雷', gale: '突風', timestop: '刻停', execute: '断罪', devour: '捕食', spawn: '生成',
  };
  return [...new Set(events.map((event) => labels[event.t]).filter((label): label is string => !!label))];
}

export function createMoveVisual(before: GameState, move: Move, after: GameState): MoveVisual {
  const changed = new Set<number>();
  for (let sq = 0; sq < 81; sq++) {
    const oldPiece = before.board[sq];
    const newPiece = after.board[sq];
    if (oldPiece?.id !== newPiece?.id || oldPiece?.promoted !== newPiece?.promoted || oldPiece?.owner !== newPiece?.owner) {
      changed.add(sq);
    }
  }

  const actor = before.turn === 'player' ? '▲' : '△';
  const effects = effectNames(after.events);
  const suffix = effects.length ? `［${effects.join('・')}］` : '';
  if (move.kind === 'drop') {
    return {
      origin: null,
      destination: move.to,
      changed,
      historyLabel: `${actor}${coord(move.to)} ${def(move.defId).name}打${suffix}`,
    };
  }
  if (move.kind === 'pass') {
    return { origin: null, destination: null, changed, historyLabel: `${actor}パス${suffix}` };
  }
  const piece = before.board[move.from];
  const pieceName = piece ? def(piece.defId).name : '駒';
  if (move.kind === 'active') {
    const abilityNames = {
      warp: 'ワープ', kingSwap: '王交換', snipe: '狙撃', convert: '寝返り', bolt: '落雷', gale: '突風',
      timestop: '刻停', execute: '断罪', ohabari: '十拳剣',
    } as const;
    return {
      origin: move.from,
      destination: move.target,
      changed,
      historyLabel: `${actor}${pieceName} ${abilityNames[move.ability]}→${coord(move.target)}${suffix}`,
    };
  }
  const destination = move.chain ?? move.second ?? move.to;
  return {
    origin: move.from,
    destination,
    changed,
    historyLabel: `${actor}${pieceName} ${coord(move.from)}→${coord(destination)}${move.promote ? ' 成' : ''}${suffix}`,
  };
}
