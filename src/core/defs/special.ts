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

// ===== アンコモン(§6.2) =====
const UNCOMMONS: PieceDef[] = [
  { id: 'leopard', name: '猛豹', kanji: '豹', rarity: 'uncommon', aiValue: 600, moves: [{ type: 'step', dirs: [F, B, FL, FR, BL, BR] }], promotesTo: 'bishop', desc: '前後と斜めに1マス動ける。成ると角行になる。' },
  { id: 'windmill', name: '風車', kanji: '風', rarity: 'uncommon', aiValue: 650, moves: [{ type: 'slide', dirs: [L, R] }, { type: 'step', dirs: [F, B] }], promotesTo: 'rook', desc: '横に何マスでも、前後に1マス動ける。成ると飛車になる。' },
  { id: 'knight8', name: '八方桂', kanji: '八', rarity: 'uncommon', aiValue: 620, moves: [{ type: 'jump', offsets: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]] }], promotesTo: 'gold', desc: '桂馬の動きを8方向に跳べる(駒を飛び越せる)。' },
  { id: 'spearman', name: '槍兵', kanji: '槍', rarity: 'uncommon', aiValue: 520, moves: [{ type: 'slide', dirs: [F], max: 2 }, { type: 'step', dirs: [L, R] }], promotesTo: 'longspear', desc: '前に2マスまで、横に1マス動ける。成ると長槍になる。' },
  { id: 'longspear', name: '長槍', kanji: '長槍', aiValue: 650, moves: [{ type: 'slide', dirs: [F], max: 3 }, { type: 'step', dirs: [L, R, FL, FR] }], demotesTo: 'spearman', desc: '前に3マスまで、横・斜め前に1マス動ける。' },
  {
    id: 'shieldman', name: '盾兵', kanji: '盾', rarity: 'uncommon', aiValue: 500,
    moves: [{ type: 'step', dirs: ORTH }], promotesTo: 'gold',
    desc: '縦横に1マス動ける。正面からの直進では取られない。',
    blockCapture: (_a, _aDef, info, target) => {
      const fRow = Math.floor(info.from / 9);
      const tRow = Math.floor(info.to / 9);
      const fwd = target.owner === 'player' ? -1 : 1;
      return !info.isJump && info.from % 9 === info.to % 9 && Math.sign(fRow - tRow) === fwd;
    },
  },
  { id: 'grudge', name: '怨念', kanji: '怨', rarity: 'uncommon', aiValue: 560, moves: [{ type: 'step', dirs: DIAG }], onCapturedEffects: 'grudge', desc: '斜めに1マス動ける。取られたとき、取った駒も道連れにして消滅させる(王・ボスを除く)。' },
  { id: 'ninja', name: '隠密', kanji: '忍', rarity: 'uncommon', aiValue: 540, moves: [{ type: 'step', dirs: [F, FL, FR, BL, BR] }], promotesTo: 'gold', active: { kind: 'warp', uses: 1 }, desc: '前と斜めに1マス動ける。1ゲーム1回、自陣の空きマスへワープできる。' },
  { id: 'fox', name: '妖狐', kanji: '狐', rarity: 'uncommon', aiValue: 560, moves: [{ type: 'slide', dirs: DIAG, max: 2 }], promotesTo: 'gold', onCapturedEffects: 'foxRevert', desc: '斜めに2マスまで動ける。取られても消滅せず、自分の駒台に歩として戻る。' },
  { id: 'kagemusha', name: '影武者', kanji: '影', rarity: 'uncommon', aiValue: 600, moves: [{ type: 'step', dirs: ALL8 }], active: { kind: 'kingSwap', uses: 1 }, desc: '玉と同じく8方向に1マス動ける。1ゲーム1回、味方の王と位置を入れ替えられる。' },
];

