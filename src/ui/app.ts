import { newRun } from '../core/run';
import { seedFromTime } from '../core/rng';
import type { RunState } from '../core/types';
import { loadCodex, loadRun, loadStats, recordCodex, saveRun } from '../storage';
import { renderCodex } from './codex';
import { renderTitle } from './title';

export class App {
  private run: RunState | null;

  constructor(private readonly root: HTMLElement) {
    this.run = loadRun();
  }

  start(): void {
    this.showTitle();
  }

  private showTitle(): void {
    this.run = loadRun();
    renderTitle(this.root, this.run !== null, loadStats(), {
      onNew: (mode) => {
        this.run = newRun(mode, seedFromTime());
        recordCodex(this.run.roster);
        saveRun(this.run);
        this.showRunPlaceholder();
      },
      onContinue: () => this.showRunPlaceholder(),
      onCodex: () => renderCodex(this.root, loadCodex(), () => this.showTitle()),
    });
  }

  private showRunPlaceholder(): void {
    this.root.innerHTML = `
      <section class="screen placeholder-screen">
        <p class="eyebrow">RUN READY</p><h2>第${this.run?.stage ?? 1}面</h2>
        <p>編成画面を準備しています。</p><button class="menu-button">タイトルへ</button>
      </section>`;
    this.root.querySelector('button')?.addEventListener('click', () => this.showTitle());
  }
}
