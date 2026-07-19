# 将棋NEXT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9x9固定盤・純将棋ルールで特殊駒を獲得しながら15面を攻略するブラウザローグライト将棋を、スペック(`docs/superpowers/specs/2026-07-19-shogi-next-design.md`、以下§参照は同書)どおりに実装する。

**Architecture:** `src/core`は純粋関数+データ駆動の駒定義(フック式能力)。AIはWeb Worker内のnegamax+αβ。UIは素のDOM。GameStateは構造化クローン可能なプレーンオブジェクトのみ。

**Tech Stack:** Vite + TypeScript(strict) + Vitest。ランタイム依存ゼロ。

## Global Constraints

- スペック(§番号)が正。駒データ・確率・ステージ編成・裁定は§4〜§7の表を一字一句そのまま実装する。
- 乱数は全て`src/core/rng.ts`のシード付きRNG経由(`Math.random`禁止)。GameState/RunStateに`rngState`を保持。
- GameState/RunStateは関数・クラスインスタンスを含まないプレーンJSON(Worker/localStorage境界を通すため)。
- 座標系: 盤は`(Piece|null)[81]`、index=`row*9+col`。row0=敵陣最奥、row8=自陣最奥。playerの前方向=row減少。方向ベクトルは常に「その駒の持ち主から見た向き」で書き、enemyはエンジンがdy反転する。
- UI文言は日本語。コミットは小さく頻繁に。テストはVitest、`npm test`が常にグリーンでコミット。

## File Structure

```
index.html / package.json / tsconfig.json / vitest.config.ts
src/core/rng.ts        シード付き乱数(mulberry32)
src/core/types.ts      全型定義
src/core/defs/normal.ts   通常駒8+成り6
src/core/defs/special.ts  特殊駒32+固有成り形
src/core/defs/boss.ts     ボス3
src/core/defs/index.ts    PIECE_DEFS登録・検索
src/core/board.ts      初期盤生成・座標/隣接ヘルパ
src/core/movegen.ts    合法手生成(能力込み)
src/core/apply.ts      1手適用・能力解決・勝敗
src/core/stages.ts     15面データ(§5)
src/core/run.ts        ラン進行・報酬・編成・初心者モード
src/ai/eval.ts         評価関数
src/ai/search.ts       negamax+αβ+反復深化
src/ai/worker.ts       Workerエントリ
src/storage.ts         localStorage(3キー、§4.4)
src/ui/*.ts, style.css 画面(タイトル/編成/対局/報酬/図鑑/リザルト)
tests/*.test.ts
```

---

### Task 1: スキャフォールド+RNG+型定義

**Files:** Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `index.html`, `src/core/rng.ts`, `src/core/types.ts`, Test: `tests/rng.test.ts`

**Interfaces (Produces):**

