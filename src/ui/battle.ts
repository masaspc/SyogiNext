import { findBestMove } from '../ai/search';
import { applyMove } from '../core/apply';
import { findRoyals } from '../core/board';
import { def, effectiveDef } from '../core/defs';
import { isAttacked, legalMoves, pieceMoves } from '../core/movegen';
import { stageDef } from '../core/stages';
import type { GameEvent, GameState, Move, Owner, RunState } from '../core/types';
import { renderBoard, renderChips, renderHand, type BoardChip } from './board-view';
import { createMoveVisual, type MoveVisual } from './move-visuals';
import { moveDiagram } from './piece-view';
import { pieceInfoDef } from './piece-info';
import { showCutin } from './cutin';
import { createSelector, type Selector, type SelectorStage, type TapResult } from './move-selector';

export interface BattleActions {
  onUpdate(run: RunState): void;
  onFinished(run: RunState, winner: Owner): void;
}

function eventText(event: GameEvent): string {
  if (event.t === 'win') return `${event.who === 'player' ? 'プレイヤー' : '敵'}の勝利`;
  const names: Record<Exclude<GameEvent['t'], 'win'>, string> = {
    capture: '捕獲', vanish: '消滅', explode: '爆発', revive: '復活', warp: 'ワープ', petrify: '石化',
    convert: '寝返り', pull: '引き寄せ', snipe: '狙撃', swap: '入れ替え', bolt: '落雷', gale: '突風',
    timestop: '刻停', execute: '断罪', devour: '捕食', spawn: '生成',
    resurrect: '蘇生', sacrifice: '供物', doomsday: '下剋上', apocalypse: '終焉', curse: '呪い',
    steal: '強奪', smite: '神罰',
    throne: '天下統一', counter: '後の先', shockwave: '波動球', flip: '天地返し', absorb: '習得', escort: '連携',
  };
  return `${names[event.t]}: ${def(event.defId).name}`;
}

function cutinsFor(move: Move, events: GameEvent[]): string[] {
  const calls: string[] = [];
  if (move.kind === 'active') {
    const activeCalls: Partial<Record<Extract<Move, { kind: 'active' }>['ability'], string>> = {
      bolt: '落雷', apocalypse: '終焉', ohabari: '十拳剣', timestop: '刻停',
      shockwave: '波動球!!', boardFlip: '天地返し!!', smite: '神罰!!',
    };
    const call = activeCalls[move.ability];
    if (call) calls.push(call);
  }
  const eventCalls: Partial<Record<GameEvent['t'], string>> = {
    doomsday: '下剋上!!', throne: '天下統一!!', counter: '後の先', resurrect: '蘇生',
  };
  for (const event of events) {
    const call = eventCalls[event.t];
    if (call) calls.push(call);
  }
  return [...new Set(calls)];
}

