import { newGame, initialSquares } from './board';
import { def, obtainableIds } from './defs';
import { nextRand, pick } from './rng';
import { enemySetupFor } from './stages';
import type { Owner, Rarity, RunState } from './types';
import { sqOf } from './types';

type RewardWeights = Record<Rarity, number>;

const REWARD_WEIGHTS: { from: number; to: number; weights: RewardWeights }[] = [
  { from: 1, to: 3, weights: { common: 1, uncommon: 14, rare: 45, mythic: 35, celestial: 5, forbidden: 0 } },
  { from: 4, to: 4, weights: { common: 1, uncommon: 9, rare: 40, mythic: 40, celestial: 10, forbidden: 0 } },
  { from: 5, to: 5, weights: { common: 0, uncommon: 0, rare: 28, mythic: 47, celestial: 20, forbidden: 5 } },
  { from: 6, to: 9, weights: { common: 1, uncommon: 7, rare: 32, mythic: 45, celestial: 15, forbidden: 0 } },
  { from: 10, to: 10, weights: { common: 0, uncommon: 0, rare: 18, mythic: 47, celestial: 28, forbidden: 7 } },
  { from: 11, to: 12, weights: { common: 1, uncommon: 4, rare: 24, mythic: 43, celestial: 24, forbidden: 4 } },
  { from: 13, to: 14, weights: { common: 0, uncommon: 3, rare: 15, mythic: 42, celestial: 32, forbidden: 8 } },
];

const OBTAINABLE_BY_RARITY: Record<Rarity, string[]> = {
  common: [], uncommon: [], rare: [], mythic: [], celestial: [], forbidden: [],
};
for (const id of obtainableIds()) OBTAINABLE_BY_RARITY[def(id).rarity!].push(id);

function drawRarity(state: number, weights: RewardWeights): { value: Rarity; state: number } {
  const r = nextRand(state);
  const roll = r.value * 100;
  let sum = 0;
  for (const rarity of ['common', 'uncommon', 'rare', 'mythic', 'celestial', 'forbidden'] as Rarity[]) {
    sum += weights[rarity];
    if (roll < sum) return { value: rarity, state: r.state };
  }
  return { value: 'forbidden', state: r.state };
}

export function rewardWeightsFor(stage: number): RewardWeights {
  const row = REWARD_WEIGHTS.find((entry) => stage >= entry.from && stage <= entry.to);
  if (!row) throw new Error(`no reward table for stage ${stage}`);
  return { ...row.weights };
}

function rewardOffer(stage: number, initialState: number): { offer: string[]; state: number } {
  const weights = rewardWeightsFor(stage);
  let state = initialState;
  const offer: string[] = [];
  while (offer.length < 3) {
    const rarity = drawRarity(state, weights);
    state = rarity.state;
    const candidates = OBTAINABLE_BY_RARITY[rarity.value].filter((id) => !offer.includes(id));
    if (!candidates.length) continue;
    const chosen = pick(state, candidates);
    state = chosen.state;
    offer.push(chosen.value);
  }
  return { offer, state };
}

export function newRun(mode: 'normal' | 'beginner', seed: number): RunState {
  const run: RunState = {
    mode,
    stage: 1,
    roster: [],
    formation: {},
    game: null,
    phase: 'formation',
    rewardOffer: null,
    rngState: seed,
  };
  if (mode === 'beginner') {
    const openSlots = [sqOf(8, 3), sqOf(8, 5), sqOf(7, 1), sqOf(7, 7)];
    for (const rarity of ['mythic', 'celestial'] as const) {
      const pieceRoll = pick(run.rngState, OBTAINABLE_BY_RARITY[rarity]);
      run.rngState = pieceRoll.state;
      run.roster.push(pieceRoll.value);
      const slotRoll = pick(run.rngState, openSlots);
      run.rngState = slotRoll.state;
      run.formation[slotRoll.value] = pieceRoll.value;
      openSlots.splice(openSlots.indexOf(slotRoll.value), 1);
    }
  }
  return run;
}

export function startBattle(run: RunState): RunState {
  if (run.phase !== 'formation') throw new Error('battle can only start from formation');
  return {
    ...run,
    game: newGame(run.formation, enemySetupFor(run.stage), run.rngState),
    phase: 'battle',
    rewardOffer: null,
  };
}

export function onBattleEnd(run: RunState, winner: Owner): RunState {
  const state = run.game?.rngState ?? run.rngState;
  if (winner === 'enemy') return { ...run, phase: 'gameover', rngState: state, rewardOffer: null, lastStolen: [] };
  const stolen = run.game?.stolen ?? [];
  const roster = [...run.roster, ...stolen];
  if (run.stage === 15) return { ...run, roster, phase: 'cleared', rngState: state, rewardOffer: null, lastStolen: stolen };
  const reward = rewardOffer(run.stage, state);
  return { ...run, roster, phase: 'reward', rngState: reward.state, rewardOffer: reward.offer, lastStolen: stolen };
}

export function takeReward(run: RunState, defId: string | null): RunState {
  if (run.phase !== 'reward') throw new Error('reward can only be taken during reward phase');
  if (defId !== null && !run.rewardOffer?.includes(defId)) throw new Error(`piece is not in reward offer: ${defId}`);
  return {
    ...run,
    stage: run.stage + 1,
    roster: defId === null ? run.roster.slice() : [...run.roster, defId],
    game: null,
    phase: 'formation',
    rewardOffer: null,
    lastStolen: [],
  };
}

export function setFormation(run: RunState, sq: number, defId: string | null): RunState {
  if (run.phase !== 'formation') throw new Error('formation can only be changed before battle');
  const base = initialSquares('player')[sq];
  if (!base || base === 'king') throw new Error(`invalid formation square: ${sq}`);
  const formation = { ...run.formation };
  if (defId === null) {
    delete formation[sq];
    return { ...run, formation };
  }
  if (!def(defId).rarity) throw new Error(`not an obtainable special piece: ${defId}`);
  const owned = run.roster.filter((id) => id === defId).length;
  const usedElsewhere = Object.entries(formation).filter(([placedSq, id]) => Number(placedSq) !== sq && id === defId).length;
  if (usedElsewhere >= owned) throw new Error(`not enough copies in roster: ${defId}`);
  formation[sq] = defId;
  return { ...run, formation };
}