```ts
// rng.ts
export function nextRand(state: number): { value: number; state: number }; // value∈[0,1)
export function randInt(state: number, n: number): { value: number; state: number };
export function seedFromTime(): number;

// types.ts (抜粋 — 完全版をこのタスクで書く)
export type Owner = 'player' | 'enemy';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export interface Piece { id: number; defId: string; owner: Owner; promoted: boolean; usesLeft?: number; revived?: boolean; }
export interface GameState {
  board: (Piece | null)[];            // 81
  hands: Record<Owner, Record<string, number>>; // 通常駒defId→枚数
  turn: Owner; moveCount: number;
  petrified: Record<number, number>;  // pieceId → 残り自ターン数
  bossDodgesLeft: number;             // 敵ボスの回避残
  winner: Owner | null;
  nextPieceId: number; rngState: number;
  events: GameEvent[];                // 直近1手で起きた演出用イベント
}
export type GameEvent =
  | { t:'capture'|'vanish'|'explode'|'revive'|'warp'|'petrify'|'convert'|'pull'|'snipe'; sq:number; defId:string }
  | { t:'check' } | { t:'win'; who:Owner };
export type Dir = readonly [number, number]; // [dy,dx] 持ち主視点
export type MovePattern =
  | { type:'step'; dirs: readonly Dir[] }
  | { type:'slide'; dirs: readonly Dir[]; max?: number }
  | { type:'jump'; offsets: readonly Dir[] }
  | { type:'lion' };
export interface HookCtx { state: GameState; self: Piece; sq: number; }
export interface PieceDef {
  id: string; name: string; kanji: string; rarity?: Rarity;
  moves: MovePattern[]; promotesTo?: string; demotesTo?: string; // 成り形→元(持ち駒化用)
  isRoyal?: boolean; isNormal?: boolean; aiValue: number;
  blockCapture?: (attacker: Piece, attackerDef: PieceDef, moveInfo: {from:number; to:number; isJump:boolean}, target: Piece, state: GameState) => boolean; // trueなら取れない
  onCapturedEffects?: 'grudge' | 'bomb' | 'foxRevert' | 'phoenixRevive'; // apply.tsが解釈(データタグ式)
  aura?: 'guardian' | 'overlord';   // 軍神/覇王
  active?: { kind:'warp'|'kingSwap'|'snipe'|'convert'; uses:number };
  afterMoveChoice?: 'magnetPull' | 'petrify';
  dodge?: number;                    // 九尾2/覇王3
  chainOnCapture?: boolean;          // 影の刺客
}
export type Move =
  | { kind:'move'; from:number; to:number; promote:boolean; second?:number|null; chain?:number|null;
      pull?: {target:number; to:number} | null; petrify?: number | null }
  | { kind:'drop'; defId:string; to:number }
  | { kind:'active'; from:number; ability:'warp'|'kingSwap'|'snipe'|'convert'; target:number };
export interface RunState {
  mode: 'normal'|'beginner'; stage: number;            // 1..15
  roster: string[];                                     // 所持特殊駒defId(重複可)
  formation: Record<number, string>;                    // 初期マスindex→特殊駒defId
  game: GameState | null;                               // 対局中の盤(null=編成/報酬中)
  phase: 'formation'|'battle'|'reward'|'gameover'|'cleared';
  rewardOffer: string[] | null; rngState: number;
}
```

能力は**関数を持たないデータタグ**(`onCapturedEffects:'bomb'`等)で表し、解釈はapply.ts/movegen.tsに集約する(blockCaptureのみ純粋関数でOK — defsはコードなのでWorker境界を越えない)。

- [ ] Step 1: `npm create vite@latest . -- --template vanilla-ts`相当の構成を手書きし、`vitest`をdevDependenciesに追加、`npm install`
- [ ] Step 2: `tests/rng.test.ts`: 同シードで同列を生成/異シードで異なる/randIntが範囲内、を書き失敗確認
- [ ] Step 3: rng.ts(mulberry32)とtypes.tsを実装しテストPASS
- [ ] Step 4: `git add -A && git commit -m "feat: scaffold + rng + core types"`

### Task 2: 通常駒定義と初期盤

**Files:** Create: `src/core/defs/normal.ts`, `src/core/defs/index.ts`, `src/core/board.ts`, Test: `tests/board.test.ts`

**Interfaces (Produces):**

```ts
// defs/index.ts
export const PIECE_DEFS: Record<string, PieceDef>; export function def(id:string): PieceDef;
export function effectiveDef(p: Piece): PieceDef; // promoted なら promotesTo の def
// board.ts
export function initialBoard(formation: Record<number,string>, enemySetup: Record<number,string>, startId?:number): { board:(Piece|null)[]; nextPieceId:number };
export function inCamp(owner:Owner, sq:number): boolean;   // 自陣3段
export function inPromoZone(owner:Owner, sq:number): boolean; // 敵陣3段
export const ADJ: number[][]; // 各マスの隣接(周囲8)index
export function forward(owner:Owner): number; // player:-1, enemy:+1 (dy符号)
```

