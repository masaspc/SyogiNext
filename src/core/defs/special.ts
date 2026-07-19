import type { Dir, PieceDef } from '../types';
import { ALL8, DIAG, GOLD_DIRS, ORTH } from './normal';

const F: Dir = [-1, 0];
const B: Dir = [1, 0];
const L: Dir = [0, -1];
const R: Dir = [0, 1];
const FL: Dir = [-1, -1];
const FR: Dir = [-1, 1];
const BL: Dir = [1, -1];
const BR: Dir = [1, 1];

// ===== コモン(§6.1) =====
const COMMONS: PieceDef[] = [
  { id: 'chunin', name: '仲人', kanji: '仲', rarity: 'common', aiValue: 250, moves: [{ type: 'step', dirs: [F, B] }], promotesTo: 'gold', desc: '前後に1マス動ける。' },
  { id: 'sekisho', name: '石将', kanji: '石', rarity: 'common', aiValue: 260, moves: [{ type: 'step', dirs: [FL, FR] }], promotesTo: 'gold', desc: '斜め前に1マス動ける。' },
  { id: 'tessho', name: '鉄将', kanji: '鉄', rarity: 'common', aiValue: 280, moves: [{ type: 'step', dirs: [F, FL, FR] }], promotesTo: 'gold', desc: '前と斜め前に1マス動ける。' },
  { id: 'dosho', name: '銅将', kanji: '銅', rarity: 'common', aiValue: 320, moves: [{ type: 'step', dirs: [F, FL, FR, B] }], promotesTo: 'gold', desc: '前3方向と真後ろに1マス動ける。' },
  { id: 'dog', name: '犬', kanji: '犬', rarity: 'common', aiValue: 300, moves: [{ type: 'step', dirs: [F, BL, BR] }], promotesTo: 'wolf', desc: '前と斜め後ろに1マス動ける。成ると狼になる。' },
  { id: 'wolf', name: '狼', kanji: '狼', aiValue: 480, moves: [{ type: 'step', dirs: [F, B, FL, FR] }], demotesTo: 'dog', desc: '前後と斜め前に1マス動ける。' },
  { id: 'rabbit', name: '兎', kanji: '兎', rarity: 'common', aiValue: 340, moves: [{ type: 'step', dirs: [F] }, { type: 'jump', offsets: [[-2, -2], [-2, 2]] }], promotesTo: 'gold', desc: '前に1マス、または斜め前に2マス跳ぶ(駒を飛び越せる)。' },
  { id: 'archer', name: '弓兵', kanji: '弓', rarity: 'common', aiValue: 360, moves: [{ type: 'step', dirs: [F] }, { type: 'jump', offsets: [[-2, 0]] }], promotesTo: 'ohyumi', desc: '前に1マス、または前に2マス跳ぶ(飛び越えて捕獲できる)。成ると大弓になる。' },
  { id: 'ohyumi', name: '大弓', kanji: '大弓', aiValue: 550, moves: [{ type: 'step', dirs: [F, FL, FR, L, R] }, { type: 'jump', offsets: [[-2, 0]] }], demotesTo: 'archer', desc: '前・斜め前・横に1マス、または前に2マス跳ぶ。' },
  {
    id: 'mole', name: '土竜', kanji: '土', rarity: 'common', aiValue: 300,
    moves: [{ type: 'step', dirs: [F, B] }], promotesTo: 'gold',
    desc: '前後に1マス動ける。生駒の歩・香からは取られない。',
    blockCapture: (_a, aDef) => aDef.id === 'pawn' || aDef.id === 'lance',
  },
  { id: 'mokusho', name: '木将', kanji: '木', rarity: 'common', aiValue: 300, moves: [{ type: 'step', dirs: DIAG }], promotesTo: 'gold', desc: '斜め4方向に1マス動ける。' },
  { id: 'kihei', name: '旗兵', kanji: '旗', rarity: 'common', aiValue: 320, moves: [{ type: 'step', dirs: [F, L, R] }], promotesTo: 'gold', desc: '前と横に1マス動ける。' },
];

export const SPECIAL_DEFS: PieceDef[] = [...COMMONS];

// UI用: プレイヤーが獲得できる駒(成り形は除く)
export function obtainableIds(): string[] {
  return SPECIAL_DEFS.filter((d) => d.rarity).map((d) => d.id);
}

// 参照だけ先に出しておく(未使用警告回避のためexport)
export { ALL8, GOLD_DIRS, ORTH };
