import { def } from '../core/defs';
import type { GameState, Owner } from '../core/types';
import { pieceToken } from './piece-view';

export interface BoardViewOptions {
  selected?: number | null;
  destinations?: ReadonlySet<number>;
  targets?: ReadonlySet<number>;
  inspectionDestinations?: ReadonlySet<number>;
  inspectionTargets?: ReadonlySet<number>;
  lastOrigin?: number | null;
  lastDestination?: number | null;
  lastChanged?: ReadonlySet<number>;
  disabled?: boolean;
  onSquare(sq: number): void;
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
    if (options.lastChanged?.has(sq)) cell.classList.add('last-changed');
    if (options.lastOrigin === sq) cell.classList.add('last-origin');
    if (options.lastDestination === sq) cell.classList.add('last-destination');
    const piece = state.board[sq];
    if (piece) cell.append(pieceToken(piece));
    cell.disabled = !!options.disabled;
    cell.addEventListener('click', () => options.onSquare(sq));
    container.append(cell);
  }
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