通常駒: `pawn歩 lance香 knight桂 silver銀 gold金 bishop角 rook飛 king王(isRoyal)` + 成り`tokin と / p_lance 杏 / p_knight 圭 / p_silver 全 / horse 馬 / dragon 竜`(demotesToで逆引き)。aiValue: 歩90 香300 桂320 銀450 金500 角800 飛950 王100000 と600 杏520 圭520 全520 馬1100 竜1300。
`initialBoard`は通常将棋初期配置を置き、`formation`(playerの初期マス→特殊駒defId)と`enemySetup`(同・敵側)で該当マスの駒を差し替える。

- [ ] Step 1: テスト: 初期盤40枚/王の位置/formation指定で差し替わる/inCamp・inPromoZoneの境界(row5,6 / row2,3)
- [ ] Step 2: 実装しPASS、コミット `feat: normal piece defs + initial board`

### Task 3: 通常将棋の合法手生成(移動・成り・打ち)

**Files:** Create: `src/core/movegen.ts`, Test: `tests/movegen.test.ts`

**Interfaces (Produces):**

```ts
export function legalMoves(state: GameState, owner: Owner): Move[];
export function pieceMoves(state: GameState, sq: number): Move[]; // UI用(1駒分)
export function isAttacked(state: GameState, sq: number, by: Owner): boolean; // 王手警告・ボス回避用(byの合法手にtoが含まれるか)
```

要点(§3):
- step/slide(max対応)/jumpを持ち主向きに解釈。移動先が味方駒なら不可、敵駒なら捕獲(後タスクのblockCapture/オーラ検査フックポイントをこの時点で関数`captureAllowed(state,attacker,from,to,isJump)`として用意 — 通常駒は常にtrue)。
- 成り: 敵陣3段に入る/出る/中で動く→`promote:true/false`の2手生成(promotesToが無い駒はfalseのみ)。移動後に合法手が無くなる着地(その駒のパターンが1つも盤内に届かない)は強制成り1手のみ(§7.8。歩香桂+石将鉄将兎弓兵を自動判定で汎用化: 着地マスで非成り時の手が0なら強制)。
- 打ち: handsの通常駒を空きマスへ。二歩(同筋に自分の生歩)禁止、行き所のない打ち禁止。打ち歩詰め判定なし(§3.2)。
- 王手放置チェックはしない(全て合法)。petrifiedのpieceIdの駒は手を生成しない(§7.10)。

- [ ] Step 1: テストを書く: 歩/香(遮蔽)/桂(跳越)/銀金/角飛(スライド)/馬竜、成り2択生成、歩の強制成り、二歩拒否、桂の最奥2段打ち拒否、王手中でも手が生成される
- [ ] Step 2: 実装しPASS、コミット `feat: shogi move generation`

### Task 4: applyMoveと勝敗

**Files:** Create: `src/core/apply.ts`, Test: `tests/apply.test.ts`

**Interfaces (Produces):**

```ts
export function applyMove(state: GameState, move: Move): GameState; // 純粋(新state返す)
```

処理順(§7): (1)移動と捕獲(通常駒捕獲→demotesToで生駒化しhandsへ、特殊駒→消滅[後タスクでonCapturedEffects]) (2)ロイヤル捕獲→相手のisRoyalが盤上0なら`winner` (3)成り適用 (4)petrifiedの自陣側カウント減 (5)ボス回避(後タスク) (6)turn交代・moveCount++・events記録。

- [ ] Step 1: テスト: 捕獲で持ち駒化(成銀→銀)/王を取ると勝ち/成り適用/打ちの適用/手番交代
- [ ] Step 2: 実装しPASS、コミット `feat: applyMove + win detection`

### Task 5: コモン10種(§6.1)

**Files:** Modify: `src/core/defs/special.ts`(新規), `src/core/defs/index.ts`, `src/core/movegen.ts`(captureAllowedにblockCapture接続), Test: `tests/pieces-common.test.ts`

