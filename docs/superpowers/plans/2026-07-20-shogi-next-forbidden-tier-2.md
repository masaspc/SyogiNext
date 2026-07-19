# 将棋NEXT 拡張プラン: 禁忌レア第2弾(7種追加=計14種)+生成駒の「顕現」修正

> **実装者(Codex)へ:** 承認済み設計。タスク単位で `npm test` 緑+コミット。データ駆動構造(PieceDefタグ+フック)維持、エンジン本体に駒名分岐を書かないこと。禁忌レア第1弾(墓地/呪い/removeFromBoard/自動行動)の機構を前提とする。超越レアプラン(2026-07-19-shogi-next-transcendent-tier.md)とは独立に実装可能(ステージ編成の追加枠のみ§ステージ参照)。

## Context

ユーザーのプレイ感想と要望:
1. **稲荷が「相手に駒を生成する雑魚」**: エンジン上は自分側に生成されているが、生成物(銀金角飛馬)が通常駒のため**敵に取られると敵の持ち駒になり、実質敵に駒を供給してしまう**。地母神・鍛冶神・残影・冥府の門の蘇生にも共通する構造欠陥。→「顕現駒」ルールで修正する。
2. **禁忌レアの拡充**: 最高レアリティ帯にふさわしくさらに強力でよいので数を増やし、**戦略の幅**を持たせる。特に**「指定した敵駒の周辺を一気に破壊する」**能力が欲しい。→7種追加(計14種)。各駒が異なる戦略軸を持つ。

## 修正: 顕現駒(conjured)ルール

- `Piece`に`conjured?: boolean`を追加。**エンジンが盤上に生成した駒**(自動生成spawn/replicate、残影のleaveBehind、冥府の門の蘇生、今回の産土神の自動配置)は全て`conjured: true`で生成する。編成配置・打ち・寝返り(既存駒の所有権変更)は対象外。
- **顕現駒が捕獲されたとき、相手の持ち駒にならず消滅する**(墓地には入る)。resolveCaptureの通常駒分岐(apply.ts:120-123)の前に`target.conjured`判定を挿入。
- 顕現駒のその他の挙動(移動・成り・王手・傀儡師/禍津神の寝返り対象になる等)は通常どおり。寝返った顕現駒はconjuredのまま(取られたら消滅)。
- これにより稲荷・地母神・鍛冶神・残影・冥府の門は「敵に駒を渡すリスクゼロの純粋な戦力供給」になる。descに「顕現」の一言を追記(例: 稲荷「…生成する(顕現駒は敵に奪われない)」)。

## 新駒ラインナップ(7種) — rarity: 'forbidden' / 各駒の戦略軸つき

| id | 駒 | 軸 | 動き | 能力 | aiValue |
|---|---|---|---|---|---|
| tenbatsu | 天罰(てんばつ) | **指定地点爆撃** | 縦横2まで | 【神罰×2】盤上の**任意の敵非ロイヤル駒**を指定し、**その駒と周囲8マス(3×3)の駒を全消滅**(敵味方無差別・ロイヤル除く。距離無制限)。味方を巻き込まない着弾点選びが腕の見せ所 | 3000 |
| fudomyoo | 不動明王(ふどうみょうおう) | **鉄壁** | 縦横1 | **隣接する味方非ロイヤル駒は、捕獲もあらゆる能力(消滅・押し出し・引き寄せ・石化・入れ替え・捕食・寝返り)も受け付けない**(完全防護。自身は守られない) | 2900 |
| shuten | 酒呑童子(しゅてんどうじ) | **収奪** | 斜めスライダー+横1 | 敵の**特殊駒**を捕獲したとき、その駒を**ラン報酬として強奪**(この対局に勝利すると控え(roster)に加わる。敵AI側が使っても効果なし) | 2500 |
| shura | 修羅(しゅら) | **連撃** | 8方向2まで | 敵駒を取るたび**続けてもう1回動ける(1手番に追加2回まで)**。供物などのコストなし | 3100 |
| ubusuna | 産土神(うぶすなが み) | **展開** | 縦横1 | 自動(毎手番終了時): **持ち駒からランダム1枚を自陣のランダム空きマスへ0コストで自動配置**(二歩・行き所・月読の封印は遵守。配置駒は顕現駒ではなく通常の打ちと同格=取られれば敵の持ち駒になる) | 2600 |
| jorogumo | 絡新婦(じょろうぐも) | **強制引き寄せ** | 斜め2まで | 自動(毎手番終了時): 縦横斜8方向の直線上にいる**最寄りの敵非ロイヤル駒1体(候補からrng)を自分の隣まで一気に引きずり寄せる**(経路は最寄りなので常に空いている)。八岐大蛇・天罰・魔王の隣へ獲物を運ぶコンボ軸 | 2700 |
| tokoyo | 常世神(とこよのかみ) | **無限機関** | 8方向1 | 盤上にいる間、**自軍の全アクティブ能力の使用回数が減らない**(雷神の落雷・閻魔の断罪・天罰の神罰なども撃ち放題)。常世神を失うと通常の残回数管理に戻る | 2800 |

