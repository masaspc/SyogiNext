import { newRun, onBattleEnd, startBattle, takeReward } from '../core/run';
import { seedFromTime } from '../core/rng';
import { stageDef } from '../core/stages';
import type { Owner } from '../core/types';
import type { RunState } from '../core/types';
import { loadCodex, loadRun, loadStats, recordCodex, recordResult, saveRun } from '../storage';
import { renderBattle } from './battle';
import { renderCodex } from './codex';
import { renderFormation } from './formation';
import { renderResult } from './result';
import { renderReward } from './reward';
import { renderTitle } from './title';

export class App {
  private run: RunState | null;
  private cleanup: (() => void) | null = null;

  constructor(private readonly root: HTMLElement) {
    this.run = loadRun();
  }

  start(): void {
    this.showTitle();
  }

  private showTitle(): void {
    this.leaveScreen();
    this.run = loadRun();
    renderTitle(this.root, this.run !== null, loadStats(), {
      onNew: (mode) => {
        this.run = newRun(mode, seedFromTime());
        recordCodex(this.run.roster);
        saveRun(this.run);
        this.showRun();
      },
      onContinue: () => this.showRun(),
      onCodex: () => renderCodex(this.root, loadCodex(), () => this.showTitle()),
    });
  }

  private leaveScreen(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  private showRun(): void {
    this.leaveScreen();
    if (!this.run) {
      this.showTitle();
      return;
    }
    if (this.run.phase === 'formation') this.showFormation();
    else if (this.run.phase === 'battle') this.showBattle();
    else if (this.run.phase === 'reward') this.showReward();
    else this.showResult();
  }

  private showFormation(): void {
    if (!this.run) return;
    renderFormation(this.root, this.run, {
      onChange: (run) => {
        this.run = run;
        saveRun(run);
      },
      onStart: (run) => {
        this.run = startBattle(run);
        const stage = stageDef(run.stage);
        recordCodex([...stage.enemySpecials, ...(stage.boss ? [stage.boss] : [])]);
        saveRun(this.run);
        this.showBattle();
      },
      onTitle: () => this.showTitle(),
    });
  }

  private showBattle(): void {
    if (!this.run) return;
    this.leaveScreen();
    this.cleanup = renderBattle(this.root, this.run, {
      onUpdate: (run) => {
        this.run = run;
        saveRun(run);
      },
      onFinished: (run, winner) => this.finishBattle(run, winner),
    });
  }

  private finishBattle(run: RunState, winner: Owner): void {
    this.run = onBattleEnd(run, winner);
    if (this.run.lastStolen?.length) recordCodex(this.run.lastStolen);
    saveRun(this.run);
    this.showRun();
  }

  private showReward(): void {
    if (!this.run) return;
    renderReward(this.root, this.run, (id) => {
      if (!this.run) return;
      if (id) recordCodex([id]);
      this.run = takeReward(this.run, id);
      saveRun(this.run);
      this.showFormation();
    });
  }

  private showResult(): void {
    if (!this.run) return;
    const result = this.run;
    recordResult(result.mode, result.stage, result.phase === 'cleared');
    // 敗北確定後の巻き戻しを防ぎ、ランはここで完全ロストさせる。
    saveRun(null);
    this.run = null;
    renderResult(this.root, result, () => this.showTitle());
  }
}