defId: `chunin sekisho tessho dosho dog(→wolf) rabbit archer(→ohyumi) mole mokusho kihei`。aiValue: 250〜420(仲人250/石将260/鉄将280/銅将320/犬300/兎340/弓兵360/土竜300/木将300/旗兵320)。土竜: `blockCapture`=攻撃側effectiveDefが`pawn|lance`(生駒)ならtrue。弓兵/兎: jumpパターン。犬成り=`wolf`(step F,B,FL,FR + 後ろ? →前後+斜め前5方向)、弓兵成り=`ohyumi`(step F,FL,FR,L,R + jump(-2,0))。他成り=`gold`扱い(promotesTo:'gold_of_'は作らず`promotesTo:'tokin'`方式でなく、**汎用: promoted時effectiveDefの動きをgoldに差し替える`promotesTo:'gold'`+能力保持**。effectiveDefは「動き=金、フック=元defのまま」を返す合成defにする)。

- [ ] Step 1: テスト: 各駒の代表配置での合法手集合(全10種)、土竜が歩から取られない(歩の捕獲手が生成されない)がと金からは取られる、弓兵のジャンプ捕獲、石将/鉄将/兎/弓兵の強制成り
- [ ] Step 2: 実装しPASS、コミット `feat: common special pieces (10)`

### Task 6: アンコモン9種(§6.2)

**Files:** Modify: `special.ts`, `movegen.ts`(activeの手生成), `apply.ts`(onCapturedEffects: grudge/foxRevert、active適用), Test: `tests/pieces-uncommon.test.ts`

defId: `leopard(成=bishop) windmill(成=rook) knight8 spearman(→longspear) shieldman grudge ninja fox kagemusha`。aiValue: 500〜700(猛豹600/風車650/八方桂620/槍兵520/盾兵500/怨念560/隠密540/妖狐560/影武者600)。
- 盾兵blockCapture: `!isJump && from%9===to%9 && (from-to)*forward(target.owner)>0`…正面=盾兵の敵側。式: 攻撃元が同列かつ盾兵から見て前方(`Math.sign(rowOf(from)-rowOf(to)) === forward(target.owner)`の逆…テストで確定)。
- 怨念`onCapturedEffects:'grudge'`: 取った駒が非ロイヤルなら消滅(handsに入らない)。
- 妖狐`'foxRevert'`: 消滅の代わりに元の持ち主のhandsに`pawn`+1。
- 隠密`active:{kind:'warp',uses:1}`: 自陣空きマス全てへの`active`手を生成。影武者`kingSwap,uses:1`: 盤上の味方王(不在なら太子)と交換。usesLeftはPiece生成時にdefからコピーし、使用で減。

- [ ] Step 1: テスト: 9種の動き、怨念道連れ(王で取ると王は残る)、妖狐→自陣側の歩に、隠密ワープが1回で尽きる、影武者交換、盾兵が香の直進で取れない/斜めなら取れる、猛豹→角・風車→飛の成り
- [ ] Step 2: 実装しPASS、コミット `feat: uncommon special pieces (9)`

### Task 7: レア8種(§6.3)

**Files:** Modify: `special.ts`, `movegen.ts`(pull/petrify/chainのバリアント生成、snipe active), `apply.ts`(bomb連鎖、pull/petrify/chain適用), Test: `tests/pieces-rare.test.ts`

defId: `elephant(成=crownprince isRoyal) kirin(成=lion) phoenix(成=honno) bomber magnet sniper assassin witch`。aiValue: 800〜1000(酔象850/麒麟900/鳳凰900/爆弾兵800/磁将850/狙撃手880/影の刺客950/魔女900)。
- 爆弾兵`'bomb'`(§7.3-7.4): 捕獲時、取った駒(非ロイヤル)+爆心の周囲8の非ロイヤル全消滅。消滅駒はhands入りなし。連鎖はキュー処理(消滅した爆弾兵も爆発)。爆発消滅では怨念/妖狐/不死鳥は発動しない。
- 磁将`afterMoveChoice:'magnetPull'`: 移動手ごとに`pull:null`+有効なpull選択肢({縦横4方向の最寄り非ロイヤル敵駒, 1マス磁将側が空き}ごと)をバリアント生成。
- 狙撃手`active:{kind:'snipe',uses:2}`: 前方同列3マス以内・遮蔽なし・非ロイヤル敵。消滅(hands無し)。
- 影の刺客`chainOnCapture`: 捕獲した移動手に対し、捕獲後盤面での自駒スライド先を`chain`としてバリアント生成(chain先も捕獲可、そこで終了)。
- 魔女`afterMoveChoice:'petrify'`: 移動後、隣接非ロイヤル敵→`petrify:sq`バリアント。適用でpetrified[pieceId]=1(相手の次手番の間無効、相手手番終了時に解除=§7.10。カウント減はTask4の(4)を「手番を終えた側の駒のpetrifyを解除」に実装)。

