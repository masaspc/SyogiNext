import { describe, expect, it } from 'vitest';
import { def } from '../src/core/defs';
import { newRun, onBattleEnd, setFormation, startBattle, takeReward } from '../src/core/run';
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
  });
});

describe('ラン進行', () => {
  it('初心者モードはレア以上1枚を獲得・編成済みで開始する', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = newRun('beginner', seed);
      expect(run.roster).toHaveLength(1);
      expect(['rare', 'mythic']).toContain(def(run.roster[0]).rarity);
      expect(Object.values(run.formation)).toEqual(run.roster);
    }
  });

  it('出陣すると現在面の敵編成を持つ対局を作る', () => {
    const battle = startBattle({ ...newRun('normal', 1), stage: 5 });
    expect(battle.phase).toBe('battle');
    expect(battle.game?.board[sqOf(0, 4)]?.defId).toBe('onimusha');
    expect(battle.game?.bossDodgesLeft).toBe(0);
  });

  it('面1報酬には神話レアが出ず、面5報酬はレア以上のみで3枚が異なる', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const stage1 = onBattleEnd(startBattle(newRun('normal', seed)), 'player');
      expect(stage1.rewardOffer).toHaveLength(3);
      expect(stage1.rewardOffer?.every((id) => def(id).rarity !== 'mythic')).toBe(true);

      const stage5 = onBattleEnd(startBattle({ ...newRun('normal', seed), stage: 5 }), 'player');
      expect(stage5.rewardOffer?.every((id) => ['rare', 'mythic'].includes(def(id).rarity!))).toBe(true);
      expect(new Set(stage5.rewardOffer).size).toBe(3);
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
