# 将棋NEXT 改善プラン: 盤面タップ完結UI(段階式ムーブセレクタ)

> **実装者(Codex)へ:** 承認済み設計。**エンジン(src/core, src/ai)は一切変更しない**UI専用プラン。タスク単位で `npm test` 緑+コミット。

## Context

ユーザーのプレイ感想: 成り・能力発動・二段行動(獅子/刺客など)の選択が「移動後にサイドパネルのテキストボタン一覧から選ぶ」方式で、初見の人に分かりづらい。**盤面をタップ(クリック)するだけで全ての手が完結するシンプルなUI**にしたい。

現状の問題(src/ui/battle.ts):
- 移動先タップ後、バリアントが複数あると`variants`テキストボタン一覧(「成る / 2回目: 5筋3段 / 引き寄せない…」)が側面に出る — 座標文字列を読ませる時点で難しい
- アクティブ能力が「能力を使う」ボタンの奥に隠れている
- 獅子の二段目・刺客の追撃・磁将/魔女の効果対象が全て同じ文字リストに合流している

方針: movegenは既に全バリアントを`Move[]`として列挙しているので、**「タップのたびに候補手集合を絞り込む純粋な状態機械」**をUI層に新設し、各段階を盤上ハイライト+マス直上のフローティングボタンで表現する。エンジン変更ゼロ。

## UX仕様(新しい入力フロー)

### 基本の1手(従来どおり+改善)
1. 自駒タップ → 移動先が**琥珀色**でハイライト。捕獲マスは赤縁。
2. 移動先タップ → 確定(バリアントがなければ即適用)。

### 成り(将棋アプリ標準方式)
- 移動先タップ後に成り選択がある場合、**移動先マスの直上に「成」「不成」の2つの大きなフローティングボタン**を重ねて表示(盤は薄暗く)。タップで確定。サイドパネルには出さない。
- 強制成りは従来どおり自動(選択なし)。

### アクティブ能力(ボタン廃止 → 盤上直示)
- 自駒タップ時、移動先(琥珀)と同時に**能力の対象マスを紫色で直接ハイライト**する。「能力を使う」ボタンは廃止。
- 紫マスをタップ → 能力発動。何の能力かは選択中メッセージ欄と駒情報パネルに表示。
- **自己対象の能力**(刻停・十拳剣・天地返しなど target===from のもの)は、選択した駒の隣に**技名チップ**(「刻停」等)をフローティング表示し、タップで発動。
- **列/段対象**(落雷・突風): 有効な列/段の**全マスを紫でウォッシュ表示**し、その列/段のどのマスをタップしても発動(タップ座標→列/段→該当手にマッピング)。
- **危険なAoE**(神罰=敵味方無差別、終焉): 1タップ目で**爆心の効果範囲(3×3等)をプレビュー表示**し、同じマスをもう1度タップで確定。他をタップでキャンセル(誤爆防止の2タップ確認)。
- 移動先と能力対象が**同一マスで衝突**する場合(例: 閻魔の隣接敵=移動捕獲先かつ断罪対象): そのマスをタップすると**マス直上に小さな2択チップ**(「移動」/「断罪」)を出して選ばせる。

### 多段行動(獅子・刺客・修羅・軍師)
- 獅子: 一段目タップ → 駒が**仮移動表示**(元マスにゴースト、移動先に実体+進行中マーク) → 二段目候補を**水色**ハイライト+駒の隣に「止まる」チップ。二段目マス(元マスに戻る居食い含む)か「止まる」をタップで確定。
- 刺客/修羅の追撃: 捕獲後、追撃候補を水色ハイライト+「追撃しない」チップ。修羅は3段目(chain2)も同じUIを繰り返す。
- 軍師の連携(実装済みなら): 移動確定後、動かせる隣接味方を水色ハイライト → 味方タップ → その1歩先をハイライト → タップ。「連携しない」チップあり。
- 磁将の引き寄せ/魔女の石化: 移動タップ後、対象候補を**緑色**ハイライト+「使わない」チップ。対象タップで確定。
- **どの段階でも**: ハイライト外のマスをタップ、またはEsc/右クリックで選択全体をキャンセルして最初に戻る。

### その他
- 打ち: 駒台タップ→打てるマスハイライト(従来どおり)。
- 進行中の段階は既存メッセージ欄に日本語で明示(「成りますか?」「二段目の移動先を選ぶ(止まるも可)」「引き寄せる駒を選ぶ(スキップ可)」)。
- タップターゲットはモバイル配慮で最小44px。フローティングボタンは盤外にはみ出さないよう位置クランプ。
- 旧`variants`テキスト一覧UIと`variantLabel`は削除(履歴表示`move-visuals`は残す)。

## 実装設計

### 新規: src/ui/move-selector.ts(純粋ロジック・DOMなし・テスト対象)

候補手集合を段階的に絞り込む状態機械。バリアントのフィールド決定順は固定:
`to → promote → second → chain → chain2 → pull → petrify → escort`(存在するフィールドのみ)。

```ts
export type StageKind =
  | 'destination'   // options: { sq, isCapture, isActive, abilityLabel? }[]  移動先+能力対象の合成
  | 'promote'       // options: [true, false]
  | 'second' | 'chain' | 'chain2' | 'escortPiece' | 'escortTo'  // options: sq[] + skippable
  | 'pull' | 'petrify'                                          // options: sq[] + skippable
  | 'activeConfirm' // 危険AoEの2タップ目待ち { target, affected: sq[] }
  | 'done';         // result: Move

export interface Selector {
  stage(): { kind: StageKind; moveOptions: number[]; activeOptions: { target: number; label: string; selfTarget: boolean; lineWash?: number[]; danger?: boolean }[]; skippable: boolean; tentative?: { from: number; at: number } };
  tap(sq: number): TapResult;      // マスタップを解釈して遷移
  skip(): TapResult;               // 「止まる/使わない」チップ
  choosePromote(promote: boolean): TapResult;
  chooseAmbiguous(kind: 'move' | 'active'): TapResult; // 衝突2択チップ
  cancel(): void;                  // 全リセット
}
export function createSelector(moves: Move[], defOf: (sq: number) => PieceDef | null): Selector;
export type TapResult = { type: 'stage' } | { type: 'commit'; move: Move } | { type: 'ambiguous'; sq: number } | { type: 'invalid' };
```

