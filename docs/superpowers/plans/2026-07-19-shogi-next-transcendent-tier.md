# 将棋NEXT 拡張プラン: 超越レア(transcendent)8種+必殺技カットイン演出

> **実装者(Codex)へ:** 承認済み設計。タスク単位で `npm test` 緑+コミット。データ駆動構造(PieceDefタグ+フック)を維持し、エンジン本体に駒名分岐を書かないこと。禁忌レア拡張(f6faa04〜6c9e276)で入った墓地/呪い/removeFromBoard等の機構を前提とする。

## Context

禁忌レアまで実装済み(58種)。次の要望は「もっと**将棋のルールそのものを壊す**駒」「テニヌのような超エキサイティングな体験」。対応:

1. 最上位ティア**「超越レア(transcendent)」**を新設。8駒それぞれが**将棋の大前提を1つずつ破壊**する(盤の形/勝利条件/駒の固定性/押し出し禁止/手番制/1手1駒/盤の不動/情報の非対称)。禁忌レアとの差別化: 禁忌=力と代償、超越=**ルール破壊**(代償なし、その分最高レア)。
2. **必殺技カットイン演出**: 大技の発動時に画面に技名が大きく走る(テニヌの必殺技コール)。CSSのみで実装し、ゲーム速度を損なわない。

## 新駒ラインナップ(8種) — rarity: 'transcendent' / 表示名「超越レア」

| id | 駒 | 壊すルール | 動き | 能力 | aiValue |
|---|---|---|---|---|---|
| rinne | 輪廻(りんね) | **盤は9x9で終わり** | 縦横スライダー(**盤端を越えて反対側へループ**) | 動き自体が能力。上下・左右がドーナツ状に繋がる唯一の駒 | 2800 |
| tenkabito | 天下人(てんかびと) | **勝利=王を取ること** | 8方向1 | **5五(盤中央)で自分の手番終了を3回迎えたら、その時点で勝利**(新勝利条件)。中央を巡る大乱戦を作る | 2400 |
| utsushimi | 写し身(うつしみ) | **駒の動きは不変** | 8方向1(初期) | 敵駒を捕獲するたび、**その駒の動きを永続習得して合体**(喰うほど神に近づく) | 2200 |
| hadou | 波動(はどう) | **駒は押し出せない** | 縦横2まで | 【波動球×2】8方向いずれかを選び、**その直線上の敵駒(非ロイヤル)を全て盤端まで吹き飛ばす**(玉突きで詰める) | 2600 |
| gonosen | 後の先(ごのせん) | **相手の手番には何もできない** | 8方向1 | **敵の手番終了時、自分の利きに止まっている敵駒のうち最高価値の1体を自動で取る**(オートカウンター。通常捕獲扱い=持ち駒も得る) | 3000 |
| gunshi | 軍師(ぐんし) | **1手に動かせる駒は1枚** | 縦横斜2まで | 移動後、**移動先に隣接する味方1体を続けて1マス動かせる**(2駒連携。捕獲も可) | 2600 |
| tenchigaeshi | 天地返し(てんちがえし) | **盤面は動かない** | 8方向1 | 【天地返し×1】**盤全体を180度回転**(全駒が点対称位置へ移動。所有権・成りはそのまま)。彼我の陣形が丸ごと入れ替わる | 2000 |
| miraishi | 未来視(みらいし) | **相手の考えは見えない** | 斜めスライダー | 盤上にいる間、**敵がいま狙っている最善手を盤上に矢印表示**(UI能力。エンジンには影響しない) | 1800 |

全て成りなし・代償なし・取られたら消滅(既存特殊駒ルール)。

## 裁定(スペック§7に追記)

