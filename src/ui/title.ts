import type { Stats } from '../core/types';

export interface TitleActions {
  onNew(mode: 'normal' | 'beginner'): void;
  onContinue(): void;
  onCodex(): void;
}

function action(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = `menu-button ${className}`;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function renderTitle(root: HTMLElement, hasSave: boolean, stats: Stats, actions: TitleActions): void {
  root.innerHTML = '';
  const screen = document.createElement('section');
  screen.className = 'screen title-screen';
  screen.innerHTML = `
    <p class="eyebrow">純将棋 × ローグライト</p>
    <h1>将棋<span>NEXT</span></h1>
    <p class="lead">特殊な駒を集め、十五の盤面を勝ち抜け。</p>
  `;
  const menu = document.createElement('div');
  menu.className = 'title-menu';
  menu.append(action('新規ラン（通常）', () => actions.onNew('normal')));
  menu.append(action('新規ラン（初心者）', () => actions.onNew('beginner'), 'accent'));
  if (hasSave) menu.append(action('続きから', actions.onContinue, 'continue'));
  menu.append(action('駒図鑑', actions.onCodex, 'quiet'));
  screen.append(menu);
  const record = document.createElement('p');
  record.className = 'record';
  record.textContent = `挑戦 ${stats.runs}回 ・ クリア ${stats.clears}回 ・ 最高 ${stats.bestStage || '—'}面`;
  screen.append(record);
  root.append(screen);
}