export function renderBattle(root: HTMLElement, initialRun: RunState, actions: BattleActions): () => void {
  if (!initialRun.game) throw new Error('battle screen requires a game');
  let run = initialRun;
  let selectedSq: number | null = null;
  let selectedDrop: string | null = null;
  let selector: Selector | null = null;
  let stageAnchor: number | null = null;
  let ambiguousSq: number | null = null;
  let thinking = false;
  let passPending = false;
  let disposed = false;
  let worker: Worker | null = null;
  let foresightWorker: Worker | null = null;
  let foresightMove: Move | null = null;
  let foresightThinking = false;
  let message = '自分の駒を選んでください。';
  let lastMove: MoveVisual | null = null;
  const moveHistory: string[] = [];

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

  const maybePassPlayer = (): void => {
    if (disposed || passPending || game().winner || game().turn !== 'player') return;
    if (legalMoves(game(), 'player').length) return;
    passPending = true;
    message = '動ける駒がありません。手番をスキップします。';
    render();
    window.setTimeout(() => {
      passPending = false;
      if (!disposed && !game().winner && game().turn === 'player' && !legalMoves(game(), 'player').length) {
        apply({ kind: 'pass' });
      }
    }, 500);
  };

  const apply = (move: Move): void => {
    foresightWorker?.terminate();
    foresightWorker = null;
    foresightMove = null;
    foresightThinking = false;
    selector = null;
    stageAnchor = null;
    ambiguousSq = null;
    selectedSq = null;
    selectedDrop = null;
    const before = game();
    const next = applyMove(before, move);
    for (const call of cutinsFor(move, next.events)) showCutin(call);
    lastMove = createMoveVisual(before, move, next);
    moveHistory.unshift(lastMove.historyLabel);
    if (moveHistory.length > 10) moveHistory.length = 10;
    update(next);
    message = next.events.map(eventText).join(' ・ ') || '手を進めました。';
    if (finishIfNeeded()) return;
    render();
    if (next.turn === 'enemy') void requestAiMove();
    else {
      maybePassPlayer();
      void requestForesight();
    }
  };

  const stageMessage = (stage: SelectorStage): string => {
    const messages: Record<SelectorStage['kind'], string> = {
      destination: '琥珀色は移動、紫色は能力です。盤面をタップしてください。',
      promote: '成りますか？',
      second: '二段目の移動先を選んでください。「止まる」も選べます。',
      chain: '追撃先を選んでください。「追撃しない」も選べます。',
      chain2: '再追撃先を選んでください。「追撃しない」も選べます。',
      pull: '引き寄せる駒を選んでください。「使わない」も選べます。',
      petrify: '石化する駒を選んでください。「使わない」も選べます。',
      escortPiece: '連携で動かす味方を選んでください。',
      escortTo: '連携する味方の移動先を選んでください。',
      activeConfirm: '効果範囲を確認し、同じマスをもう一度タップして発動します。',
      done: '手を確定しました。',
    };
    return messages[stage.kind];
  };

  const handleTapResult = (result: TapResult, anchor: number): void => {
    if (result.type === 'commit') {
      apply(result.move);
      return;
    }
    if (result.type === 'ambiguous') {
      ambiguousSq = result.sq;
      stageAnchor = result.sq;
      message = '移動するか、能力を使うか選んでください。';
      render();
      return;
    }
    if (result.type === 'invalid') {
      selector = null;
      selectedSq = null;
      ambiguousSq = null;
      stageAnchor = null;
      message = '選択をキャンセルしました。';
      render();
      return;
    }
    stageAnchor = anchor;
    ambiguousSq = null;
    message = selector ? stageMessage(selector.stage()) : message;
    render();
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

  const requestForesight = async (): Promise<void> => {
    if (disposed || game().winner || game().turn !== 'player' || foresightWorker || foresightThinking) return;
    const hasForesight = game().board.some((piece) => piece && piece.owner === 'player' && effectiveDef(piece).foresight);
    if (!hasForesight) {
      foresightMove = null;
      return;
    }
    foresightThinking = true;
    foresightMove = null;
    render();
    const requestState = game();
    const predictedState: GameState = { ...requestState, turn: 'enemy' };
    try {
      foresightWorker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
      foresightWorker.onmessage = (event: MessageEvent<{ move: Move }>) => {
        foresightWorker?.terminate();
        foresightWorker = null;
        if (disposed || game() !== requestState || game().turn !== 'player') return;
        foresightThinking = false;
        foresightMove = event.data.move;
        render();
      };
      foresightWorker.onerror = () => {
        foresightWorker?.terminate();
        foresightWorker = null;
        foresightThinking = false;
        if (!disposed) render();
      };
      foresightWorker.postMessage({ state: predictedState, depth: 2, timeMs: 300 });
    } catch {
      foresightWorker = null;
      foresightThinking = false;
    }
  };

  const selectSquare = (sq: number): void => {
    if (thinking || passPending || game().turn !== 'player') return;
    if (selectedDrop) {
      if (game().board[sq]?.owner === 'enemy') {
        selectedDrop = null;
      } else {
        const drop = legalMoves(game(), 'player').find(
          (m): m is Extract<Move, { kind: 'drop' }> => m.kind === 'drop' && m.defId === selectedDrop && m.to === sq,
        );
        if (drop) apply(drop);
        else {
          selectedDrop = null;
          message = '打つ場所の選択をキャンセルしました。';
          render();
        }
        return;
      }
    }
    if (selector) {
      handleTapResult(selector.tap(sq), sq);
      return;
    }
    const piece = game().board[sq];
    if (piece?.owner === 'player') {
      selectedSq = sq;
      selectedDrop = null;
      selector = createSelector(pieceMoves(game(), sq), (target) => game().board[target] ? effectiveDef(game().board[target]!) : null);
      stageAnchor = sq;
      message = `${def(piece.defId).name}を選択中。琥珀色は移動、紫色は能力です。`;
    } else if (piece?.owner === 'enemy') {
      selectedSq = sq;
      selectedDrop = null;
      selector = null;
      message = `敵の${def(piece.defId).name}を確認中。青緑の枠が移動範囲、橙の枠が能力対象です。`;
    } else {
      selectedSq = null;
      selector = null;
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
    const cursed = game().cursedKing.player;
    status.innerHTML = `<strong>${thinking ? '敵の手番' : game().turn === 'player' ? 'あなたの手番' : '敵の手番'}</strong><span>${message}</span>${foresightThinking ? '<i class="foresight-badge">未来視中…</i>' : foresightMove ? '<i class="foresight-badge ready">敵の狙いを看破</i>' : ''}${cursed ? '<b class="curse-warning">呪い: 王は前にしか進めない</b>' : ''}${inCheck ? '<b>王手</b>' : ''}`;
    screen.append(status);

    const enemyHand = document.createElement('div');
    renderHand(enemyHand, game(), 'enemy', null);
    screen.append(enemyHand);

    const layout = document.createElement('div');
    layout.className = 'battle-layout';
    const board = document.createElement('div');
    const moves = selectedSq === null ? [] : pieceMoves(game(), selectedSq);
    const inspectingEnemy = selectedSq !== null && game().board[selectedSq]?.owner === 'enemy';
    const selectorStage = !inspectingEnemy ? selector?.stage() : undefined;
    const destinations = new Set(inspectingEnemy
      ? moves.filter((m) => m.kind === 'move').map((m) => (m as Extract<Move, { kind: 'move' }>).to)
      : selectorStage?.kind === 'destination' ? selectorStage.moveOptions : []);
    const targets = new Set<number>();
    const wash = new Set<number>();
    if (selectorStage?.kind === 'destination') for (const active of selectorStage.activeOptions) {
      targets.add(active.target);
      for (const sq of active.lineWash ?? []) wash.add(sq);
    }
    if (selectedDrop) for (const m of legalMoves(game(), 'player')) if (m.kind === 'drop' && m.defId === selectedDrop) destinations.add(m.to);
    const secondaryKinds = new Set(['second', 'chain', 'chain2', 'escortPiece', 'escortTo']);
    const effectKinds = new Set(['pull', 'petrify']);
    const secondary = new Set(selectorStage && secondaryKinds.has(selectorStage.kind) ? selectorStage.moveOptions : []);
    const effects = new Set(selectorStage && effectKinds.has(selectorStage.kind) ? selectorStage.moveOptions : []);
    const blast = new Set(selectorStage?.affected ?? []);
    const captures = new Set<number>();
    for (const sq of [...destinations, ...secondary]) {
      const target = game().board[sq];
      if (target && target.owner === 'enemy') captures.add(sq);
    }
    const foresightOrigin = foresightMove && (foresightMove.kind === 'move' || foresightMove.kind === 'active') ? foresightMove.from : null;
    const foresightDestination = foresightMove?.kind === 'move'
      ? foresightMove.chain2 ?? foresightMove.chain ?? foresightMove.second ?? foresightMove.to
      : foresightMove?.kind === 'active' ? foresightMove.target
        : foresightMove?.kind === 'drop' ? foresightMove.to : null;
    renderBoard(board, game(), {
      selected: selectedSq,
      destinations: inspectingEnemy ? undefined : destinations,
      targets,
      wash,
      secondary,
      effects,
      blast,
      captures,
      tentative: selectorStage?.tentative,
      foresightOrigin,
      foresightDestination,
      lastOrigin: lastMove?.origin,
      lastDestination: lastMove?.destination,
      lastChanged: lastMove?.changed,
      inspectionDestinations: inspectingEnemy ? destinations : undefined,
      inspectionTargets: inspectingEnemy
        ? new Set(moves.filter((m) => m.kind === 'active').map((m) => (m as Extract<Move, { kind: 'active' }>).target))
        : undefined,
      disabled: thinking || passPending,
      onSquare: selectSquare,
    });
    board.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!selector && selectedSq === null && selectedDrop === null) return;
      selector?.cancel();
      selector = null;
      selectedSq = null;
      selectedDrop = null;
      ambiguousSq = null;
      stageAnchor = null;
      message = '選択をキャンセルしました。';
      render();
    });

    const addChips = (sq: number, chips: BoardChip[]): void => renderChips(board, sq, chips);
    if (selector && selectorStage) {
      if (selectorStage.kind === 'promote' && stageAnchor !== null) {
        addChips(stageAnchor, [
          { label: '成', style: 'promote', onTap: () => handleTapResult(selector!.choosePromote(true), stageAnchor!) },
          { label: '不成', style: 'choice', onTap: () => handleTapResult(selector!.choosePromote(false), stageAnchor!) },
        ]);
      } else if (ambiguousSq !== null) {
        addChips(ambiguousSq, [
          { label: '移動', style: 'choice', onTap: () => handleTapResult(selector!.chooseAmbiguous('move'), ambiguousSq!) },
          { label: '能力', style: 'ability', onTap: () => handleTapResult(selector!.chooseAmbiguous('active'), ambiguousSq!) },
        ]);
      } else if (selectorStage.kind === 'destination') {
        const selfActives = selectorStage.activeOptions.filter((active) => active.selfTarget);
        if (selectedSq !== null && selfActives.length) {
          addChips(selectedSq, selfActives.map((active) => ({
            label: active.label,
            style: 'ability' as const,
            onTap: () => handleTapResult(selector!.tap(active.target), active.target),
          })));
        }
      } else if (selectorStage.skippable) {
        const labels: Partial<Record<SelectorStage['kind'], string>> = {
          second: '止まる', chain: '追撃しない', chain2: '追撃しない', pull: '使わない', petrify: '使わない', escortPiece: '連携しない',
        };
        const anchor = selectorStage.tentative?.at ?? stageAnchor ?? selectedSq;
        if (anchor !== null && anchor !== undefined) {
          addChips(anchor, [{
            label: labels[selectorStage.kind] ?? '使わない', style: 'skip',
            onTap: () => handleTapResult(selector!.skip(), anchor),
          }]);
        }
      }
    }
    layout.append(board);

    const side = document.createElement('aside');
    side.className = 'battle-side';
    if (selectedSq !== null) {
      const selectedPiece = game().board[selectedSq];
      if (selectedPiece) {
        const d = pieceInfoDef(game(), selectedPiece);
        const inspecting = selectedPiece.owner === 'enemy';
        side.innerHTML = `<p class="eyebrow">${inspecting ? 'ENEMY INFO' : 'SELECTED'}</p><h3>${d.name}</h3><p>${d.desc ?? ''}</p>`;
        side.prepend(moveDiagram(d, selectedPiece.owner));
      }
    } else {
      side.innerHTML = '<p class="eyebrow">HOW TO PLAY</p><p>自分の駒、移動先の順に選択します。駒台の駒を選ぶと「打つ」場所が光ります。</p>';
    }
    const history = document.createElement('section');
    history.className = 'move-history';
    const historyTitle = document.createElement('strong');
    historyTitle.textContent = '直近の手順';
    history.append(historyTitle);
    if (!moveHistory.length) {
      const empty = document.createElement('p');
      empty.textContent = 'まだ指し手はありません。';
      history.append(empty);
    } else {
      const list = document.createElement('ol');
      for (const item of moveHistory) {
        const entry = document.createElement('li');
        entry.textContent = item;
        list.append(entry);
      }
      history.append(list);
    }
    side.append(history);
    layout.append(side);
    screen.append(layout);

    const playerHand = document.createElement('div');
    renderHand(
      playerHand,
      game(),
      'player',
      selectedDrop,
      !thinking && !passPending && game().turn === 'player' ? (id) => {
        selectedDrop = selectedDrop === id ? null : id;
        selectedSq = null;
        selector = null;
        ambiguousSq = null;
        render();
      } : undefined,
    );
    screen.append(playerHand);
    root.append(screen);
  };

  const cancelSelection = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || (!selector && selectedSq === null && selectedDrop === null)) return;
    event.preventDefault();
    selector?.cancel();
    selector = null;
    selectedSq = null;
    selectedDrop = null;
    ambiguousSq = null;
    stageAnchor = null;
    message = '選択をキャンセルしました。';
    render();
  };
  document.addEventListener('keydown', cancelSelection);

  render();
  const resumedWinner = game().winner;
  if (resumedWinner) {
    window.setTimeout(() => {
      if (!disposed) actions.onFinished(run, resumedWinner);
    }, 0);
  } else if (game().turn === 'enemy') {
    void requestAiMove();
  } else {
    maybePassPlayer();
    void requestForesight();
  }
  return () => {
    disposed = true;
    worker?.terminate();
    foresightWorker?.terminate();
    document.removeEventListener('keydown', cancelSelection);
  };
}
