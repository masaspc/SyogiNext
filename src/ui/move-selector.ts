import type { ActiveKind, Move, PieceDef } from '../core/types';
import { colOf, onBoard, rowOf, sqOf } from '../core/types';

export type StageKind =
  | 'destination'
  | 'promote'
  | 'second'
  | 'chain'
  | 'chain2'
  | 'pull'
  | 'petrify'
  | 'escortPiece'
  | 'escortTo'
  | 'activeConfirm'
  | 'done';

export interface ActiveOption {
  target: number;
  label: string;
  selfTarget: boolean;
  lineWash?: number[];
  danger?: boolean;
}

export interface SelectorStage {
  kind: StageKind;
  moveOptions: number[];
  activeOptions: ActiveOption[];
  skippable: boolean;
  tentative?: { from: number; at: number; cleared?: number[] };
  affected?: number[];
  confirmTarget?: number;
  result?: Move;
}

export type TapResult =
  | { type: 'stage' }
  | { type: 'commit'; move: Move }
  | { type: 'ambiguous'; sq: number }
  | { type: 'invalid' };

export interface Selector {
  stage(): SelectorStage;
  tap(sq: number): TapResult;
  skip(): TapResult;
  choosePromote(promote: boolean): TapResult;
  chooseAmbiguous(kind: 'move' | 'active'): TapResult;
  activateSelf(target: number): TapResult;
  cancel(): void;
}

const ABILITY_LABELS: Record<ActiveKind, string> = {
  warp: '隠密', kingSwap: '影武者', snipe: '狙撃', convert: '寝返り', bolt: '落雷', gale: '突風',
  timestop: '刻停', execute: '断罪', ohabari: '十拳剣', apocalypse: '終焉', smite: '神罰',
  shockwave: '波動球', boardFlip: '天地返し',
};

const DANGEROUS = new Set<ActiveKind>(['smite', 'apocalypse']);

function unique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function lineWash(move: Extract<Move, { kind: 'active' }>): number[] | undefined {
  if (move.ability === 'bolt') return Array.from({ length: 9 }, (_, row) => sqOf(row, colOf(move.target)));
  if (move.ability === 'gale') return Array.from({ length: 9 }, (_, col) => sqOf(rowOf(move.target), col));
  return undefined;
}

function affectedSquares(move: Extract<Move, { kind: 'active' }>): number[] {
  if (move.ability === 'apocalypse') return Array.from({ length: 81 }, (_, sq) => sq);
  if (move.ability !== 'smite') return [move.target];
  const affected: number[] = [];
  const centerRow = rowOf(move.target);
  const centerCol = colOf(move.target);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (onBoard(centerRow + dr, centerCol + dc)) affected.push(sqOf(centerRow + dr, centerCol + dc));
  }
  return affected;
}

