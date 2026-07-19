import { def } from '../core/defs';
import type { RunState } from '../core/types';

export function renderResult(root: HTMLElement, run: RunState, onTitle: () => void): void {
  const cleared = run.phase === 'cleared';
  root.innerHTML = '';
  const screen = document.createElement('section');
  screen.className = `screen result-screen ${cleared ? 'victory' : 'defeat'}`;
  screen.innerHTML = `
    <p class="eyebrow">${cleared ? 'ALL STAGES CLEARED' : 'RUN ENDED'}</p>
    <h2>${cleared ? '天下統一' : '敗北'}</h2>
    <p class="result-stage">到達 第${run.stage}面 ・ ${run.mode === 'beginner' ? '初心者' : '通常'}モード</p>
    <h3>今回獲得した駒</h3>
  `;
  const roster = document.createElement('div');
  roster.className = 'result-roster';
  if (!run.roster.length) roster.textContent = '獲得した特殊駒はありません。';
  for (const id of run.roster) {
    const d = def(id);
    const item = document.createElement('span');
    item.className = `rarity-${d.rarity}`;
    item.textContent = `${d.kanji} ${d.name}`;
    roster.append(item);
  }
  screen.append(roster);
  const button = document.createElement('button');
  button.className = 'menu-button';
  button.textContent = 'タイトルへ戻る';
  button.addEventListener('click', onTitle);
  screen.append(button);
  root.append(screen);
}
