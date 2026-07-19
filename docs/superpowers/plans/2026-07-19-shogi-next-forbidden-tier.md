# 将棋NEXT 拡張プラン: 禁忌レア(forbidden)7種 — 代償つき最強ティア

> **実装者(Codex)へ:** 承認済み設計。タスク単位で `npm test` 緑+コミット。データ駆動構造(PieceDefタグ+フック)を維持し、エンジン本体に駒名分岐を書かないこと。前回の天上レア拡張(d77ae87〜57b8d86)で入った auto行動/pass/paralysisAura 等の機構を前提とする。

## Context

天上レアまで実装済み(51種・118テスト緑)。ユーザーの次の要望は「既存の将棋の枠を壊す、もっと奇抜で強力な駒」。対応として天上レアの上に**「禁忌レア(forbidden)」**を新設する。コンセプトは**全てが諸刃の剣** — ゲームを壊すレベルの力に、明確な代償やリスクが付く。バランスは出現率で取る(既定方針)。

## 新駒ラインナップ(7種) — rarity: 'forbidden'

| id | 駒 | 動き | 能力 | aiValue |
|---|---|---|---|---|
| maou | 魔王 | 全方向スライダー**+獅子の2回行動** | 自動(毎手番): 隣接の敵非ロイヤル駒を1体捕食。**敵がいなければ味方非ロイヤル駒を喰う**(対象なしなら不発) | 3200 |
| gekokujo | 下剋上 | **前1のみ** | この駒が**敵陣最奥段に到達した瞬間、敵の非ロイヤル駒が全て消滅**する | 1800 |
| meifu | 冥府の門 | **なし(動けない置物)** | 自動(毎手番): この対局で**消滅した駒(敵味方問わず)を古い順に1体、自軍として隣接空きマスに蘇生** | 2800 |
| amanojaku | 天邪鬼 | 8方向1 | 自動(毎手番): 盤上のランダムな**敵非ロイヤル駒1体と自軍非ロイヤル駒1体の位置を強制入れ替え**(自身も対象になり得る) | 2000 |
| majin | 契約の魔神 | 縦横スライダー+斜め2まで | 盤上にいる間、**自軍の王が8方向2マス**に強化。魔神が盤上から消えると(取られ・消滅とも)**王は前1しか動けない呪い**が対局終了まで残る | 2600 |
| chinojoou | 血の女王 | 斜めスライダー+横1 | 敵駒を捕獲したとき、**持ち駒の通常駒1枚を自動で捧げて続けてもう1回移動できる**(1手番につき追加1回。持ち駒が空なら不可) | 2400 |
| hoshikui | 星喰い | 8方向2ジャンプ((±2,0),(0,±2),(±2,±2)) | 【終焉×1】**王・太子・ボス以外の盤上全駒(敵味方・自身含む)を消滅**させ、**両者の持ち駒も全て失わせる**。裸の王同士の終盤戦になる | 2200 |

全て成りなし・取られたら消滅(既存特殊駒ルール)。

## 裁定(スペック§7に追記)