- [ ] Step 1: テスト: 8種の動き、太子がいれば王を取られても勝敗未決/両方取られたら敗北、爆弾連鎖と王の生存、磁将pullバリアントの内容、狙撃の遮蔽judge、刺客chainで2枚取り、石化中の駒の手が出ない+1手番後解除
- [ ] Step 2: 実装しPASS、コミット `feat: rare special pieces (8)`

### Task 8: 神話レア5種(§6.4)

**Files:** Modify: `special.ts`, `movegen.ts`(lion複合手・auraのcaptureAllowed・convert), `apply.ts`(lion二段適用・phoenixRevive・convert), Test: `tests/pieces-mythic.test.ts`

defId: `lion honno phoenix_b gunshin kugutsushi`(lion/honnoはRare成り先と共有定義)。aiValue: 獅子1600/奔王1500/不死鳥1400/軍神1300/傀儡師1200。
- 獅子`{type:'lion'}`: 一段目8方向(captureAllowed検査)→一段目適用後の盤で二段目(8方向 or `second:null`停止 or 元マス帰還=居食い)。一段目でロイヤル捕獲なら二段目なし手のみ。
- 不死鳥`'phoenixRevive'`: 捕獲された時`revived`未使用なら自陣ランダム空きマス(rng)へ復活、`revived:true`。空きなしで消滅。爆発では発動しない。
- 軍神`aura:'guardian'`: captureAllowedで「対象が非ロイヤルかつ対象の隣接に対象側のgunshinがいる」ならfalse。
- 傀儡師`active:{kind:'convert',uses:1}`: 隣接の敵**通常駒**(isNormal、非ロイヤル)のownerを反転(promoted維持)。

- [ ] Step 1: テスト: 獅子の2枚取り/居食い/一段目王取りで即勝ち、奔王スライド、不死鳥復活は1度だけ・爆発では復活しない、軍神隣接駒が取れない(手が生成されない)が軍神自身は取れる・王は守られない、傀儡師の寝返り(成銀→自軍の成銀)
- [ ] Step 2: 実装しPASS、コミット `feat: mythic special pieces (5)`

### Task 9: ボス3種+回避ワープ(§6.5)

**Files:** Create: `src/core/defs/boss.ts`, Modify: `apply.ts`(手順(5)), Test: `tests/boss.test.ts`

defId: `onimusha(isRoyal) kyubi(isRoyal,dodge:2) haoh(isRoyal,dodge:3,aura:'overlord')`。aiValue: 100000。
- 回避(§7.5): playerの手が完全解決した後、敵ボスが盤上にいて`isAttacked(state,bossSq,'player')`かつ`bossDodgesLeft>0`なら、隣接の「空きかつ非被攻撃」マスからrngで1つ選び移動、`bossDodgesLeft--`。候補なしなら何もしない。1手番最大1回。
- overlordオーラ: 覇王の隣接味方(非ロイヤル…覇王以外)はguardian同様に保護、覇王自身は対象外。

- [ ] Step 1: テスト: 3種の動き、九尾が利きに入ると隣接安全マスへ逃げ残回数減/安全マスなしなら逃げない/2回で尽きる、覇王隣接の配下が取れない、ボスを取ると勝ち
- [ ] Step 2: 実装しPASS、コミット `feat: boss pieces + dodge warp`

### Task 10: ステージデータとラン進行

**Files:** Create: `src/core/stages.ts`, `src/core/run.ts`, Test: `tests/run.test.ts`

**Interfaces (Produces):**