// ===== レア(§6.3) =====
const RARES: PieceDef[] = [
  { id: 'elephant', name: '酔象', kanji: '象', rarity: 'rare', aiValue: 850, moves: [{ type: 'step', dirs: [F, FL, FR, L, R, BL, BR] }], promotesTo: 'crownprince', desc: '真後ろ以外の7方向に1マス動ける。成ると太子(第二の王)になる。' },
  { id: 'crownprince', name: '太子', kanji: '太', aiValue: 100000, isRoyal: true, moves: [{ type: 'step', dirs: ALL8 }], demotesTo: 'elephant', desc: '8方向に1マス動ける。王が取られても太子がいれば敗北しない。' },
  { id: 'kirin', name: '麒麟', kanji: '麒', rarity: 'rare', aiValue: 900, moves: [{ type: 'jump', offsets: [[-2, 0], [2, 0], [0, -2], [0, 2]] }, { type: 'step', dirs: DIAG }], promotesTo: 'lion', desc: '縦横に2マス跳び、斜めに1マス動ける。成ると獅子になる。' },
  { id: 'phoenix', name: '鳳凰', kanji: '鳳', rarity: 'rare', aiValue: 900, moves: [{ type: 'jump', offsets: [[-2, -2], [-2, 2], [2, -2], [2, 2]] }, { type: 'step', dirs: ORTH }], promotesTo: 'honno', desc: '斜めに2マス跳び、縦横に1マス動ける。成ると奔王になる。' },
  { id: 'bomber', name: '爆弾兵', kanji: '爆', rarity: 'rare', aiValue: 800, moves: [{ type: 'step', dirs: ORTH }], onCapturedEffects: 'bomb', desc: '縦横に1マス動ける。取られたとき、取った駒と周囲8マスの全駒を消滅させる(王・ボスを除く。敵味方無差別)。' },
  { id: 'magnet', name: '磁将', kanji: '磁', rarity: 'rare', aiValue: 850, moves: [{ type: 'step', dirs: ALL8 }], afterMoveChoice: 'magnetPull', desc: '8方向に1マス動ける。移動後、縦横直線上の最寄りの敵駒を1マス引き寄せられる。' },
  { id: 'sniper', name: '狙撃手', kanji: '狙', rarity: 'rare', aiValue: 880, moves: [{ type: 'step', dirs: DIAG }], active: { kind: 'snipe', uses: 2 }, desc: '斜めに1マス動ける。1ゲーム2回、前方直線3マス以内の敵駒を狙撃して消滅させられる(王不可・間に駒があると不可)。' },
  { id: 'assassin', name: '影の刺客', kanji: '刺', rarity: 'rare', aiValue: 950, moves: [{ type: 'slide', dirs: DIAG }], chainOnCapture: true, desc: '角と同じく斜めに何マスでも動ける。敵駒を取ったとき、続けてもう1回だけ移動できる。' },
  { id: 'witch', name: '石化の魔女', kanji: '魔', rarity: 'rare', aiValue: 900, moves: [{ type: 'slide', dirs: DIAG, max: 2 }], afterMoveChoice: 'petrify', desc: '斜めに2マスまで動ける。移動後、隣接する敵駒1体を相手の次の手番の間、行動不能にできる。' },
];

