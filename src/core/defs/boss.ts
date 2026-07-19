import type { Dir, PieceDef } from '../types';
import { ALL8 } from './normal';

const F: Dir = [-1, 0];
const B: Dir = [1, 0];
const L: Dir = [0, -1];
const R: Dir = [0, 1];
const FL: Dir = [-1, -1];
const FR: Dir = [-1, 1];
const BL: Dir = [1, -1];
const BR: Dir = [1, 1];

// 敵専用ボス(§6.5)。鬼武者の前1はslide側に含め、重複手を生成しない。
export const BOSS_DEFS: PieceDef[] = [
  {
    id: 'onimusha', name: '鬼武者', kanji: '鬼', aiValue: 100000, isRoyal: true,
    moves: [{ type: 'step', dirs: [B, L, R, FL, FR, BL, BR] }, { type: 'slide', dirs: [F], max: 2 }],
    desc: '8方向に1マス、前方に限り2マスまで動ける。',
  },
  {
    id: 'kyubi', name: '九尾', kanji: '九', aiValue: 100000, isRoyal: true,
    moves: [{ type: 'slide', dirs: ALL8, max: 2 }], dodge: 2,
    desc: '8方向に2マスまで動ける。攻撃を受けると最大2回、安全な隣接マスへ回避する。',
  },
  {
    id: 'haoh', name: '覇王', kanji: '覇', aiValue: 100000, isRoyal: true,
    moves: [{ type: 'slide', dirs: ALL8, max: 2 }], dodge: 3, aura: 'overlord',
    desc: '8方向に2マスまで動ける。最大3回の回避と、隣接する配下を守るオーラを持つ。',
  },
];