1. **輪廻のループ移動**: slideパターンに`wrap: true`を新設。1歩ごとに盤外に出たら反対側の端(row/colをmod 9)へ継続。**最大8歩で打ち切り**(一周して自分に戻るのを防ぐ)。途中の駒の遮蔽は通常どおり(味方=手前まで、敵=そこで捕獲停止)。行き所のない駒判定(hasAnyDest)は常にtrue扱い。
2. **天下人の玉座**: Pieceに`throneCount?: number`を追加。**持ち主の手番終了時**(自動行動フェーズの後)に天下人が5五(`sqOf(4,4)`=index 40)にいれば+1、いなければ0にリセット。3に達した瞬間`winner=owner`(event `'throne'`)。両軍対称に実装(敵が使う場合も同じ)。石化・麻痺中でもカウントは進む(座っているだけでよい)。
3. **写し身の習得**: Pieceに`absorbed?: string[]`を追加。写し身が敵駒を捕獲したとき、その駒の**基礎defId**(promoted駒はその成り先の動きではなく基礎defのdefId)をabsorbedへ追加(重複は追加しない)。effectiveDefは「基礎の動き+absorbed全defのmovesを連結」した合成defを返す(**メモ化必須**: キー=`utsushimi:`+absorbedソート済join。検索中に大量呼び出しされるため)。lionパターンを吸収した場合も動作すること(魔王で実装済みのlion+通常パターン混在生成を流用)。能力・フックは習得しない(動きのみ)。
4. **波動球**: activeの新kind `shockwave`(uses 2)。対象=8方向いずれか(`target`=その方向の隣接マスで方向をエンコード。隣接マスが盤外の方向は生成しない)。その方向の直線上(波動自身は含まず盤端まで)の敵非ロイヤル駒を、**遠い順に**、その方向へ「盤端 or 別の駒(押されない駒含む)の手前」まで滑らせる。味方・ロイヤル・押し終わった駒は壁になる。1体も押せない方向の手は生成しない。捕獲ではない(墓地・道連れ等は無関係)。
5. **後の先のカウンター**: PieceDefに`counter?: boolean`。手番側の解決(移動+自動行動)後・石化カウントの前に、**非手番側**のcounter駒を走査(sq昇順)。各counter駒につき1手番1回まで: その駒の`pieceMoves`(石化・麻痺なら不発)の捕獲先にいる手番側の駒のうち、**aiValue最高の1体**へ実際に移動して捕獲する(resolveCaptureをフル適用=通常駒なら持ち駒化、怨念なら道連れ、爆弾兵なら爆発を喰らう)。ロイヤルは対象外(王をカウンターで取って勝つことはできない)。counter駒が複数いれば各1回発動。
6. **軍師の連携**: 移動手に`escort?: { from: number; to: number } | null`バリアントを追加(磁将方式)。対象=軍師の**移動先**に隣接する味方非ロイヤル駒(石化・麻痺中は不可)。その駒の合法手のうち**移動距離1(チェビシェフ距離1)の手**だけをescort候補にする(捕獲可・成りは発生しない)。適用は軍師の移動解決後。escort移動では残影のleaveBehind等の移動時フックは発動しない(軍師の指示による小移動、と裁定)。
7. **天地返し**: activeの新kind `boardFlip`(uses 1、target=自身)。全マスについて`newBoard[i] = oldBoard[80 - i]`。成り状態・カウント類はそのまま。移動ではないので成り判定・leaveBehind・道連れ等は一切発動しない。直後にボス回避判定は通常どおり走る。
8. **未来視**: PieceDefに`foresight?: boolean`。**エンジンには一切影響しない**(合法手・適用・AIとも無関係)。UI(battle.ts)がプレイヤーの手番開始時、盤上に自軍のforesight駒があれば、Workerで`findBestMove(現局面をturn:'enemy'とみなした状態, depth 2, 300ms)`を別途実行し、得られた手を「敵の狙い」として矢印/ハイライト表示する(思考中バッジ付き、結果が来るまで非表示。プレイヤーが指したら破棄)。
9. **新勝利条件とUI**: `'throne'`勝利もリザルトは既存の勝敗フローに乗る。天下人が5五にいる間、盤上にカウント(1/3〜3/3)をバッジ表示する。
10. **セーブ互換**: `throneCount`/`absorbed`欠落は未定義のままで安全(オプショナル)。マイグレーション不要だが、ロード後の動作をテストで担保。

