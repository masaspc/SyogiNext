import { def } from './defs';
import { sqOf } from './types';

export interface StageDef {
  stage: number;
  depth: number;
  timeMs: number;
  enemySpecials: string[];
  boss?: string;
}

export const STAGES: StageDef[] = [
  { stage: 1, depth: 2, timeMs: 500, enemySpecials: [] },
  { stage: 2, depth: 2, timeMs: 500, enemySpecials: ['chunin', 'tessho'] },
  { stage: 3, depth: 2, timeMs: 500, enemySpecials: ['sekisho', 'dosho', 'dog'] },
  { stage: 4, depth: 3, timeMs: 1000, enemySpecials: ['archer', 'mole', 'mokusho', 'kihei'] },
  { stage: 5, depth: 3, timeMs: 1000, boss: 'onimusha', enemySpecials: ['rabbit', 'tessho', 'dosho'] },
  { stage: 6, depth: 3, timeMs: 1000, enemySpecials: ['leopard', 'spearman', 'chunin', 'dog'] },
  { stage: 7, depth: 3, timeMs: 1000, enemySpecials: ['windmill', 'shieldman', 'grudge', 'archer', 'mole'] },
  { stage: 8, depth: 3, timeMs: 1000, enemySpecials: ['knight8', 'ninja', 'fox', 'leopard'] },
  { stage: 9, depth: 4, timeMs: 2000, enemySpecials: ['kagemusha', 'spearman', 'windmill', 'grudge', 'rabbit', 'kihei'] },
  { stage: 10, depth: 4, timeMs: 2000, boss: 'kyubi', enemySpecials: ['leopard', 'shieldman', 'knight8', 'fox'] },
  { stage: 11, depth: 4, timeMs: 2000, enemySpecials: ['elephant', 'magnet', 'windmill', 'ninja', 'spearman'] },
  { stage: 12, depth: 4, timeMs: 2000, enemySpecials: ['kirin', 'sniper', 'witch', 'knight8', 'shieldman'] },
  { stage: 13, depth: 4, timeMs: 2000, enemySpecials: ['phoenix', 'assassin', 'bomber', 'shinigami', 'leopard', 'grudge', 'fox'] },
  { stage: 14, depth: 5, timeMs: 3000, enemySpecials: ['lion', 'magnet', 'sniper', 'assassin', 'raijin', 'windmill', 'knight8'] },
  { stage: 15, depth: 5, timeMs: 3000, boss: 'haoh', enemySpecials: ['gunshin', 'phoenix_b', 'maou', 'phoenix', 'assassin', 'amaterasu'] },
];

// 敵側の初期配置を、中央寄りから左右へ固定順で差し替える。
const COMMON_SLOTS = [4, 3, 5, 2, 6, 1, 7, 0, 8].map((c) => sqOf(2, c));
const UNCOMMON_SLOTS = [sqOf(0, 0), sqOf(0, 8), sqOf(0, 1), sqOf(0, 7), sqOf(0, 2), sqOf(0, 6)];
const HIGH_SLOTS = [sqOf(0, 3), sqOf(0, 5), sqOf(1, 1), sqOf(1, 7), sqOf(0, 2), sqOf(0, 6)];

export function stageDef(stage: number): StageDef {
  const found = STAGES[stage - 1];
  if (!found || found.stage !== stage) throw new Error(`invalid stage: ${stage}`);
  return found;
}

export function enemySetupFor(stage: number): Record<number, string> {
  const data = stageDef(stage);
  const out: Record<number, string> = {};
  let commonIndex = 0;
  let uncommonIndex = 0;
  let highIndex = 0;
  if (data.boss) out[sqOf(0, 4)] = data.boss;
  for (const id of data.enemySpecials) {
    const rarity = def(id).rarity;
    let sq: number | undefined;
    if (rarity === 'common') sq = COMMON_SLOTS[commonIndex++];
    else if (rarity === 'uncommon') sq = UNCOMMON_SLOTS[uncommonIndex++];
    else sq = HIGH_SLOTS[highIndex++];
    if (sq === undefined || out[sq]) throw new Error(`no replacement slot for ${id} on stage ${stage}`);
    out[sq] = id;
  }
  return out;
}
