import { findBestMove } from '../ai/search';
import { applyMove } from '../core/apply';
import { findRoyals } from '../core/board';
import { def } from '../core/defs';
import { isAttacked, legalMoves, pieceMoves } from '../core/movegen';
import { stageDef } from '../core/stages';
import type { GameEvent, GameState, Move, Owner, RunState } from '../core/types';
import { renderBoard, renderHand } from './board-view';

export interface BattleActions {
  onUpdate(run: RunState): void;
  onFinished(run: RunState, winner: Owner): void;
}

function coord(sq: number): string {
  return `${9 - (sq % 9)}筋${Math.floor(sq / 9) + 1}段`;
}

function variantLabel(move: Extract<Move, { kind: 'move' }>): string {
  const parts: string[] = [];
  if (move.promote) parts.push('成る');
  else parts.push('成らない');
  if (move.second !== undefined) parts.push(move.second === null ? '1回で停止' : `2回目: ${coord(move.second)}`);
  if (move.chain !== undefined) parts.push(move.chain === null ? '追撃しない' : `追撃: ${coord(move.chain)}`);
  if (move.pull !== undefined) {
    const target = move.pull?.target;
    parts.push(target == null ? '引き寄せない' : `${coord(target)}の駒を引く`);
  }
  if (move.petrify !== undefined) parts.push(move.petrify == null ? '石化しない' : `${coord(move.petrify)}を石化`);
  return parts.join(' / ');
}

function eventText(event: GameEvent): string {
  if (event.t === 'win') return `${event.who === 'player' ? 'プレイヤー' : '敵'}の勝利`;
  const names: Record<Exclude<GameEvent['t'], 'win'>, string> = {
    capture: '捕獲', vanish: '消滅', explode: '爆発', revive: '復活', warp: 'ワープ', petrify: '石化',
    convert: '寝返り', pull: '引き寄せ', snipe: '狙撃', swap: '入れ替え',
  };
  return `${names[event.t]}: ${def(event.defId).name}`;
}