全て成りなし・取られたら消滅(既存特殊駒ルール)。禁忌レアは計14種になる。

## 裁定(スペック§7に追記)

1. **神罰(tenbatsu)**: activeの新kind `smite`(uses 2)。target=任意の敵非ロイヤル駒のマス(全域から列挙)。着弾点とその周囲8の駒(敵味方無差別・ロイヤル除く・後述のward保護は有効)を`removeFromBoard(墓地行き)`。捕獲ではない(道連れ・妖狐・不死鳥・誘爆は発動しない=§7.4準拠。ただし**爆弾兵は誘爆する**…は既存爆発ルールと混同しないよう**誘爆しない**で統一)。
2. **完全防護(ward)**: PieceDefに`aura: 'ward'`を追加(guardian/overlordと排他の第3種)。共通ヘルパ`isWarded(state, sq): boolean`(=そのマスの駒が非ロイヤルで、隣接に同陣営のward駒がいる)を新設し、以下**全て**の対象選定で除外する: 捕獲(captureAllowed。既存auraスキャンがwardも拾う形でよい)、爆発、落雷、十拳剣、断罪、神罰、終焉、狙撃、捕食、石化、寝返り(傀儡師・禍津神)、引き寄せ(磁将・絡新婦)、押し出し(突風・波動球)、入れ替え(天邪鬼)、下剋上の全滅。ward駒自身は保護されない。ロイヤルは元々各能力の対象外。
3. **強奪(shuten)**: GameStateに`stolen: string[]`を追加。酒呑童子(PieceDefタグ`stealOnCapture: true`)が**rarityを持つ特殊駒**を捕獲したとき、その基礎defIdを`stolen`へpush(盤上からは通常どおり消滅・墓地行き。event `'steal'`)。プレイヤー側が勝利したとき`onBattleEnd`で`stolen`を`roster`に追加(リザルト画面に「強奪した駒」を表示)。敵側のstolenは破棄。成り駒を奪った場合は基礎defId(例: 成り猛豹→leopard)。
4. **連撃(shura)**: `chainOnCapture`を`boolean | number`に拡張(true≡1)。修羅は`chainOnCapture: 2`。movegenは捕獲後の追撃を最大N段まで再帰生成(各段とも捕獲時のみ次段を生成)。Move型に`chain2?: number | null`を追加し、apply側も同順で解決(2段目追撃の前に1段目の生存確認、道連れ・爆発で死んだら以降不発)。刺客(1段)の既存挙動は不変。
5. **自動配置(ubusuna)**: autoの新kind `autodrop`(every: 1)。持ち駒(DROPPABLE順ではなく**全持ち駒から均等rng**)を1枚選び、自陣の合法な打ち先(二歩・行き所チェックあり、月読の`banEnemyDrops`が有効なら不発)から1マスrngで選んで配置。**通常の打ちと同格**なのでconjuredにしない。持ち駒ゼロ・合法先ゼロは不発(カウントは進む)。
6. **引きずり寄せ(jorogumo)**: autoの新kind `drag`(every: 1)。8方向それぞれの直線上で最初に見つかる駒が「敵非ロイヤル・非ward・距離2以上」なら候補。候補からrngで1体選び、絡新婦の隣(その方向の距離1マス)へ移動させる(そのマスは定義上空いている)。捕獲・成り判定なし。event `'pull'`流用。
7. **無限機関(tokoyo)**: PieceDefタグ`infiniteUses: true`。(a)movegenのgenActive: 自軍にinfiniteUses駒が盤上にいれば`usesLeft`を無視して生成(uses切れでも可)。(b)apply.resolveActive: 同条件で`usesLeft`を減らさない。常世神が盤を離れれば通常管理に戻る(残回数は元の値のまま)。敵AI側にも同ルールが適用される(対称)。
8. **顕現駒**: 上記「修正」セクションのとおり。§3.2の持ち駒ルールに「顕現駒は持ち駒にならない」を追記。
9. **セーブ互換**: `stolen`/`conjured`欠落セーブはロード時に`[]`/未定義のまま安全に動作(オプショナル+onBattleEndでの`?? []`)。