## 必殺技カットイン演出(テニヌ要素)

- `src/ui/cutin.ts`を新設: `showCutin(text: string)` — 画面中央に技名が**大書き(縦書き風・白抜き+レアリティ色の縁)**で約900msスライド&フェードするオーバーレイ(CSS keyframesのみ、連続発動時はキュー処理)。`pointer-events: none`でゲーム操作を妨げない。
- battle.tsのイベント処理でマップして呼ぶ: `bolt→「落雷」, apocalypse→「終焉」, doomsday→「下剋上!!」, ohabari(十拳剣event)→「十拳剣」, timestop→「刻停」, shockwave→「波動球!!」, boardFlip→「天地返し!!」, throne(勝利)→「天下統一!!」, counter発動(新event 'counter')→「後の先」, resurrect→「蘇生」`。
- 敵が使った場合も表示する(食らう側の絶望もテニヌの華)。

## エンジン変更(ファイル別)

### src/core/types.ts
```ts
export type Rarity = ... | 'forbidden' | 'transcendent';
// Piece: throneCount?: number; absorbed?: string[];
// MovePattern slide: wrap?: boolean;
// PieceDef: counter?: boolean; foresight?: boolean; absorbMoves?: boolean(写し身); throne?: boolean(天下人); escortAfterMove?: boolean(軍師);
// active.kind / Move ability union: 'shockwave' | 'boardFlip'
// Move(kind:'move')に escort?: { from: number; to: number } | null
// GameEvent: 'throne' | 'counter' | 'shockwave' | 'flip' | 'absorb' | 'escort'
```

### src/core/movegen.ts
- slideループにwrap対応(裁定1)。step数上限は`min(pat.max ?? 8, 8)`。
- `effectiveDef`利用側は変更不要だが、defs/index.tsの`effectiveDef`に**写し身の合成+メモ化**を追加(裁定3)。
- `pushMoveVariants`に軍師のescortバリアント生成(裁定6。magnetPull分岐と同型: simulateMove後の盤で候補列挙)。
- `genActive`に`shockwave`(裁定4)と`boardFlip`(盤上に駒が2枚以上あれば`target: sq`)を追加。

### src/core/apply.ts
- `resolveActive`: `shockwave`(裁定4)、`boardFlip`(裁定7)。
- `resolveBoardMove`: escort適用(軍師の移動解決後、対象がまだ隣接・生存していれば1歩移動+捕獲解決)。写し身の吸収(捕獲成立時、`moved.absorbed`更新+event `'absorb'`)。
- `applyMove`の手番終了処理に追加(順序厳守): 移動解決 → 自動行動(既存) → **カウンター(非手番側、裁定5)** → **玉座カウント(裁定2)** → 石化カウント → ボス回避 → 手番交代。
- 玉座勝利は`winner`設定+event `'throne'`。

### src/ai/eval.ts
- 天下人: 盤上の自軍天下人に`throneCount × 1200`+5五との距離ボーナス(近いほど+)。敵の天下人カウントには対称のマイナス(AIが全力で玉座を潰しに来る)。
- 写し身: `absorbed.length × 300`を加点。
- 後の先: そのまま(aiValue 3000で十分)。

### src/ai/search.ts
- `moveOrderScore`: `shockwave`/`boardFlip`を高スコア群(800)に追加。

### src/core/run.ts
- `REWARD_WEIGHTS`にtranscendent列を追加(合計100維持):

| 面 | common | uncommon | rare | mythic | celestial | forbidden | transcendent |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1〜3 | 1 | 14 | 45 | 35 | 5 | 0 | 0 |
| 4 | 1 | 9 | 40 | 40 | 10 | 0 | 0 |
| 5(ボス) | 0 | 0 | 27 | 45 | 20 | 5 | **3** |
| 6〜9 | 1 | 7 | 32 | 45 | 15 | 0 | 0 |
| 10(ボス) | 0 | 0 | 16 | 45 | 28 | 7 | **4** |
| 11〜12 | 1 | 4 | 23 | 42 | 24 | 4 | **2** |
| 13〜14 | 0 | 3 | 13 | 41 | 32 | 8 | **3** |