// ===== 神話レア(§6.4) =====
// lion / honno は麒麟・鳳凰の成り先であると同時に、報酬から直接獲得できる。
const MYTHICS: PieceDef[] = [
  { id: 'lion', name: '獅子', kanji: '獅', rarity: 'mythic', aiValue: 1600, moves: [{ type: 'lion' }], demotesTo: 'kirin', desc: '8方向に1マスずつ、1手番に2回まで動ける。1回で停止したり、元のマスへ戻る居食いもできる。' },
  { id: 'honno', name: '奔王', kanji: '奔', rarity: 'mythic', aiValue: 1500, moves: [{ type: 'slide', dirs: ALL8 }], demotesTo: 'phoenix', desc: '全8方向に何マスでも動ける。' },
  { id: 'phoenix_b', name: '不死鳥', kanji: '不死', rarity: 'mythic', aiValue: 1400, moves: [{ type: 'slide', dirs: DIAG }, { type: 'step', dirs: ORTH }], onCapturedEffects: 'phoenixRevive', desc: '斜めに何マスでも、縦横に1マス動ける。取られたとき1度だけ、自陣のランダムな空きマスへ復活する。' },
  { id: 'gunshin', name: '軍神', kanji: '軍', rarity: 'mythic', aiValue: 1300, moves: [{ type: 'step', dirs: ALL8 }], aura: 'guardian', desc: '8方向に1マス動ける。隣接する味方の非ロイヤル駒を敵の捕獲から守る。' },
  { id: 'kugutsushi', name: '傀儡師', kanji: '傀', rarity: 'mythic', aiValue: 1200, moves: [{ type: 'slide', dirs: ORTH, max: 2 }], active: { kind: 'convert', uses: 1 }, desc: '縦横に2マスまで動ける。1ゲーム1回、隣接する敵の通常駒を自軍に寝返らせる。' },
  { id: 'raijin', name: '雷神', kanji: '雷', rarity: 'mythic', aiValue: 1700, moves: [{ type: 'slide', dirs: ORTH, max: 2 }, { type: 'step', dirs: DIAG }], active: { kind: 'bolt', uses: 1 }, desc: '縦横に2マスまで、斜めに1マス動ける。1ゲーム1回、選んだ縦一列の敵非ロイヤル駒を落雷で全て消滅させる。' },
  { id: 'fujin', name: '風神', kanji: '風神', rarity: 'mythic', aiValue: 1350, moves: [{ type: 'slide', dirs: [L, R] }, { type: 'slide', dirs: [F, B], max: 2 }], active: { kind: 'gale', uses: 2 }, desc: '横に何マスでも、前後に2マスまで動ける。2回、選んだ段の敵駒を自陣方向へ1マス押し戻す。' },
  { id: 'chibosin', name: '地母神', kanji: '地母', rarity: 'mythic', aiValue: 1400, moves: [{ type: 'step', dirs: ORTH }], auto: { kind: 'spawn', every: 1, sequence: [{ defId: 'pawn' }] }, desc: '縦横に1マス動ける。自分の毎手番終了時、隣接する空きマスに歩を生成する(顕現駒は敵に奪われない)。' },
  { id: 'kajishin', name: '鍛冶神', kanji: '鍛', rarity: 'mythic', aiValue: 1500, moves: [{ type: 'slide', dirs: DIAG, max: 2 }], auto: { kind: 'spawn', every: 2, sequence: [{ defId: 'gold' }, { defId: 'silver' }] }, desc: '斜めに2マスまで動ける。自分の2手番ごとに金、銀の順で隣接する空きマスへ顕現させる(敵に奪われない)。' },
  { id: 'shinigami', name: '死神', kanji: '死', rarity: 'mythic', aiValue: 1650, moves: [{ type: 'slide', dirs: DIAG }], onCaptureAoE: true, desc: '斜めに何マスでも動ける。敵駒を捕獲すると、着地地点の周囲にいる敵非ロイヤル駒も消滅させる。' },
  { id: 'tokinomiko', name: '時の巫女', kanji: '時', rarity: 'mythic', aiValue: 1550, moves: [{ type: 'step', dirs: ALL8 }], active: { kind: 'timestop', uses: 1 }, desc: '8方向に1マス動ける。1ゲーム1回、敵の全非ロイヤル駒を次の敵手番の間だけ行動不能にする。' },
  { id: 'zanei', name: '残影', kanji: '残', rarity: 'mythic', aiValue: 1450, moves: [{ type: 'slide', dirs: ORTH, max: 2 }], leaveBehind: { defId: 'pawn' }, desc: '縦横に2マスまで動ける。移動するたび、最初にいたマスへ敵に奪われない顕現の歩を残す。' },
  { id: 'bunshin', name: '分身武者', kanji: '分', rarity: 'mythic', aiValue: 1550, moves: [{ type: 'step', dirs: ALL8 }], auto: { kind: 'replicate', every: 2 }, desc: '8方向に1マス動ける。自分の2手番ごとに隣接する空きマスへ自身の分身を生成する。' },
];

// ===== 天上レア =====
const CELESTIALS: PieceDef[] = [
  { id: 'amaterasu', name: '天照', kanji: '天照', rarity: 'celestial', aiValue: 2600, moves: [{ type: 'slide', dirs: ALL8 }], paralysisAura: true, desc: '全8方向に何マスでも動ける。隣接する敵非ロイヤル駒を麻痺させ、行動不能にする。' },
  { id: 'susanoo', name: '須佐之男', kanji: '須佐', rarity: 'celestial', aiValue: 2400, moves: [{ type: 'slide', dirs: ORTH }, { type: 'slide', dirs: DIAG, max: 2 }], active: { kind: 'ohabari', uses: 1 }, desc: '縦横に何マスでも、斜めに2マスまで動ける。1回、十拳剣で自身中心5×5の敵非ロイヤル駒を消滅させる。' },
  { id: 'tsukuyomi', name: '月読', kanji: '月読', rarity: 'celestial', aiValue: 2000, moves: [{ type: 'slide', dirs: ALL8, max: 2 }], banEnemyDrops: true, desc: '全8方向に2マスまで動ける。盤上にいる間、敵は持ち駒を打てない。' },
  { id: 'inari', name: '稲荷', kanji: '稲荷', rarity: 'celestial', aiValue: 2500, moves: [{ type: 'jump', offsets: [[-2, -2], [-2, 2], [2, -2], [2, 2]] }, { type: 'step', dirs: ORTH }], auto: { kind: 'spawn', every: 1, sequence: [{ defId: 'silver' }, { defId: 'gold' }, { defId: 'bishop' }, { defId: 'rook' }, { defId: 'bishop', promoted: true }] }, desc: '斜めに2マス跳び、縦横に1マス動ける。毎手番、銀・金・角・飛・馬の順に生成する(顕現駒は敵に奪われない)。' },
  { id: 'orochi', name: '八岐大蛇', kanji: '大蛇', rarity: 'celestial', aiValue: 2400, moves: [{ type: 'step', dirs: ALL8 }], auto: { kind: 'devour', every: 1 }, desc: '8方向に1マス動ける。毎手番終了時、守られていない隣接敵非ロイヤル駒1体を捕食して消滅させる。' },
  { id: 'magatsukami', name: '禍津神', kanji: '禍', rarity: 'celestial', aiValue: 2200, moves: [{ type: 'slide', dirs: DIAG, max: 2 }], auto: { kind: 'corrupt', every: 2 }, desc: '斜めに2マスまで動ける。2手番ごとに隣接する敵の通常駒1体を自軍へ寝返らせる。' },
  { id: 'enma', name: '閻魔', kanji: '閻', rarity: 'celestial', aiValue: 2200, moves: [{ type: 'step', dirs: ALL8 }], active: { kind: 'execute', uses: 3 }, desc: '8方向に1マス動ける。3回、盤上の任意の敵非ロイヤル駒1体を断罪して消滅させる。' },
  { id: 'ryujin', name: '龍神', kanji: '龍神', rarity: 'celestial', aiValue: 2600, moves: [{ type: 'slide', dirs: ALL8, pierce: 1 }], desc: '全8方向に何マスでも動ける。敵味方を問わず駒1枚だけを飛び越えて先へ進める。' },
];