1. **墓地(graveyard)**: GameStateに`graveyard: { defId: string; promoted: boolean }[]`を新設。**盤上から「持ち駒にならずに」取り除かれた非ロイヤル駒**(特殊駒の捕獲消滅、爆発・落雷・断罪・捕食・終焉などの消滅)を、除去された順に記録する。通常駒の捕獲(持ち駒化)と妖狐(歩に変化)は墓地に入らない。不死鳥が復活した場合は入らない(復活せず消滅した時のみ入る)。
2. **冥府の門の蘇生**: 墓地の**先頭(最も古い)**エントリを取り出し、門の隣接空きマス(rng pick)に**門の持ち主の駒として**生成(promoted状態は維持、usesLeft/autoCountは初期化)。隣接に空きが無い場合はエントリを消費せず不発。蘇生した駒はまた消滅すれば再び墓地に入る。
3. **魔王の捕食**: 既存auto `devour`の拡張(`allyFallback: true`)。対象選定は敵優先(§7既存の捕食裁定=captureAllowed準拠)、敵候補ゼロのとき味方非ロイヤル(自身は除く)からrng pick。味方を喰った場合も墓地に入る。
4. **下剋上の審判**: 移動解決後(捕獲・成り処理の後)、`doomsday`タグ駒が相手側最奥段(playerならrow0、enemyならrow8)にいたら敵非ロイヤル全消滅(全て墓地へ)。到達後のこの駒は動けなくなるが、それは仕様(役目を終える)。強制成りルールの対象外(成り先を持たないため。§7.8の「該当駒は成り先を持つ」の例外として明記)。
5. **魔神の契約と呪い**: GameStateに`cursedKing: { player: boolean; enemy: boolean }`を新設。王(defId `'king'`のみ。太子は対象外)の合法手生成時、(a)呪いがあれば**前1のみ**、(b)呪い無しで自軍に`kingBoon`タグ駒が盤上にいれば**8方向2まで(slide max2)**、(c)どちらも無ければ通常の8方向1。魔神が盤上から除去された時(理由を問わず)、その持ち主の`cursedKing`をtrueにする。魔神2枚目がいても呪いは1回発動したら永続。
6. **血の女王の供物**: 捕獲を伴う移動に追撃(`chain`)バリアントを生成(既存chainOnCapture機構を流用、新タグ`chainCostsHand: true`)。追撃バリアントは**持ち駒に通常駒が1枚以上ある場合のみ**生成。apply時、追撃の実行前に持ち駒から**最も安い通常駒**(歩→香→桂→銀→金→角→飛の順)を1枚自動で消費する。
7. **星喰いの終焉**: activeの新kind `apocalypse`(target=自身)。王・太子・ボス以外の盤上全駒(**自身含む**)を消滅させ全て墓地へ。両者`hands`を空にする(持ち駒は墓地に入らない)。冥府の門が両軍に…門も非ロイヤルなので**門ごと消滅**する点に注意(墓地には入る)。
8. **天邪鬼の入れ替え**: 位置swapは捕獲ではない(道連れ等は発動しない)。swap後の駒の成り状態・カウントはそのまま。敵陣に飛ばされても成り判定は発生しない(移動ではないため)。
9. **消滅系と墓地の既存能力への影響なし**: 墓地は記録のみで、既存の§7裁定(道連れ・誘爆・復活の発動条件)を変えない。
10. **セーブ互換**: 旧セーブに`graveyard`/`cursedKing`が無い場合はロード時に`[]`/`{player:false,enemy:false}`で補完する(ランを破棄しない)。

## エンジン変更(ファイル別)

### src/core/types.ts
```ts
export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'celestial' | 'forbidden';

// GameState に追加:
graveyard: { defId: string; promoted: boolean }[];
cursedKing: { player: boolean; enemy: boolean };

// PieceDef に追加:
doomsday?: boolean;        // 下剋上
kingBoon?: boolean;        // 契約の魔神
chainCostsHand?: boolean;  // 血の女王(chainOnCaptureと併用)
// auto の devour バリアントに allyFallback?: boolean を追加(魔王)
// active.kind / Move active ability union に 'apocalypse' を追加
// GameEvent union に 'resurrect' | 'sacrifice' | 'doomsday' | 'apocalypse' | 'curse' を追加
```
`moves: []`(冥府の門)が型的に許容されることを確認(既存`MovePattern[]`なのでOK)。

### src/core/board.ts / newGame
- `newGame`で`graveyard: []`, `cursedKing: {player:false, enemy:false}`を初期化。