export function renderBattle(root: HTMLElement, initialRun: RunState, actions: BattleActions): () => void {
  if (!initialRun.game) throw new Error('battle screen requires a game');
  let run = initialRun;
  let selectedSq: number | null = null;
  let selectedDrop: string | null = null;
  let activeMode = false;
  let variants: Extract<Move, { kind: 'move' }>[] | null = null;
  let thinking = false;
  let disposed = false;
  let worker: Worker | null = null;
  let message = '自分の駒を選んでください。';

  const game = (): GameState => run.game!;

  const update = (next: GameState): void => {
    run = { ...run, game: next };
    actions.onUpdate(run);
  };

  const finishIfNeeded = (): boolean => {
    const winner = game().winner;
    if (!winner) return false;
    render();
    window.setTimeout(() => {
      if (!disposed) actions.onFinished(run, winner);
    }, 350);
    return true;
  };

  const apply = (move: Move): void => {
    variants = null;
    selectedSq = null;
    selectedDrop = null;
    activeMode = false;
    const next = applyMove(game(), move);
    update(next);
    message = next.events.map(eventText).join(' ・ ') || '手を進めました。';
    if (finishIfNeeded()) return;
    render();
    if (next.turn === 'enemy') void requestAiMove();
  };

  const fallbackAi = (): void => {
    if (disposed || game().turn !== 'enemy') return;
    const stage = stageDef(run.stage);
    const move = findBestMove(game(), 'enemy', Math.min(stage.depth, 3), stage.timeMs);
    thinking = false;
    apply(move);
  };

  const requestAiMove = async (): Promise<void> => {
    if (disposed || thinking || game().winner || game().turn !== 'enemy') return;
    thinking = true;
    message = '敵が思考しています…';
    render();
    const stage = stageDef(run.stage);
    const requestState = game();
    try {
      worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ move: Move }>) => {
        worker?.terminate();
        worker = null;
        if (disposed || game() !== requestState) return;
        thinking = false;
        apply(event.data.move);
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        fallbackAi();
      };
      worker.postMessage({ state: requestState, depth: stage.depth, timeMs: stage.timeMs });
    } catch {
      fallbackAi();
    }
  };

  const selectSquare = (sq: number): void => {
    if (thinking || game().turn !== 'player' || variants) return;
    if (selectedDrop) {
      const drop = legalMoves(game(), 'player').find(
        (m): m is Extract<Move, { kind: 'drop' }> => m.kind === 'drop' && m.defId === selectedDrop && m.to === sq,
      );
      if (drop) apply(drop);
      return;
    }
    if (activeMode && selectedSq !== null) {
      const active = pieceMoves(game(), selectedSq).find(
        (m): m is Extract<Move, { kind: 'active' }> => m.kind === 'active' && m.target === sq,
      );
      if (active) apply(active);
      return;
    }
    if (selectedSq !== null) {
      const candidates = pieceMoves(game(), selectedSq).filter(
        (m): m is Extract<Move, { kind: 'move' }> => m.kind === 'move' && m.to === sq,
      );
      if (candidates.length === 1) {
        apply(candidates[0]);
        return;
      }
      if (candidates.length > 1) {
        variants = candidates;
        message = 'この手の効果を選んでください。';
        render();
        return;
      }
    }
    const piece = game().board[sq];
    if (piece?.owner === 'player') {
      selectedSq = sq;
      selectedDrop = null;
      activeMode = false;
      message = `${def(piece.defId).name}を選択中`;
    } else {
      selectedSq = null;
      activeMode = false;
    }
    render();
  };

  const render = (): void => {
    if (disposed) return;
    root.innerHTML = '';
    const screen = document.createElement('section');
    screen.className = 'screen battle-screen';
    const header = document.createElement('header');
    header.className = 'battle-header';
    const stage = stageDef(run.stage);
    header.innerHTML = `<div><p class="eyebrow">BATTLE ${run.stage} / 15</p><h2>第${run.stage}面${stage.boss ? `・${def(stage.boss).name}` : ''}</h2></div>`;
    const resign = document.createElement('button');
    resign.className = 'back-button danger';
    resign.textContent = '投了';
    resign.disabled = thinking;
    resign.addEventListener('click', () => {
      if (window.confirm('このランを投了しますか？')) actions.onFinished(run, 'enemy');
    });
    header.append(resign);
    screen.append(header);

    const status = document.createElement('div');
    status.className = `battle-status${thinking ? ' thinking' : ''}`;
    const inCheck = findRoyals(game(), 'player').some((sq) => isAttacked(game(), sq, 'enemy'));
    status.innerHTML = `<strong>${thinking ? '敵の手番' : game().turn === 'player' ? 'あなたの手番' : '敵の手番'}</strong><span>${message}</span>${inCheck ? '<b>王手</b>' : ''}`;
    screen.append(status);

    const enemyHand = document.createElement('div');
    renderHand(enemyHand, game(), 'enemy', null);
    screen.append(enemyHand);

    const layout = document.createElement('div');
    layout.className = 'battle-layout';
    const board = document.createElement('div');
    const moves = selectedSq === null ? [] : pieceMoves(game(), selectedSq);
    const destinations = new Set(moves.filter((m) => m.kind === 'move').map((m) => (m as Extract<Move, { kind: 'move' }>).to));
    const targets = new Set<number>();
    if (activeMode) for (const m of moves) if (m.kind === 'active') targets.add(m.target);
    if (selectedDrop) for (const m of legalMoves(game(), 'player')) if (m.kind === 'drop' && m.defId === selectedDrop) targets.add(m.to);
    renderBoard(board, game(), { selected: selectedSq, destinations, targets, disabled: thinking, onSquare: selectSquare });
    layout.append(board);

    const side = document.createElement('aside');
    side.className = 'battle-side';
    if (selectedSq !== null) {
      const selectedPiece = game().board[selectedSq];
      if (selectedPiece) {
        const d = def(selectedPiece.defId);
        side.innerHTML = `<p class="eyebrow">SELECTED</p><h3>${d.name}</h3><p>${d.desc ?? ''}</p>`;
        const activeMoves = moves.filter((m) => m.kind === 'active');
        if (activeMoves.length) {
          const ability = document.createElement('button');
          ability.className = `menu-button ability-button${activeMode ? ' active' : ''}`;
          ability.textContent = activeMode ? '能力対象を選択中' : '能力を使う';
          ability.addEventListener('click', () => { activeMode = !activeMode; render(); });
          side.append(ability);
        }
      }
    } else {
      side.innerHTML = '<p class="eyebrow">HOW TO PLAY</p><p>自分の駒、移動先の順に選択します。駒台の駒を選ぶと「打つ」場所が光ります。</p>';
    }
    if (variants) {
      const choices = document.createElement('div');
      choices.className = 'move-choices';
      const title = document.createElement('strong');
      title.textContent = '手を選択';
      choices.append(title);
      for (const move of variants) {
        const button = document.createElement('button');
        button.textContent = variantLabel(move);
        button.addEventListener('click', () => apply(move));
        choices.append(button);
      }
      const cancel = document.createElement('button');
      cancel.className = 'cancel';
      cancel.textContent = '戻る';
      cancel.addEventListener('click', () => { variants = null; render(); });
      choices.append(cancel);
      side.append(choices);
    }
    layout.append(side);
    screen.append(layout);

    const playerHand = document.createElement('div');
    renderHand(
      playerHand,
      game(),
      'player',
      selectedDrop,
      !thinking && game().turn === 'player' ? (id) => {
        selectedDrop = selectedDrop === id ? null : id;
        selectedSq = null;
        activeMode = false;
        render();
      } : undefined,
    );
    screen.append(playerHand);
    root.append(screen);
  };

  render();
  const resumedWinner = game().winner;
  if (resumedWinner) {
    window.setTimeout(() => {
      if (!disposed) actions.onFinished(run, resumedWinner);
    }, 0);
  } else if (game().turn === 'enemy') {
    void requestAiMove();
  }
  return () => {
    disposed = true;
    worker?.terminate();
  };
}