- 列挙(`OBTAINABLE_BY_RARITY`/`drawRarity`)に`transcendent`追加。初心者モードは現行のまま。

### src/core/stages.ts
- 14面に`hadou`を追加(HIGH枠6つ目)。15面の`phoenix`(鳳凰)を`gonosen`(後の先)に置換(最終ボス軍のオートカウンターが最後の壁になる)。

### src/core/defs/special.ts
- `TRANSCENDENTS: PieceDef[]`を新設し8種を定義、`SPECIAL_DEFS`へ連結。descに「壊すルール」を一言添える(例: 輪廻「盤の果てなど無い。端を越えて反対側へ抜けるスライダー」)。

### UI
- labels: `transcendent: '超越レア'`。codexのレアリティ列挙に追加。
- style.css: `.rarity-transcendent { --rarity: ... }` プリズム/白金系(禁忌の血赤より「神々しく」。実装者判断)。
- `src/ui/cutin.ts`+style.cssのカットインkeyframes(上記)。battle.tsから接続。
- battle.ts: 未来視の敵狙い表示(裁定8)、天下人の玉座カウントバッジ(裁定9)、eventText/move-visualsに新イベント名(`throne:'天下統一', counter:'後の先', shockwave:'波動球', flip:'天地返し', absorb:'習得', escort:'連携'`)。

### スペック更新
`docs/superpowers/specs/2026-07-19-shogi-next-design.md`: §2レアリティ7段階に、§4.3表を7列に、§6.6の後に「6.7 超越レア(8種)」(既存ボスは6.8へ)、§7に裁定1〜10追記、§5の14/15面反映、§3.1の勝敗条件に「天下人の玉座勝利」を追記、駒総数を66種に更新。

## テスト計画(tests/pieces-transcendent.test.ts ほか)

1. **輪廻**: 右端から左端へ抜ける/上端から下端へ抜ける/一周して自分の位置には戻らない(手が8歩で打ち切り)/途中の敵駒で捕獲停止。
2. **天下人**: 5五で3手番終了→勝利/2回で離れるとリセット/敵の天下人も対称に勝てる/カウント中に取られたら通常どおり消滅。
3. **写し身**: 桂を取ると桂ジャンプを習得/複数吸収で動きが合算/同じ駒を2回取っても重複しない/取られたら習得ごと消滅。
4. **波動球**: 直線上の敵3体が盤端に詰まる/味方が壁になる/ロイヤルは押されない/uses 2で尽きる。
5. **後の先**: 敵が利きに入る手を指した直後、最高価値の敵駒が自動で取られ持ち駒が増える/石化中は不発/爆弾兵をカウンターすると爆発を食らう/王は取らない。
6. **軍師**: escortバリアントが生成される/隣接味方が1歩動き捕獲もできる/escortで成りは発生しない。
7. **天地返し**: 全駒が点対称位置へ移る/成り状態維持/使用後にボス回避が正常動作。
8. **未来視**: エンジンテストでは「foresightタグが合法手・applyMoveに影響しない」ことのみ確認(UI表示は手動)。
9. **run/storage**: transcendent列の境界(5面ボスで3%)/throneCount・absorbed付きセーブのロード。
10. 既存全テスト緑+`npm run build`+selfplayが14/15面(波動・後の先入り)で例外なし。カウンター発動を含むselfplay 1ケース追加。

## 検証手順

1. `npm test` 全緑 → `npm run build` 成功。
2. `npm run dev`: 図鑑「超越レア」(プリズム枠)/輪廻のループ移動先ハイライトが盤端を跨ぐ/天下人の玉座バッジとカウント勝利/波動球・天地返しのカットイン演出/未来視の「敵の狙い」矢印/敵・後の先のカウンターで駒を持っていかれる体験、を確認。
3. コミット分割: engine(wrap/throne/absorb/counter/escort/flip) → 駒defs → run/stages → UI+カットイン → spec/tests。`Co-Authored-By`既定を踏襲。