export function createSelector(
  moves: Move[],
  _defOf: (sq: number) => PieceDef | null,
): Selector {
  const all = moves.filter((move) => move.kind === 'move' || move.kind === 'active');
  let candidates: Extract<Move, { kind: 'move' }>[] = [];
  let current: SelectorStage;
  let ambiguous: { sq: number; moves: Extract<Move, { kind: 'move' }>[]; actives: Extract<Move, { kind: 'active' }>[] } | null = null;
  let confirm: { tapped: number; move: Extract<Move, { kind: 'active' }> } | null = null;
  let escortFrom: number | null = null;
  let resolved = new Set<string>();

  const initialStage = (): SelectorStage => {
    const boardMoves = all.filter((move): move is Extract<Move, { kind: 'move' }> => move.kind === 'move');
    const activeMoves = all.filter((move): move is Extract<Move, { kind: 'active' }> => move.kind === 'active');
    return {
      kind: 'destination',
      moveOptions: unique(boardMoves.map((move) => move.to)),
      activeOptions: activeMoves.map((move) => ({
        target: move.target,
        label: ABILITY_LABELS[move.ability],
        selfTarget: move.target === move.from,
        lineWash: lineWash(move),
        danger: DANGEROUS.has(move.ability),
      })),
      skippable: false,
    };
  };

  const commit = (move: Move): TapResult => {
    current = { kind: 'done', moveOptions: [], activeOptions: [], skippable: false, result: move };
    return { type: 'commit', move };
  };

  const tentative = (at?: number): { from: number; at: number; cleared?: number[] } | undefined => {
    const move = candidates[0];
    if (!move) return undefined;
    const currentAt = at ?? move.chain ?? move.second ?? move.to;
    const cleared = [move.to, ...(move.chain != null ? [move.chain] : [])].filter((sq) => sq !== currentAt);
    return { from: move.from, at: currentAt, ...(cleared.length ? { cleared } : {}) };
  };

  const advance = (): TapResult => {
    if (!candidates.length) return { type: 'invalid' };

    const promoteValues = [...new Set(candidates.map((move) => move.promote))];
    if (promoteValues.length > 1) {
      current = { kind: 'promote', moveOptions: [], activeOptions: [], skippable: false };
      return { type: 'stage' };
    }

    for (const field of ['second', 'chain', 'chain2'] as const) {
      if (resolved.has(field)) continue;
      const values = candidates.map((move) => move[field]).filter((value) => value !== undefined);
      if (!values.length) continue;
      const options = unique(values.filter((value): value is number => value !== null));
      const skippable = values.includes(null);
      if (options.length || skippable) {
        current = {
          kind: field,
          moveOptions: options,
          activeOptions: [],
          skippable,
          tentative: tentative(field === 'chain2' ? candidates[0].chain ?? candidates[0].to : candidates[0].to),
        };
        return { type: 'stage' };
      }
    }

    for (const field of ['pull', 'petrify'] as const) {
      if (resolved.has(field)) continue;
      const values = candidates.map((move) => move[field]).filter((value) => value !== undefined);
      if (!values.length) continue;
      const options = unique(values.flatMap((value) => {
        if (value === null) return [];
        return [typeof value === 'number' ? value : value.target];
      }));
      const skippable = values.includes(null);
      if (options.length || skippable) {
        current = { kind: field, moveOptions: options, activeOptions: [], skippable, tentative: tentative() };
        return { type: 'stage' };
      }
    }

    const escortValues = resolved.has('escort') ? [] : candidates.map((move) => move.escort).filter((value) => value !== undefined);
    if (escortValues.length) {
      if (escortFrom === null) {
        const options = unique(escortValues.flatMap((value) => value ? [value.from] : []));
        current = {
          kind: 'escortPiece', moveOptions: options, activeOptions: [],
          skippable: escortValues.includes(null), tentative: tentative(),
        };
        return { type: 'stage' };
      }
      const options = unique(escortValues.flatMap((value) => value?.from === escortFrom ? [value.to] : []));
      current = { kind: 'escortTo', moveOptions: options, activeOptions: [], skippable: false, tentative: tentative() };
      return { type: 'stage' };
    }

    return commit(candidates[0]);
  };

  const chooseActive = (move: Extract<Move, { kind: 'active' }>, tapped: number): TapResult => {
    if (DANGEROUS.has(move.ability)) {
      confirm = { tapped, move };
      current = {
        kind: 'activeConfirm', moveOptions: [], activeOptions: [], skippable: false,
        affected: affectedSquares(move), confirmTarget: move.target,
      };
      return { type: 'stage' };
    }
    return commit(move);
  };

  const matchingActives = (sq: number): Extract<Move, { kind: 'active' }>[] => all
    .filter((move): move is Extract<Move, { kind: 'active' }> => move.kind === 'active')
    .filter((move) => (move.target !== move.from && move.target === sq) || lineWash(move)?.includes(sq));

  const reset = (): void => {
    candidates = [];
    ambiguous = null;
    confirm = null;
    escortFrom = null;
    resolved = new Set<string>();
    current = initialStage();
  };

  current = initialStage();

  return {
    stage: () => current,
    tap(sq: number): TapResult {
      if (current.kind === 'activeConfirm' && confirm) {
        if (sq === confirm.tapped) return commit(confirm.move);
        reset();
        return { type: 'stage' };
      }
      if (current.kind === 'destination') {
        const moveMatches = all.filter((move): move is Extract<Move, { kind: 'move' }> => move.kind === 'move' && move.to === sq);
        const activeMatches = matchingActives(sq);
        if (moveMatches.length && activeMatches.length) {
          ambiguous = { sq, moves: moveMatches, actives: activeMatches };
          return { type: 'ambiguous', sq };
        }
        if (activeMatches.length) return chooseActive(activeMatches[0], sq);
        if (moveMatches.length) {
          candidates = moveMatches;
          return advance();
        }
        reset();
        return { type: 'invalid' };
      }
      if (current.kind === 'promote') return { type: 'invalid' };
      if (current.kind === 'second' || current.kind === 'chain' || current.kind === 'chain2') {
        const field = current.kind;
        const filtered = candidates.filter((move) => move[field] === sq);
        if (!filtered.length) { reset(); return { type: 'invalid' }; }
        candidates = filtered;
        resolved.add(field);
        return advance();
      }
      if (current.kind === 'pull' || current.kind === 'petrify') {
        const field = current.kind;
        const filtered = candidates.filter((move) => field === 'pull' ? move.pull?.target === sq : move.petrify === sq);
        if (!filtered.length) { reset(); return { type: 'invalid' }; }
        candidates = filtered;
        resolved.add(field);
        return advance();
      }
      if (current.kind === 'escortPiece') {
        const filtered = candidates.filter((move) => move.escort?.from === sq);
        if (!filtered.length) { reset(); return { type: 'invalid' }; }
        escortFrom = sq;
        candidates = filtered;
        return advance();
      }
      if (current.kind === 'escortTo') {
        const filtered = candidates.filter((move) => move.escort?.from === escortFrom && move.escort.to === sq);
        if (!filtered.length) { reset(); return { type: 'invalid' }; }
        candidates = filtered;
        const selected = candidates[0];
        return commit(selected);
      }
      return { type: 'invalid' };
    },
    skip(): TapResult {
      if (!current.skippable) return { type: 'invalid' };
      if (current.kind === 'second' || current.kind === 'chain' || current.kind === 'chain2') {
        const field = current.kind;
        resolved.add(field);
        candidates = candidates.filter((move) => move[field] === null);
      } else if (current.kind === 'pull' || current.kind === 'petrify') {
        const field = current.kind;
        resolved.add(field);
        candidates = candidates.filter((move) => move[field] === null);
      } else if (current.kind === 'escortPiece') {
        resolved.add('escort');
        candidates = candidates.filter((move) => move.escort === null);
      } else return { type: 'invalid' };
      return advance();
    },
    choosePromote(promote: boolean): TapResult {
      if (current.kind !== 'promote') return { type: 'invalid' };
      candidates = candidates.filter((move) => move.promote === promote);
      return advance();
    },
    chooseAmbiguous(kind: 'move' | 'active'): TapResult {
      if (!ambiguous) return { type: 'invalid' };
      const pending = ambiguous;
      ambiguous = null;
      if (kind === 'active') return chooseActive(pending.actives[0], pending.sq);
      candidates = pending.moves;
      return advance();
    },
    activateSelf(target: number): TapResult {
      if (current.kind !== 'destination') return { type: 'invalid' };
      const move = all.find((candidate): candidate is Extract<Move, { kind: 'active' }> => candidate.kind === 'active'
        && candidate.target === target
        && candidate.target === candidate.from);
      return move ? chooseActive(move, target) : { type: 'invalid' };
    },
    cancel: reset,
  };
}
