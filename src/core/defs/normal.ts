import type { Dir, PieceDef } from '../types';

const F: Dir = [-1, 0];
const B: Dir = [1, 0];
const L: Dir = [0, -1];
const R: Dir = [0, 1];
const FL: Dir = [-1, -1];
const FR: Dir = [-1, 1];
const BL: Dir = [1, -1];
const BR: Dir = [1, 1];

export const GOLD_DIRS: readonly Dir[] = [F, FL, FR, L, R, B];
export const ALL8: readonly Dir[] = [F, B, L, R, FL, FR, BL, BR];
export const DIAG: readonly Dir[] = [FL, FR, BL, BR];
export const ORTH: readonly Dir[] = [F, B, L, R];

export const NORMAL_DEFS: PieceDef[] = [
  { id: 'pawn', name: '歩兵', kanji: '歩', isNormal: true, aiValue: 90, moves: [{ type: 'step', dirs: [F] }], promotesTo: 'tokin' },
  { id: 'lance', name: '香車', kanji: '香', isNormal: true, aiValue: 300, moves: [{ type: 'slide', dirs: [F] }], promotesTo: 'p_lance' },
  { id: 'knight', name: '桂馬', kanji: '桂', isNormal: true, aiValue: 320, moves: [{ type: 'jump', offsets: [[-2, -1], [-2, 1]] }], promotesTo: 'p_knight' },
  { id: 'silver', name: '銀将', kanji: '銀', isNormal: true, aiValue: 450, moves: [{ type: 'step', dirs: [F, FL, FR, BL, BR] }], promotesTo: 'p_silver' },
  { id: 'gold', name: '金将', kanji: '金', isNormal: true, aiValue: 500, moves: [{ type: 'step', dirs: GOLD_DIRS }] },
  { id: 'bishop', name: '角行', kanji: '角', isNormal: true, aiValue: 800, moves: [{ type: 'slide', dirs: DIAG }], promotesTo: 'horse' },
  { id: 'rook', name: '飛車', kanji: '飛', isNormal: true, aiValue: 950, moves: [{ type: 'slide', dirs: ORTH }], promotesTo: 'dragon' },
  { id: 'king', name: '王将', kanji: '王', isNormal: true, isRoyal: true, aiValue: 100000, moves: [{ type: 'step', dirs: ALL8 }] },
  // 成り駒
  { id: 'tokin', name: 'と金', kanji: 'と', isNormal: true, aiValue: 600, moves: [{ type: 'step', dirs: GOLD_DIRS }], demotesTo: 'pawn' },
  { id: 'p_lance', name: '成香', kanji: '杏', isNormal: true, aiValue: 520, moves: [{ type: 'step', dirs: GOLD_DIRS }], demotesTo: 'lance' },
  { id: 'p_knight', name: '成桂', kanji: '圭', isNormal: true, aiValue: 520, moves: [{ type: 'step', dirs: GOLD_DIRS }], demotesTo: 'knight' },
  { id: 'p_silver', name: '成銀', kanji: '全', isNormal: true, aiValue: 520, moves: [{ type: 'step', dirs: GOLD_DIRS }], demotesTo: 'silver' },
  { id: 'horse', name: '龍馬', kanji: '馬', isNormal: true, aiValue: 1100, moves: [{ type: 'slide', dirs: DIAG }, { type: 'step', dirs: ORTH }], demotesTo: 'bishop' },
  { id: 'dragon', name: '龍王', kanji: '竜', isNormal: true, aiValue: 1300, moves: [{ type: 'slide', dirs: ORTH }, { type: 'step', dirs: DIAG }], demotesTo: 'rook' },
];

// 持ち駒として打てる通常駒(成り駒・王を除く)
export const DROPPABLE: readonly string[] = ['pawn', 'lance', 'knight', 'silver', 'gold', 'bishop', 'rook'];
