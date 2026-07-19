import { describe, it, expect } from 'vitest';
import { nextRand, randInt, pick } from '../src/core/rng';

describe('rng', () => {
  it('同じシードから同じ列を生成する', () => {
    let a = 12345;
    let b = 12345;
    for (let i = 0; i < 100; i++) {
      const ra = nextRand(a);
      const rb = nextRand(b);
      expect(ra.value).toBe(rb.value);
      a = ra.state;
      b = rb.state;
    }
  });

  it('異なるシードは異なる列を生成する', () => {
    const seq = (seed: number) => {
      const out: number[] = [];
      let s = seed;
      for (let i = 0; i < 10; i++) {
        const r = nextRand(s);
        out.push(r.value);
        s = r.state;
      }
      return out;
    };
    expect(seq(1)).not.toEqual(seq(2));
  });

  it('randIntは常に[0,n)の整数', () => {
    let s = 999;
    for (let i = 0; i < 1000; i++) {
      const r = randInt(s, 7);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(7);
      expect(Number.isInteger(r.value)).toBe(true);
      s = r.state;
    }
  });

  it('pickは配列の要素を返す', () => {
    const items = ['a', 'b', 'c'];
    let s = 42;
    for (let i = 0; i < 50; i++) {
      const r = pick(s, items);
      expect(items).toContain(r.value);
      s = r.state;
    }
  });
});
