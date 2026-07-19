import { describe, expect, it } from 'vitest';
import { def } from '../src/core/defs';
import { obtainableIds } from '../src/core/defs';
import { newRun, onBattleEnd, rewardWeightsFor, setFormation, startBattle, takeReward } from '../src/core/run';
import { enemySetupFor, STAGES } from '../src/core/stages';
import { sqOf } from '../src/core/types';

describe('ステージデータ', () => {
  it('15面分が設計どおりの深度と時間で定義されている', () => {
    expect(STAGES).toHaveLength(15);
    expect(STAGES.map((s) => s.depth)).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5]);
    expect(STAGES.map((s) => s.timeMs)).toEqual([500, 500, 500, 1000, 1000, 1000, 1000, 1000, 2000, 2000, 2000, 2000, 2000, 3000, 3000]);
  });

  it('全ステージでボスと特殊駒を重複しない初期マスへ配置する', () => {
    for (const stage of STAGES) {
      const setup = enemySetupFor(stage.stage);
      expect(Object.values(setup).sort()).toEqual(
        [...stage.enemySpecials, ...(stage.boss ? [stage.boss] : [])].sort(),
      );
      expect(new Set(Object.keys(setup)).size).toBe(Object.keys(setup).length);
    }
    expect(enemySetupFor(5)[sqOf(0, 4)]).toBe('onimusha');
    expect(enemySetupFor(10)[sqOf(0, 4)]).toBe('kyubi');
    expect(enemySetupFor(15)[sqOf(0, 4)]).toBe('haoh');
    expect(STAGES[12].enemySpecials).toContain('shinigami');
    expect(STAGES[13].enemySpecials).toContain('raijin');
    expect(STAGES[14].enemySpecials).toContain('amaterasu');
    expect(STAGES[14].enemySpecials).toContain('maou');
    expect(STAGES[14].enemySpecials).not.toContain('kirin');
  });
});

describe('ラン進行', () => {
  it('初心者モードは神話レアと天上レアを1枚ずつ獲得・編成済みで開始する', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = newRun('beginner', seed);
      expect(run.roster).toHaveLength(2);
      expect(run.roster.map((id) => def(id).rarity).sort()).toEqual(['celestial', 'mythic']);
      expect(Object.values(run.formation).sort()).toEqual([...run.roster].sort());
    }
    expect(newRun('beginner', 123)).toEqual(newRun('beginner', 123));
  });

  it('出陣すると現在面の敵編成を持つ対局を作る', () => {
    const battle = startBattle({ ...newRun('normal', 1), stage: 5 });
    expect(battle.phase).toBe('battle');
    expect(battle.game?.board[sqOf(0, 4)]?.defId).toBe('onimusha');
    expect(battle.game?.bossDodgesLeft).toBe(0);
  });

  it('報酬はコモンをほぼ除外し、進行するほど神話・天上レアが出やすい', () => {
    for (let stage = 1; stage <= 14; stage++) {
      const weights = rewardWeightsFor(stage);
      expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBe(100);
      expect(weights.common).toBeLessThanOrEqual(1);
    }
    expect(rewardWeightsFor(1).mythic + rewardWeightsFor(1).celestial).toBe(40);
    expect(rewardWeightsFor(14).mythic + rewardWeightsFor(14).celestial + rewardWeightsFor(14).forbidden).toBe(82);
    expect([
      rewardWeightsFor(1), rewardWeightsFor(4), rewardWeightsFor(5), rewardWeightsFor(6),
      rewardWeightsFor(10), rewardWeightsFor(11), rewardWeightsFor(13),
    ]).toEqual([
      { common: 1, uncommon: 14, rare: 45, mythic: 35, celestial: 5, forbidden: 0 },
      { common: 1, uncommon: 9, rare: 40, mythic: 40, celestial: 10, forbidden: 0 },
      { common: 0, uncommon: 0, rare: 28, mythic: 47, celestial: 20, forbidden: 5 },
      { common: 1, uncommon: 7, rare: 32, mythic: 45, celestial: 15, forbidden: 0 },
      { common: 0, uncommon: 0, rare: 18, mythic: 47, celestial: 28, forbidden: 7 },
      { common: 1, uncommon: 4, rare: 24, mythic: 43, celestial: 24, forbidden: 4 },
      { common: 0, uncommon: 3, rare: 15, mythic: 42, celestial: 32, forbidden: 8 },
    ]);
    expect(rewardWeightsFor(1).forbidden).toBe(0);
    expect(rewardWeightsFor(5).forbidden).toBe(5);
    expect(obtainableIds().filter((id) => def(id).rarity === 'forbidden')).toHaveLength(7);
  });

  it('報酬候補は常に重複しない3枚になる', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const stage1 = onBattleEnd(startBattle(newRun('normal', seed)), 'player');
      expect(stage1.rewardOffer).toHaveLength(3);
      expect(new Set(stage1.rewardOffer).size).toBe(3);
      const stage14 = onBattleEnd(startBattle({ ...newRun('normal', seed), stage: 14 }), 'player');
      expect(new Set(stage14.rewardOffer).size).toBe(3);
    }
  });

  it('報酬獲得またはスキップで次の編成へ進み、敗北はgameoverになる', () => {
    const won = onBattleEnd(startBattle(newRun('normal', 9)), 'player');
    const selected = won.rewardOffer![0];
    const next = takeReward(won, selected);
    expect(next).toMatchObject({ stage: 2, phase: 'formation', rewardOffer: null, game: null });
    expect(next.roster).toContain(selected);

    const lost = onBattleEnd(startBattle(newRun('normal', 9)), 'enemy');
    expect(lost.phase).toBe('gameover');
  });

  it('編成は玉以外の初期マスと所持数を検証する', () => {
    const run = { ...newRun('normal', 1), roster: ['magnet'] };
    expect(() => setFormation(run, sqOf(8, 4), 'magnet')).toThrow(/invalid formation square/);
    const placed = setFormation(run, sqOf(8, 3), 'magnet');
    expect(placed.formation[sqOf(8, 3)]).toBe('magnet');
    expect(() => setFormation(placed, sqOf(8, 5), 'magnet')).toThrow(/not enough copies/);
    expect(setFormation(placed, sqOf(8, 3), null).formation).toEqual({});
  });
});
