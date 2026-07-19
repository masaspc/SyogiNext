import { describe, expect, it } from 'vitest';
import { loadCodex, loadRun, loadStats, recordCodex, recordResult, saveRun, type StorageLike } from '../src/storage';
import { newRun } from '../src/core/run';

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

describe('storage', () => {
  it('ランを保存・復元し、null保存で削除する', () => {
    const storage = new MemoryStorage();
    const run = newRun('beginner', 123);
    saveRun(run, storage);
    expect(loadRun(storage)).toEqual(run);
    saveRun(null, storage);
    expect(loadRun(storage)).toBeNull();
  });

  it('壊れたJSONまたはversion不一致は破棄する', () => {
    const storage = new MemoryStorage();
    storage.setItem('syoginext:run', '{broken');
    expect(loadRun(storage)).toBeNull();
    storage.setItem('syoginext:run', JSON.stringify({ version: 99, data: newRun('normal', 1) }));
    expect(loadRun(storage)).toBeNull();
  });

  it('図鑑は重複なしで蓄積する', () => {
    const storage = new MemoryStorage();
    recordCodex(['magnet', 'witch'], storage);
    recordCodex(['witch', 'lion'], storage);
    expect(loadCodex(storage)).toEqual(['lion', 'magnet', 'witch']);
  });

  it('戦績を累積する', () => {
    const storage = new MemoryStorage();
    recordResult('normal', 4, false, storage);
    recordResult('beginner', 15, true, storage);
    expect(loadStats(storage)).toEqual({
      version: 1,
      runs: 2,
      clears: 1,
      bestStage: 15,
      lastMode: 'beginner',
    });
  });
});