```ts
// stages.ts
export interface StageDef { stage:number; depth:number; timeMs:number; enemySpecials:string[]; boss?:string }
export const STAGES: StageDef[]; // §5の表そのまま(深度2-5/時間500-3000ms)
export function enemySetupFor(stage:number): Record<number,string>; // 置換規則§5: コモン→歩(中央から4,3,5,2,6,1,7,0,8列)、アンコモン→香桂銀(9,7列…固定順)、レア以上→金角飛、ボス→王マス
// run.ts
export function newRun(mode:'normal'|'beginner', seed:number): RunState; // beginner: §4.1.1(70/30→等確率→金角飛マスへ自動配置)
export function startBattle(run:RunState): RunState;   // formation+enemySetupでGameState生成、phase:'battle'
export function onBattleEnd(run:RunState, winner:Owner): RunState; // 勝ち: stage15なら'cleared'、他は'reward'+rewardOffer3枚(§4.3表+§7.11)。負け:'gameover'
export function takeReward(run:RunState, defId:string|null): RunState; // null=スキップ。stage++、phase:'formation'
export function setFormation(run:RunState, sq:number, defId:string|null): RunState; // 玉マス不可・roster在庫検査
```

- [ ] Step 1: テスト: 15面データの件数/深度、置換規則で敵特殊駒が正しいマスに載る、報酬確率(rngを固定し§4.3の境界: 面1でmythic0%・面5でrare/mythicのみ)、3枚が互いに異なる、初心者モードでrare/mythicが1枚roster+formationに入る、敗北でgameover、編成の玉マス拒否
- [ ] Step 2: 実装しPASS、コミット `feat: stages + run progression + beginner mode`

### Task 11: AI(評価+探索+Worker)

**Files:** Create: `src/ai/eval.ts`, `src/ai/search.ts`, `src/ai/worker.ts`, Test: `tests/ai.test.ts`

**Interfaces (Produces):**

```ts
// eval.ts  (常にowner視点の点数)
export function evaluate(state: GameState, pov: Owner, rngTick: number): number;
// = Σ駒aiValue(盤+持ち駒×0.9) ± ロイヤル被攻撃ペナルティ(-400) + 前進位置点(rowベース小) + (rngTick%11)
// search.ts
export function findBestMove(state: GameState, pov: Owner, depth: number, timeMs: number): Move;
// negamax+αβ、反復深化(1..depth、時間切れで直前深度の結果)、手順: 捕獲手優先ソート
// worker.ts: onmessage({state,depth,timeMs}) → postMessage({move})
```

勝敗済みノードは±(1000000-ply)。ロイヤル即取り手は探索で自然に最善化される。

- [ ] Step 1: テスト: 1手で敵王(壁なし)を取れる局面で必ず取る/深度2で1手後に王を取られる手を指さない/depth3・初期局面が2秒以内に返る(性能スモーク)/同一シードで決定的
- [ ] Step 2: 実装しPASS、コミット `feat: minimax AI + web worker`

### Task 12: storage

**Files:** Create: `src/storage.ts`, Test: `tests/storage.test.ts`

```ts
export function saveRun(r:RunState|null):void; export function loadRun():RunState|null;
export function recordCodex(defIds:string[]):void; export function loadCodex():string[];
export function recordResult(mode:string, stage:number, cleared:boolean):void; export function loadStats():Stats;
```
キーは§4.4の3つ+`{version:1}`。Storage実体はDI(引数でStorage風オブジェクト、デフォルトlocalStorage)にしテストはメモリ実装。versionが不一致なら破棄。

- [ ] Step 1: テスト(メモリStorage): 保存→復元一致、壊れたJSONでnull、codexのユニーク蓄積
- [ ] Step 2: 実装しPASS、コミット `feat: localStorage persistence`

### Task 13: UIシェル+タイトル/図鑑

**Files:** Create: `src/ui/app.ts`(画面ルータ), `src/ui/title.ts`, `src/ui/codex.ts`, `src/style.css`, Modify: `index.html`, `src/main.ts`

