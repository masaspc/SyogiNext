// シード付き決定的乱数(mulberry32)。状態は整数1個で、GameState/RunStateに保持して持ち回す。
export function nextRand(state: number): { value: number; state: number } {
  const newState = (state + 0x6d2b79f5) | 0;
  let t = newState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: newState };
}

export function randInt(state: number, n: number): { value: number; state: number } {
  const r = nextRand(state);
  return { value: Math.floor(r.value * n), state: r.state };
}

export function pick<T>(state: number, items: readonly T[]): { value: T; state: number } {
  const r = randInt(state, items.length);
  return { value: items[r.value], state: r.state };
}

export function seedFromTime(): number {
  const now = Date.now();
  return (now ^ Math.floor(now / 0x100000000)) | 0;
}