要点:
- 内部状態は「残候補`Move[]`+決定済みフィールド」。タップごとに該当フィールドで絞り込み、**未決定フィールドが残っていなければcommit**。
- `second`のnull(停止)/`chain`のnull(追撃なし)/`pull`・`petrify`のnull(不使用)は`skip()`に対応。
- 能力手(`kind:'active'`)は`to`絞り込みと並列に管理: destinationステージで`target`一致の能力手があれば`activeOptions`に出す。移動先と重なれば`ambiguous`を返す。
- 列/段対象(bolt/gale)の`lineWash`: 代表targetの列/段の全マスを返し、タップ解釈は「その列/段内なら該当手」。
- `danger`(smite等)は1タップ目で`activeConfirm`ステージに遷移し、同一マス再タップでcommit。危険能力の判定はability名の集合(`smite`,`apocalypse`)で持つ。
- 依存は`Move`型のみ(coreの型import)。DOM・GameState非依存で全分岐をユニットテスト可能にする。

### 変更: src/ui/battle.ts
- `selectedSq`/`activeMode`/`variants`の手続き的状態を廃止し、`Selector`1個+`selectedDrop`に置き換え。
- タップハンドラ: `selector.tap(sq)`の結果で描画更新 or `apply(move)`。
- 描画: `selector.stage()`から各色ハイライト集合(琥珀=destination、紫=activeOptions、水色=second/chain系、緑=pull/petrify、赤縁=捕獲)と、フローティングUI(成/不成、技名チップ、止まる/使わない/追撃しないチップ、2択チップ、AoEプレビュー)を組み立てる。
- 仮移動表示: `tentative`があれば元マスに半透明ゴースト+移動先に実体+黄色進行枠。
- Esc/右クリック/盤外相当のタップで`selector.cancel()`。
- メッセージ欄はステージ種別ごとの定型文に更新。

### 変更: src/ui/board-view.ts
- ハイライト種別の拡張(`destinations`/`targets`に加え`secondary`(水色)/`effect`(緑)/`wash`(紫ウォッシュ)/`blast`(AoEプレビュー赤)/`ghost`/`tentative`)。
- マスにアンカーした**フローティングチップ描画API**を追加: `renderChips(sq, chips: { label, style: 'promote'|'skip'|'ability'|'choice', onTap }[])`。位置は盤内クランプ、最小44px。

### 変更: src/style.css
- 各ハイライト色(琥珀/紫/水色/緑/赤縁/紫ウォッシュ/爆心赤)、ゴースト(opacity .35)、フローティングチップ(影+ポップイン120ms)、成/不成の大ボタン、盤ディム。ダーク・ライト両テーマで視認できる値にする。

### 削除
- battle.tsの`variants`一覧UI・`variantLabel`関数・「能力を使う」ボタン。

## テスト計画(tests/move-selector.test.ts — DOM不要の純ロジック)

movegen実物を使い、代表局面から`pieceMoves`の出力を渡して検証:
1. 歩の敵陣移動: destination→promoteステージ→choosePromote(true)でcommit。強制成りはpromoteステージが出ずcommit。
2. 獅子: 一段目タップ→secondステージ(候補に元マス=居食いを含む)→タップcommit/skip()で停止commit。
3. 刺客: 捕獲先タップ→chainステージ(skippable)。非捕獲移動は即commit。修羅想定(chain2あり)は2段続く。
4. 磁将/魔女: 移動タップ→pull/petrifyステージ(skippable)、対象タップで該当バリアントcommit。
5. 狙撃手: destinationステージのactiveOptionsに狙撃対象が入る。対象タップで能力手commit。
6. 自己対象能力(刻停): selfTarget=trueのチップとして返る。tap(from)ではなくchip経由(=tap(target)がfromと同値)でcommit。
7. 落雷: lineWashに列全マスが入り、列内の任意マスtapでcommit。
8. 危険AoE(神罰): 1タップ目でactiveConfirm+affected(3×3)、同一マス再タップでcommit、別マスタップでキャンセル遷移。
9. 移動先と能力対象の衝突: tapが`ambiguous`を返し、chooseAmbiguousで各々commit。
10. cancel(): どのステージからも初期状態へ。
11. 既存全テスト緑(エンジン無変更の担保)。

## 検証手順

1. `npm test` 全緑 → `npm run build` 成功。
2. `npm run dev`で実機タップ確認(マウス+可能ならスマホ幅):
   - 歩を敵陣へ→マス上に「成/不成」が出てタップで決まる(サイドパネルに選択肢が出ない)
   - 獅子の2段移動と居食いがタップだけで完結・「止まる」チップが機能
   - 狙撃手/閻魔: 駒を選んだ瞬間に対象が紫で光り、ボタン経由なしで撃てる
   - 雷神: 列全体が光り、列のどこをタップしても落雷
   - 神罰: 1タップ目で3×3プレビュー→2タップ目で発動(1タップ誤爆しない)
   - 磁将/魔女のスキップチップ、Escでのキャンセル
3. コミット分割: move-selector+テスト → board-view拡張 → battle.ts置き換え+CSS → 検証修正。`Co-Authored-By`既定を踏襲。
