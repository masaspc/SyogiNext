import { initialSquares } from '../core/board';
import { def } from '../core/defs';
import { setFormation } from '../core/run';
import type { Piece, RunState } from '../core/types';
import { moveDiagram, pieceToken } from './piece-view';

export interface FormationActions {
  onChange(run: RunState): void;
  onStart(run: RunState): void;
  onTitle(): void;
}

export function renderFormation(root: HTMLElement, initialRun: RunState, actions: FormationActions): void {
  let run = initialRun;
  let selected: string | null = null;
  let notice = '控えの特殊駒を選び、盤上の通常駒と入れ替えます。';
  const initial = initialSquares('player');

  const render = (): void => {
    root.innerHTML = '';
    const screen = document.createElement('section');
    screen.className = 'screen formation-screen';
    const header = document.createElement('header');
    header.className = 'screen-header';
    header.innerHTML = `<div><p class="eyebrow">FORMATION ${run.stage} / 15</p><h2>第${run.stage}面の編成</h2></div>`;
    const title = document.createElement('button');
    title.className = 'back-button';
    title.textContent = 'タイトルへ';
    title.addEventListener('click', actions.onTitle);
    header.append(title);
    screen.append(header);

    const layout = document.createElement('div');
    layout.className = 'formation-layout';
    const left = document.createElement('div');
    const hint = document.createElement('p');
    hint.className = 'formation-notice';
    hint.textContent = notice;
    left.append(hint);
    const board = document.createElement('div');
    board.className = 'formation-board';
    for (let row = 6; row <= 8; row++) {
      for (let col = 0; col < 9; col++) {
        const sq = row * 9 + col;
        const baseId = initial[sq];
        const placed = run.formation[sq];
        const cell = document.createElement('button');
        cell.className = `formation-square${placed ? ' replaced' : ''}${baseId === 'king' ? ' royal' : ''}`;
        cell.disabled = !baseId;
        if (baseId) {
          const id = placed ?? baseId;
          const fake: Piece = { id: sq, defId: id, owner: 'player', promoted: false };
          cell.append(pieceToken(fake));
          const label = document.createElement('small');
          label.textContent = placed ? `元: ${def(baseId).kanji}` : def(baseId).name;
          cell.append(label);
          cell.addEventListener('click', () => {
            try {
              if (selected) {
                run = setFormation(run, sq, selected);
                notice = `${def(selected).name}を配置しました。`;
              } else if (placed) {
                run = setFormation(run, sq, null);
                notice = `${def(placed).name}を控えに戻しました。`;
              } else {
                notice = baseId === 'king' ? '王は入れ替えられません。' : '先に控えの駒を選んでください。';
              }
              actions.onChange(run);
            } catch (error) {
              notice = error instanceof Error ? error.message : '配置できませんでした。';
            }
            selected = null;
            render();
          });
        }
        board.append(cell);
      }
    }
    left.append(board);
    const launch = document.createElement('button');
    launch.className = 'launch-button';
    launch.innerHTML = `<span>第${run.stage}面へ</span><strong>出陣</strong>`;
    launch.addEventListener('click', () => actions.onStart(run));
    left.append(launch);
    layout.append(left);

    const side = document.createElement('aside');
    side.className = 'formation-side';
    side.innerHTML = '<p class="eyebrow">ROSTER</p><h3>控えの特殊駒</h3>';
    const roster = document.createElement('div');
    roster.className = 'roster-list';
    const counts = new Map<string, number>();
    for (const id of run.roster) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (!counts.size) roster.innerHTML = '<p class="empty-roster">まだ特殊駒を持っていません。勝利して獲得しましょう。</p>';
    for (const [id, owned] of counts) {
      const used = Object.values(run.formation).filter((x) => x === id).length;
      const d = def(id);
      const button = document.createElement('button');
      button.className = `roster-card rarity-${d.rarity}${selected === id ? ' selected' : ''}`;
      button.disabled = used >= owned;
      button.innerHTML = `<b>${d.kanji}</b><span>${d.name}</span><small>控え ${owned - used} / ${owned}</small>`;
      button.addEventListener('click', () => { selected = selected === id ? null : id; render(); });
      roster.append(button);
    }
    side.append(roster);
    if (selected) {
      const detail = document.createElement('div');
      detail.className = 'formation-detail';
      const d = def(selected);
      detail.append(moveDiagram(d));
      const text = document.createElement('p');
      text.textContent = d.desc ?? '';
      detail.append(text);
      side.append(detail);
    }
    layout.append(side);
    screen.append(layout);
    root.append(screen);
  };
  render();
}