// ===== 禁忌レア =====
const FORBIDDEN: PieceDef[] = [
  { id: 'maou', name: '魔王', kanji: '魔王', rarity: 'forbidden', aiValue: 3200, moves: [{ type: 'slide', dirs: ALL8 }, { type: 'lion' }], auto: { kind: 'devour', every: 1, allyFallback: true }, desc: '全8方向への走りと獅子の二回行動を併せ持つ。毎手番、隣接敵を捕食するが、敵がいなければ味方を喰らう。' },
  { id: 'gekokujo', name: '下剋上', kanji: '下剋', rarity: 'forbidden', aiValue: 1800, moves: [{ type: 'step', dirs: [F] }], doomsday: true, desc: '前に1マスしか進めない。敵陣最奥へ到達した瞬間、敵の全非ロイヤル駒を消滅させる。' },
  { id: 'meifu', name: '冥府の門', kanji: '冥門', rarity: 'forbidden', aiValue: 2800, moves: [], auto: { kind: 'gate', every: 1 }, desc: '一切動けない。毎手番、墓地で最も古い駒1体を敵に奪われない顕現駒として蘇生し続ける。' },
  { id: 'amanojaku', name: '天邪鬼', kanji: '天邪', rarity: 'forbidden', aiValue: 2000, moves: [{ type: 'step', dirs: ALL8 }], auto: { kind: 'swapChaos', every: 1 }, desc: '8方向に1マス動ける。毎手番、敵非ロイヤル1体と自軍非ロイヤル1体の位置を無作為に強制交換する。' },
  { id: 'majin', name: '契約の魔神', kanji: '契魔', rarity: 'forbidden', aiValue: 2600, moves: [{ type: 'slide', dirs: ORTH }, { type: 'slide', dirs: DIAG, max: 2 }], kingBoon: true, desc: '盤上にいる間は自軍の王を8方向2マスへ強化する。失うと王は前1しか動けない永続呪いを受ける。' },
  { id: 'chinojoou', name: '血の女王', kanji: '血后', rarity: 'forbidden', aiValue: 2400, moves: [{ type: 'slide', dirs: DIAG }, { type: 'step', dirs: [L, R] }], chainOnCapture: true, chainCostsHand: true, desc: '斜めに何マスでも、横に1マス動ける。捕獲時、持ち駒1枚を供物に捧げると続けてもう1回移動できる。' },
  { id: 'hoshikui', name: '星喰い', kanji: '星喰', rarity: 'forbidden', aiValue: 2200, moves: [{ type: 'jump', offsets: [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [-2, 2], [2, -2], [2, 2]] }], active: { kind: 'apocalypse', uses: 1 }, desc: '8方向へ2マス跳ぶ。終焉を使うと自身を含む全非ロイヤル駒と両軍の持ち駒を消し去る。' },
];

export const SPECIAL_DEFS: PieceDef[] = [...COMMONS, ...UNCOMMONS, ...RARES, ...MYTHICS, ...CELESTIALS, ...FORBIDDEN];

// UI用: プレイヤーが獲得できる駒(成り形は除く)
export function obtainableIds(): string[] {
  return SPECIAL_DEFS.filter((d) => d.rarity).map((d) => d.id);
}

// 参照だけ先に出しておく(未使用警告回避のためexport)
export { ALL8, GOLD_DIRS, ORTH };
