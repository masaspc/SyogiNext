// 盤: (Piece|null)[81]、index = row*9 + col。row0=敵陣最奥、row8=自陣(player)最奥。
// 方向ベクトル[dy,dx]は常に「その駒の持ち主から見た向き」(dy=-1が前)。enemyはエンジンがdyを反転する。

export type Owner = 'player' | 'enemy';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'celestial' | 'forbidden';
export type ActiveKind = 'warp' | 'kingSwap' | 'snipe' | 'convert' | 'bolt' | 'gale' | 'timestop' | 'execute' | 'ohabari' | 'apocalypse';

export interface Piece {
  id: number;
  defId: string;
  owner: Owner;
  promoted: boolean;
  usesLeft?: number; // アクティブ能力の残回数
  revived?: boolean; // 不死鳥: 復活済みか
  autoCount?: number; // 自動行動の経過手番数
}

export type GameEvent =
  | { t: 'capture' | 'vanish' | 'explode' | 'revive' | 'warp' | 'petrify' | 'convert' | 'pull' | 'snipe' | 'swap' | 'bolt' | 'gale' | 'timestop' | 'execute' | 'devour' | 'spawn' | 'resurrect' | 'sacrifice' | 'doomsday' | 'apocalypse' | 'curse'; sq: number; defId: string }
  | { t: 'win'; who: Owner };

export interface GameState {
  board: (Piece | null)[]; // 81
  hands: Record<Owner, Record<string, number>>; // 通常駒defId → 枚数
  turn: Owner;
  moveCount: number;
  petrified: Record<number, number>; // pieceId → 残り「その駒の持ち主の手番」数
  graveyard: { defId: string; promoted: boolean }[]; // 持ち駒にならず消滅した非ロイヤル(古い順)
  cursedKing: Record<Owner, boolean>; // 契約の魔神を失った側の王の永続呪い
  bossDodgesLeft: number; // 敵ボスの回避ワープ残
  winner: Owner | null;
  nextPieceId: number;
  rngState: number;
  events: GameEvent[]; // 直近1手で起きた演出用イベント
}

export type Dir = readonly [number, number]; // [dy, dx] 持ち主視点

export type MovePattern =
  | { type: 'step'; dirs: readonly Dir[] }
  | { type: 'slide'; dirs: readonly Dir[]; max?: number; pierce?: number }
  | { type: 'jump'; offsets: readonly Dir[] }
  | { type: 'lion' };

export interface MoveInfo {
  from: number;
  to: number;
  isJump: boolean;
}

export interface PieceDef {
  id: string;
  name: string;
  kanji: string;
  desc?: string; // 能力説明(図鑑・カード用)
  rarity?: Rarity; // 通常駒・ボスはなし
  moves: MovePattern[];
  promotesTo?: string; // 成り先defId。'gold'なら動きだけ金化(能力保持)
  demotesTo?: string; // 成り形→元defId(持ち駒化・図鑑用)
  isRoyal?: boolean; // 王・太子・ボス駒
  isNormal?: boolean; // 通常将棋の駒(持ち駒化・傀儡師の対象)
  aiValue: number;
  // 能力(データタグ+純粋関数。GameStateには関数を入れない)
  blockCapture?: (attacker: Piece, attackerDef: PieceDef, moveInfo: MoveInfo, target: Piece, state: GameState) => boolean;
  onCapturedEffects?: 'grudge' | 'bomb' | 'foxRevert' | 'phoenixRevive';
  onCaptureAoE?: boolean; // 死神: 捕獲後、周囲の敵非ロイヤルを消滅
  aura?: 'guardian' | 'overlord'; // 軍神 / 覇王
  active?: { kind: ActiveKind; uses: number };
  auto?:
    | { kind: 'spawn'; every: number; sequence: { defId: string; promoted?: boolean }[] }
    | { kind: 'replicate'; every: number }
    | { kind: 'devour'; every: number; allyFallback?: boolean }
    | { kind: 'corrupt'; every: number }
    | { kind: 'gate'; every: number }
    | { kind: 'swapChaos'; every: number };
  leaveBehind?: { defId: string };
  paralysisAura?: boolean;
  banEnemyDrops?: boolean;
  afterMoveChoice?: 'magnetPull' | 'petrify';
  dodge?: number; // 九尾2 / 覇王3
  chainOnCapture?: boolean; // 影の刺客
  chainCostsHand?: boolean; // 血の女王: 追撃前に持ち駒を供物にする
  doomsday?: boolean; // 下剋上: 敵陣最奥到達で敵軍を消滅
  kingBoon?: boolean; // 契約の魔神: 王を強化し、除去時に呪う
}

export type Move =
  | {
      kind: 'move';
      from: number;
      to: number;
      promote: boolean;
      second?: number | null; // 獅子の二段目(null=停止)
      chain?: number | null; // 影の刺客の追撃先
      pull?: { target: number; to: number } | null; // 磁将
      petrify?: number | null; // 石化の魔女(対象マス)
    }
  | { kind: 'drop'; defId: string; to: number }
  | { kind: 'active'; from: number; ability: ActiveKind; target: number }
  | { kind: 'pass' };

export type RunPhase = 'formation' | 'battle' | 'reward' | 'gameover' | 'cleared';

export interface RunState {
  mode: 'normal' | 'beginner';
  stage: number; // 1..15
  roster: string[]; // 所持特殊駒defId(重複可)
  formation: Record<number, string>; // playerの初期マスindex → 特殊駒defId
  game: GameState | null;
  phase: RunPhase;
  rewardOffer: string[] | null;
  rngState: number;
}

export interface Stats {
  version: number;
  runs: number;
  clears: number;
  bestStage: number;
  lastMode?: string;
}

export const rowOf = (sq: number): number => Math.floor(sq / 9);
export const colOf = (sq: number): number => sq % 9;
export const sqOf = (row: number, col: number): number => row * 9 + col;
export const onBoard = (row: number, col: number): boolean => row >= 0 && row < 9 && col >= 0 && col < 9;
