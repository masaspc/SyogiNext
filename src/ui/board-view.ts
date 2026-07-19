import { def } from '../core/defs';
import type { GameState, Owner } from '../core/types';
import { pieceToken } from './piece-view';

export interface BoardViewOptions {
  selected?: number | null;
  destinations?: ReadonlySet<number>;
  targets?: ReadonlySet<number>;
  inspectionDestinations?: ReadonlySet<number>;
  inspectionTargets?: ReadonlySet<number>;
  secondary?: ReadonlySet<number>;
  effects?: ReadonlySet<number>;
  wash?: ReadonlySet<number>;
  blast?: ReadonlySet<number>;
  captures?: ReadonlySet<number>;
  tentative?: { from: number; at: number; cleared?: number[] };
  blastCenter?: number | null;
  foresightOrigin?: number | null;
  foresightDestination?: number | null;
  lastOrigin?: number | null;
  lastDestination?: number | null;
  lastChanged?: ReadonlySet<number>;
  disabled?: boolean;
  onSquare(sq: number): void;
}

export interface BoardChip {
  label: string;
  style: 'promote' | 'skip' | 'ability' | 'choice';
  onTap(): void;
}

export function renderBoard(container: HTMLElement, state: GameState, options: BoardViewOptions): void {
  container.innerHTML = '';
  container.className = 'shogi-board';
  for (let sq = 0; sq < 81; sq++) {
    const cell = document.createElement('button');
    cell.className = 'board-square';
    cell.dataset.sq = String(sq);
    cell.ariaLabel = `${Math.floor(sq / 9) + 1}段 ${sq % 9 + 1}列`;
    if (options.selected === sq) cell.classList.add('selected');
    if (options.destinations?.has(sq)) cell.classList.add('destination');
    if (options.targets?.has(sq)) cell.classList.add('ability-target');
    if (options.inspectionDestinations?.has(sq)) cell.classList.add('inspection-destination');
    if (options.inspectionTargets?.has(sq)) cell.classList.add('inspection-target');
    if (options.secondary?.has(sq)) cell.classList.add('secondary-target');
    if (options.effects?.has(sq)) cell.classList.add('effect-target');
    if (options.wash?.has(sq)) cell.classList.add('ability-wash');
    if (options.blast?.has(sq)) cell.classList.add('blast-preview');
    if (options.blastCenter === sq) cell.classList.add('blast-center');
    if (options.captures?.has(sq)) cell.classList.add('capture-target');
    if (options.foresightOrigin === sq) cell.classList.add('foresight-origin');
    if (options.foresightDestination === sq) cell.classList.add('foresight-destination');
    if (options.lastChanged?.has(sq)) cell.classList.add('last-changed');
    if (options.lastOrigin === sq) cell.classList.add('last-origin');
    if (options.lastDestination === sq) cell.classList.add('last-destination');
    const tentativePiece = options.tentative ? state.board[options.tentative.from] : null;
    const piece = state.board[sq];
    if (options.tentative && sq === options.tentative.at && tentativePiece) {
      const token = pieceToken(tentativePiece);
      token.classList.add('tentative-piece');
      cell.classList.add('tentative-square');
      cell.append(token);
    } else if (piece && !options.tentative?.cleared?.includes(sq)) {
      const token = pieceToken(piece);
      if (options.tentative && sq === options.tentative.from) token.classList.add('piece-ghost');
      cell.append(token);
    }
    cell.disabled = !!options.disabled;
    cell.addEventListener('click', () => options.onSquare(sq));
    container.append(cell);
  }
}

export function renderChips(container: HTMLElement, sq: number, chips: BoardChip[]): void {
  const cell = container.querySelector<HTMLElement>(`.board-square[data-sq="${sq}"]`);
  if (!cell || !chips.length) return;
  container.classList.add('has-board-chips');
  const tray = document.createElement('span');
  tray.className = 'board-chip-tray';
  for (const chip of chips) {
    const button = document.createElement('span');
    button.role = 'button';
    button.tabIndex = 0;
    button.className = `board-chip chip-${chip.style}`;
    button.textContent = chip.label;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      chip.onTap();
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      chip.onTap();
    });
    tray.append(button);
  }
  cell.append(tray);
}

export function renderHand(
  container: HTMLElement,
  state: GameState,
  owner: Owner,
  selected: string | null,
  onSelect?: (defId: string) => void,
): void {
  container.innerHTML = '';
  container.className = `piece-hand hand-${owner}`;
  const label = document.createElement('strong');
  label.textContent = owner === 'player' ? '自分の駒台' : '敵の駒台';
  container.append(label);
  const entries = Object.entries(state.hands[owner]).filter(([, count]) => count > 0);
  if (!entries.length) {
    const empty = document.createElement('span');
    empty.className = 'empty-hand';
    empty.textContent = '—';
    container.append(empty);
  }
  for (const [id, count] of entries) {
    const button = document.createElement('button');
    button.className = `hand-piece${selected === id ? ' selected' : ''}`;
    button.innerHTML = `<span>${def(id).kanji}</span><small>×${count}</small>`;
    button.disabled = !onSelect;
    if (onSelect) button.addEventListener('click', () => onSelect(id));
    container.append(button);
  }
}
