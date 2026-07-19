import type { RunState, Stats } from './core/types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const VERSION = 1;
const RUN_KEY = 'syoginext:run';
const CODEX_KEY = 'syoginext:codex';
const STATS_KEY = 'syoginext:stats';

function browserStorage(): StorageLike {
  return localStorage;
}

function readVersioned<T>(storage: StorageLike, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { version?: number; data?: T };
    return parsed.version === VERSION && parsed.data !== undefined ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeVersioned<T>(storage: StorageLike, key: string, data: T): void {
  storage.setItem(key, JSON.stringify({ version: VERSION, data }));
}

export function saveRun(run: RunState | null, storage: StorageLike = browserStorage()): void {
  if (run === null) storage.removeItem(RUN_KEY);
  else writeVersioned(storage, RUN_KEY, run);
}

export function loadRun(storage: StorageLike = browserStorage()): RunState | null {
  return readVersioned<RunState>(storage, RUN_KEY);
}

export function recordCodex(defIds: string[], storage: StorageLike = browserStorage()): void {
  const current = loadCodex(storage);
  writeVersioned(storage, CODEX_KEY, [...new Set([...current, ...defIds])].sort());
}

export function loadCodex(storage: StorageLike = browserStorage()): string[] {
  const value = readVersioned<unknown>(storage, CODEX_KEY);
  return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : [];
}

export function recordResult(
  mode: string,
  stage: number,
  cleared: boolean,
  storage: StorageLike = browserStorage(),
): void {
  const current = loadStats(storage);
  writeVersioned<Stats>(storage, STATS_KEY, {
    version: VERSION,
    runs: current.runs + 1,
    clears: current.clears + (cleared ? 1 : 0),
    bestStage: Math.max(current.bestStage, stage),
    lastMode: mode,
  });
}

export function loadStats(storage: StorageLike = browserStorage()): Stats {
  const value = readVersioned<Stats>(storage, STATS_KEY);
  if (!value || typeof value.runs !== 'number' || typeof value.clears !== 'number' || typeof value.bestStage !== 'number') {
    return { version: VERSION, runs: 0, clears: 0, bestStage: 0 };
  }
  return value;
}