- ルータ: `show(screen)`でmain要素を差し替え。タイトル: 「新規ラン(通常)」「新規ラン(初心者)」「続きから(セーブ時のみ)」「図鑑」。
- 図鑑: レアリティ別グリッド、未遭遇はシルエット(`?`)、クリックで詳細(9x9ミニ動き図=movesパターンから自動描画+能力説明文はdefに`desc`フィールドを追加して表示)。
- 駒ビジュアル: CSS `clip-path`の五角形+漢字、敵は`rotate(180deg)`、レアリティ縁色(木/銀/金/紫)、成り駒は赤字。
- [ ] Step 1: 実装、`npm run dev`で目視確認(タイトル→図鑑往復)
- [ ] Step 2: コミット `feat: UI shell + title + codex`

### Task 14: 対局画面

**Files:** Create: `src/ui/battle.ts`, `src/ui/board-view.ts`

- 盤9x9グリッド+両駒台。自駒クリック→`pieceMoves`でハイライト→移動先クリック。成り選択ダイアログ(強制成りは自動)。
- 選択肢UI: 成り/獅子二段目(停止ボタン付き)/刺客chain(スキップ可)/磁将pull(候補ハイライト+スキップ)/魔女petrify(同)/アクティブ能力は駒選択時に「能力」ボタン→対象選択。バリアント手集合から絞り込む方式(movegenの手をfrom/to/フィールドでフィルタ)。
- 王手警告(自ロイヤルが`isAttacked`)、敵思考中スピナー、eventsから取り/爆発などの簡易フラッシュ演出、投了ボタン。
- AI呼び出し: workerへ現在state+stage設定を送り、結果のMoveを`applyMove`。**1手ごとに`saveRun`**(§4.4)。勝敗確定で`onBattleEnd`→報酬/リザルトへ。
- [ ] Step 1: 実装、devサーバで1面を最後まで手動プレイし、通常将棋の一局が成立することを確認
- [ ] Step 2: コミット `feat: battle screen`

### Task 15: 編成/報酬/リザルト+ラン全体配線

**Files:** Create: `src/ui/formation.ts`, `src/ui/reward.ts`, `src/ui/result.ts`, Modify: `src/ui/app.ts`

- 編成: 自陣3段グリッド+控えリスト。特殊駒クリック→配置可能マス(玉以外の初期マス)クリックで配置/配置済みクリックで解除。駒ホバーで動き図。出陣ボタン→startBattle。
- 報酬: カード3枚(名前/漢字/動き図/能力/レアリティ枠色)+スキップ。選択→takeReward→編成へ。codex記録は対局開始時(敵編成)と獲得時。
- リザルト: 勝利(全クリア)/敗北で到達面・獲得駒表示→タイトルへ(runはクリア)。
- [ ] Step 1: 実装、devサーバでラン一周(1面クリア→報酬→2面、投了→ゲームオーバー、初心者モード開始でレア以上所持)を手動確認
- [ ] Step 2: コミット `feat: formation/reward/result + run loop`

### Task 16: 総合検証

**Files:** Create: `tests/selfplay.test.ts`

- [ ] Step 1: セルフプレイテスト: 面1〜15の各編成でAI(深度1) vs ランダム手を各50手上限で走らせ、例外が出ない・状態不変条件(盤上駒数≤40+α、petrifiedに存在しないid無し、winner後に手が指せない)を検証
- [ ] Step 2: `npm test`全緑+`npm run build`成功を確認
- [ ] Step 3: コミット `test: full-run selfplay smoke`、ユーザーへプレイ手順(`npm run dev`)を案内

## Self-Review結果

- スペック§3〜§7の全項目にタスク対応あり(§7.1-7.11はTask5-9のテストで網羅)。初心者モード=Task10、王手警告=Task14、図鑑シルエット=Task13。
- 型名整合: `Move`のバリアントフィールド(second/chain/pull/petrify)はTask7-8とTask14のUI絞り込みで同名を使用。`effectiveDef`の金成り合成(動き=金/フック保持)はTask5で定義しTask6以降が前提とする。
- 音・スマホ最適化はスコープ外(§11)のためタスクなし。
