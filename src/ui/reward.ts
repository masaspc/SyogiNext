import { def } from '../core/defs';
import type { RunState } from '../core/types';
import { RARITY_LABELS } from './labels';
import { moveDiagram } from './piece-view';

export function renderReward(root: HTMLElement, run: RunState, onTake: (defId: string | null) => void): void {
  root.innerHTML = '';
  const screen = document.createElement('section');
  screen.className = 'screen reward-screen';
  screen.innerHTML = `<div class="reward-heading"><p class="eyebrow">STAGE ${run.stage} CLEAR</p><h2>新たな駒を選ぶ</h2><p>一枚を獲得して、次の戦いへ。</p></div>`;
  const cards = document.createElement('div');
  cards.className = 'reward-cards';
  for (const id of run.rewardOffer ?? []) {
    const d = def(id);
    const card = document.createElement('button');
    card.className = `reward-card rarity-${d.rarity}`;
    card.innerHTML = `<span class="reward-rarity">${RARITY_LABELS[d.rarity!]}</span><b>${d.kanji}</b><h3>${d.name}</h3><p>${d.desc ?? ''}</p>`;
    card.insertBefore(moveDiagram(d), card.querySelector('p'));
    card.addEventListener('click', () => onTake(id));
    cards.append(card);
  }
  screen.append(cards);
  const skip = document.createElement('button');
  skip.className = 'back-button reward-skip';
  skip.textContent = '今回は獲得せず次へ';
  skip.addEventListener('click', () => onTake(null));
  screen.append(skip);
  root.append(screen);
}
