import { def, obtainableIds } from '../core/defs';
import type { Rarity } from '../core/types';
import { RARITY_LABELS } from './labels';
import { moveDiagram } from './piece-view';

export function renderCodex(root: HTMLElement, encountered: string[], onBack: () => void): void {
  root.innerHTML = '';
  const screen = document.createElement('section');
  screen.className = 'screen codex-screen';
  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = '<div><p class="eyebrow">COLLECTION</p><h2>駒図鑑</h2></div>';
  const back = document.createElement('button');
  back.className = 'back-button';
  back.textContent = 'タイトルへ';
  back.addEventListener('click', onBack);
  header.append(back);
  screen.append(header);

  const detail = document.createElement('aside');
  detail.className = 'codex-detail empty';
  detail.textContent = '駒を選ぶと、動きと能力を表示します。';

  const catalog = document.createElement('div');
  catalog.className = 'catalog';
  for (const rarity of ['common', 'uncommon', 'rare', 'mythic', 'celestial', 'forbidden', 'transcendent'] as Rarity[]) {
    const section = document.createElement('section');
    section.innerHTML = `<h3>${RARITY_LABELS[rarity]}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'codex-grid';
    for (const id of obtainableIds().filter((x) => def(x).rarity === rarity)) {
      const known = encountered.includes(id);
      const d = def(id);
      const card = document.createElement('button');
      card.className = `codex-card rarity-${rarity}${known ? '' : ' unknown'}`;
      card.innerHTML = known
        ? `<span class="card-kanji">${d.kanji}</span><span>${d.name}</span>`
        : '<span class="card-kanji">?</span><span>未遭遇</span>';
      card.disabled = !known;
      if (known) card.addEventListener('click', () => {
        detail.className = `codex-detail rarity-${rarity}`;
        detail.innerHTML = `<p class="rarity-label">${RARITY_LABELS[rarity]}</p><h3>${d.name}</h3><p>${d.desc ?? '特殊能力なし'}</p>`;
        detail.prepend(moveDiagram(d));
      });
      grid.append(card);
    }
    section.append(grid);
    catalog.append(section);
  }
  const layout = document.createElement('div');
  layout.className = 'codex-layout';
  layout.append(catalog, detail);
  screen.append(layout);
  root.append(screen);
}