### src/core/movegen.ts
- **魔王の複合動き**: `pieceMoves`のlion早期returnを廃し、lionパターンの手(genLion)**と**他パターン(destsBasic)の手を両方生成するよう変更(既存の獅子はlionパターン単独なので挙動不変)。
- **王の動き差し替え**: `pieceMoves`で`p.defId === 'king'`のとき、(§裁定5の優先順で)呪い時`step [F]`のみ/契約時`slide ALL8 max2`のパターンで生成。判定ヘルパ`kingMovePatterns(state, owner): MovePattern[]`を新設してテスト可能にする。
- **血の女王**: `pushMoveVariants`のchainOnCapture分岐で、`d.chainCostsHand`のときは`hands[p.owner]`に通常駒(DROPPABLE)が1枚以上ある場合のみchainバリアントを生成。
- **冥府の門**: moves空なので自然に手なし。`hasAnyDest`が空配列でfalseを返しても影響がない(成り無し・打ち無し)ことをテストで担保。
- **apocalypse**: `genActive`に追加 — 盤上に王・太子・ボス以外の駒が(自身以外に)1体以上あれば`target: sq`で1手生成。

### src/core/apply.ts
- **removeFromBoard(s, sq, toGraveyard)ヘルパを新設**し、既存の`vanish`および特殊駒捕獲消滅・爆発・捕食・断罪等の全ての「持ち駒にならない除去」経路をこれ経由に統一。処理: 盤から外す→イベント→非ロイヤルなら`graveyard`へpush→除去した駒が`kingBoon`なら`s.cursedKing[owner] = true`(event `'curse'`)。
- **auto処理**: `devour`に`allyFallback`対応(裁定3)。新kind `gate`(冥府の門): 裁定2どおり。※autoのunionに`{ kind:'gate'; every:number }`を追加し、冥府の門は`auto:{kind:'gate', every:1}`。天邪鬼は新kind `{ kind:'swapChaos'; every:1 }`: 敵非ロイヤルと自軍非ロイヤル(自身含む)を各1体rng pickして位置交換(どちらか候補ゼロなら不発)。
- **doomsday判定**: `resolveBoardMove`末尾(成り処理後)で裁定4を実行。全消滅は`removeFromBoard`経由。event `'doomsday'`。
- **chainCostsHand**: chain実行の直前に持ち駒消費(裁定6、event `'sacrifice'`)。持ち駒が(理論上)無くなっていたらchainをスキップ。
- **apocalypse**: 裁定7。event `'apocalypse'`。
- **kingBoon除去チェック**は`removeFromBoard`に統合済み(上記)。魔神が捕獲された場合も特殊駒消滅経路=removeFromBoardを通ることを確認。

### src/ai/eval.ts
- `doomsday`駒に前進ボーナス: 自陣からの前進段数×300を加算(AIが下剋上を「止める/走らせる」ようになる)。
- `cursedKing`の側に-800のペナルティ(呪いを恐れて魔神を守る/狙う判断が生まれる)。
- 墓地サイズ×(盤上に自軍の`gate`駒がいれば+40)を加点(門の価値を蘇生残数に連動)。

### src/ai/search.ts
- `moveOrderScore`: `apocalypse`は高スコア(800)グループに追加。

### src/core/run.ts
- `REWARD_WEIGHTS`にforbidden列を追加(合計100維持)。現行表からの差し替え:

| 面 | common | uncommon | rare | mythic | celestial | forbidden |
|---|---:|---:|---:|---:|---:|---:|
| 1〜3 | 1 | 14 | 45 | 35 | 5 | 0 |
| 4 | 1 | 9 | 40 | 40 | 10 | 0 |
| 5(ボス) | 0 | 0 | 28 | 47 | 20 | **5** |
| 6〜9 | 1 | 7 | 32 | 45 | 15 | 0 |
| 10(ボス) | 0 | 0 | 18 | 47 | 28 | **7** |
| 11〜12 | 1 | 4 | 24 | 43 | 24 | **4** |
| 13〜14 | 0 | 3 | 15 | 42 | 32 | **8** |

- `OBTAINABLE_BY_RARITY`・`drawRarity`の列挙に`forbidden`を追加。初心者モードは現行のまま。

### src/core/stages.ts
- 15面の`kirin`を`maou`に置換(敵の魔王は自軍も喰う=自己バランス型の脅威)。スロット計算が既存のHIGH枠に収まることを確認(rarity分岐のelseがHIGH扱いなのでforbiddenも変更不要)。