## エンジン変更(ファイル別)

### src/core/types.ts
```ts
// Piece: conjured?: boolean;
// GameState: stolen: string[];   // newGame/bare/ロード補完で [] 初期化
// PieceDef: aura?: 'guardian' | 'overlord' | 'ward';
//           stealOnCapture?: boolean; infiniteUses?: boolean;
//           chainOnCapture?: boolean | number;
// auto union に { kind: 'autodrop'; every: number } | { kind: 'drag'; every: number } を追加
// active.kind / Move ability union に 'smite' を追加
// Move(kind:'move')に chain2?: number | null を追加
// GameEvent に 'steal' | 'smite' を追加
```

### src/core/movegen.ts
- `captureAllowed`: 既存のauraスキャンは`effectiveDef(g).aura`の有無だけ見ているためwardも自動で捕獲保護になる(変更不要なことをテストで担保)。
- `isWarded(state, sq)`ヘルパをexport(裁定2)。
- `genActive`に`smite`: 盤上の全敵非ロイヤル・非wardの駒マスをtargetに列挙。
- `genActive`/usesLeft判定: 自軍に`infiniteUses`駒がいれば`usesLeft`を無視(裁定7a)。判定ヘルパ`hasInfiniteUses(state, owner)`。
- `pushMoveVariants`: `chainOnCapture`の段数対応(裁定4)。1段目chainが捕獲だった場合のみ、その後の盤で2段目候補を`chain2`として列挙。

### src/core/apply.ts
- `resolveCapture`: (a)冒頭近くで`target.conjured`なら持ち駒化せず墓地行き消滅(裁定8)。(b)attackerが`stealOnCapture`かつtargetがrarity持ちなら`s.stolen.push(基礎defId)`+event `'steal'`(消滅処理はそのまま)。
- 生成系(`createPiece`呼び出しのうちspawn/replicate/leaveBehind/gate)に`conjured: true`を付与(createPieceに引数追加)。
- `resolveActive`に`smite`(裁定1、ward除外)。`resolveActive`のusesLeft減算を`hasInfiniteUses`で抑止(裁定7b)。
- `resolveBoardMove`: `chain2`の解決(裁定4)。
- `resolveAutomaticActions`に`autodrop`(裁定5)と`drag`(裁定6)を追加。既存の各効果(explode/落雷/十拳剣/断罪/終焉/狙撃/devour/corrupt/petrify/pull/突風/波動球/swapChaos/doomsday)の対象選定に`isWarded`除外を挿入(裁定2。漏れ防止のため対象列挙箇所を一覧コメントで列挙しながら実装すること)。
- `newGame`(board.ts)と既存ロード補完に`stolen: []`。