### src/core/defs/special.ts
- `FORBIDDEN: PieceDef[]`配列を新設し7種を定義、`SPECIAL_DEFS`へ連結。descは上表の能力文を日本語で(代償を必ず明記)。

### src/storage.ts
- ロード時マイグレーション: `run.game`があり`graveyard`/`cursedKing`未定義なら既定値で補完(裁定10)。

### UI
- `src/ui/labels.ts`(または既存のLABELS): `forbidden: '禁忌レア'`。codex.tsのレアリティ列挙に追加。
- `style.css`: `.rarity-forbidden { --rarity: #c22536; }` 血赤+黒基調で神話紫・天上虹より禍々しく(枠に暗い脈動シャドウ等、見た目は実装者判断)。
- `battle.ts eventText` / `move-visuals.ts effectNames`に `resurrect:'蘇生', sacrifice:'供物', doomsday:'下剋上', apocalypse:'終焉', curse:'呪い'` を追加。`move-visuals.ts abilityNames`に`apocalypse:'終焉'`。
- battle.tsの王手警告と同様に、`cursedKing.player`がtrueの間はステータス欄に「呪い: 王は前にしか進めない」を常時表示。

### スペック更新
`docs/superpowers/specs/2026-07-19-shogi-next-design.md`: §2レアリティ行を6段階に、§4.3表をforbidden列付きに差し替え、§6.5の後に「6.6 禁忌レア(7種)」を挿入(既存6.6ボスは6.7へ)、§7に裁定1〜10を追記、§5の15面に魔王を反映、駒総数を58種に更新。

## テスト計画(tests/pieces-forbidden.test.ts ほか)

1. **魔王**: スライダー手とlion二段手が両方生成される/毎手番、隣接敵を捕食/敵ゼロなら味方を喰う/両方ゼロで不発/喰われた駒が墓地に入る。
2. **下剋上**: row1→row0到達で敵非ロイヤル全滅・王とボスは残る/自軍は無傷/到達前は何も起きない/敵側の下剋上はrow8で発動。
3. **冥府の門**: 手が生成されない/消滅した駒が古い順に自軍として蘇生(敵の特殊駒も自軍化)/隣接空きゼロでエントリ温存/持ち駒化された通常駒は蘇生対象にならない。
4. **天邪鬼**: 敵1体と自駒1体の位置が入れ替わる/ロイヤルは対象外/入れ替えで成り判定が発生しない。
5. **契約の魔神**: 魔神が盤上にいる間、王のpieceMovesが8方向2まで/魔神が取られると王は前1のみ/魔神を自分から失っても呪い発動/太子は影響なし。
6. **血の女王**: 持ち駒ありのときのみchainバリアント生成/chain実行で最安通常駒が消える/持ち駒ゼロでchainなし。
7. **星喰い**: 発動で自身含む非ロイヤル全滅+両者持ち駒ゼロ/王・太子・ボスは残る/全消滅駒が墓地に入る(→直後に別対局の冥府の門テストと組み合わせない。同一盤での門との連携1ケース: 門も消滅し墓地に入る)。
8. **墓地/呪いの既存経路**: 爆発・断罪・捕食の消滅が墓地に記録される/通常駒捕獲(持ち駒化)は記録されない/妖狐・復活した不死鳥は記録されない。
9. **run**: forbidden列の境界(1〜3面で0%・5面ボスで5%)/OBTAINABLEにforbidden 7種が入る。
10. **storage**: graveyard/cursedKing欠落セーブのロードが既定値補完で成功。
11. 既存118テスト全緑+`npm run build`成功+selfplayが15面(魔王入り)で例外なし。

## 検証手順

1. `npm test` 全緑 → `npm run build` 成功。
2. `npm run dev`: 図鑑に「禁忌レア」(血赤枠)/報酬で禁忌カードが出る(5面ボス後が最短)/魔王が敵味方を喰う様子・下剋上の全滅演出・冥府の門の蘇生・王の呪い表示をイベントログで確認。
3. コミット分割: engine(墓地・呪い・除去ヘルパ) → 駒defs → run/stages → UI → spec/tests。`Co-Authored-By`既定を踏襲。