### src/core/run.ts
- `onBattleEnd`: プレイヤー勝利時に`run.game.stolen ?? []`を`roster`へ連結。リザルト用に`RunState`へ`lastStolen?: string[]`を持たせる(リザルト表示後にクリア)。
- 報酬確率表: 変更なし(禁忌の%は現行のまま、プールが7→14種に増えるだけ)。

### src/core/stages.ts
- 13面に`tenbatsu`と`jorogumo`を追加(現在high枠4使用→6でちょうど埋まる)。敵の天罰は敵味方無差別なので自爆リスクごと楽しい脅威になる。

### src/core/defs/special.ts
- `FORBIDDEN`配列に7種を追加。descは上表の能力+代償/制約を日本語で明記。稲荷ほか生成系のdescに「顕現駒は敵に奪われない」を追記。

### UI
- battle.ts/move-visuals.ts: `steal:'強奪', smite:'神罰'`をイベント名に追加。ability名`smite:'神罰'`。
- リザルト画面(result.ts): 勝利時に`lastStolen`があれば「強奪した駒」一覧を表示。
- カットイン(超越レアプランのcutin.tsが先に入っている場合): `smite→「神罰!!」`を追加。未実装ならスキップ可(超越プラン側で統合)。
- 図鑑・報酬カードはrarity既存機構で自動対応。

### スペック更新
`docs/superpowers/specs/2026-07-19-shogi-next-design.md`: §3.2に顕現駒ルール、§6.6の表に7種追記(計14種)、§7に裁定1〜9追記、§5の13面反映、駒総数を65種(超越レア実装済みなら73種)に更新。

## テスト計画(tests/pieces-forbidden2.test.ts ほか)

1. **顕現駒**: 稲荷生成の飛を敵が取っても敵の持ち駒が増えない(墓地には入る)/地母神の歩・残影の歩・冥府の門の蘇生駒も同様/産土神の自動配置駒は通常どおり敵の持ち駒になる/打った駒・初期配置駒は従来どおり。
2. **天罰**: 指定した敵駒+周囲の敵味方が消滅・ロイヤル生存/距離無制限/ward保護された駒は残る/uses 2で尽きる/常世神がいれば3回目も撃てる。
3. **不動明王**: 隣接味方が捕獲されない・石化されない・捕食されない・天罰でも消えない/不動明王自身は取られる/離れると保護が切れる。
4. **酒呑童子**: 敵特殊駒を取るとstolenに基礎defIdが記録され、勝利後rosterに追加/通常駒では記録なし/敵側が使っても何も起きない。
5. **修羅**: 2連続捕獲(chain)+3枚目(chain2)まで生成・適用/1段目で道連れを取ったら以降不発/刺客は従来どおり1段のみ。
6. **産土神**: 持ち駒がランダムに自陣へ湧く/二歩になる配置はされない/月読がいると不発/持ち駒ゼロで不発。
7. **絡新婦**: 直線上の最寄り敵が隣まで引きずられる/ward・ロイヤルは対象外/距離1(既に隣)は対象外。
8. **常世神**: usesLeft 0の雷神が撃てる/resolveActiveで回数が減らない/常世神が取られると撃てなくなる(残回数は元のまま)。
9. **セーブ互換**: stolen/conjured欠落セーブのロード。
10. 既存全テスト緑+`npm run build`+selfplayが13面(天罰・絡新婦入り)で例外なし。

## 検証手順

1. `npm test` 全緑 → `npm run build` 成功。
2. `npm run dev`: 稲荷の生成駒を敵に取らせて持ち駒に入らないこと/天罰で敵陣の密集地を指定して3×3が吹き飛ぶ体験/不動明王の要塞/酒呑童子で敵の特殊駒を強奪→リザルト表示→次面で使えること/常世神+雷神の無限落雷、を確認。
3. コミット分割: conjured修正 → engine(ward/smite/steal/chain2/autodrop/drag/infiniteUses) → 駒defs → run/stages → UI → spec/tests。`Co-Authored-By`既定を踏襲。
