# 将棋NEXT 拡張プラン: 新神話レア+天上レア(計16駒)+自動行動システム

> **実装者(Codex)へ:** 本プランは承認済み設計。上から順にタスク単位で実装し、各タスクごとに `npm test` グリーン確認+コミットすること。既存のデータ駆動構造(PieceDefタグ+フック)を維持し、エンジン本体に駒名の分岐を書かないこと。

## Context

将棋NEXT v1(35駒・15面・ローグライト)は完成済み。プレイしたユーザーの要望:
1. **一気に敵駒を破壊する駒**
2. **毎ターン馬・金・角・飛などを生み出す駒**
3. **相手の行動を制限する駒**
4. **将棋ライクのように「自動行動」する駒**(増殖・腐敗・張飛オマージュ等、動かさなくても勝手に働く駒)

対応: 神話レアの上に新レアリティ**「天上レア(celestial)」**を新設し、新神話レア8種+天上レア8種=**16駒**を追加する。バランスは能力を弱めるのではなく**出現率(入手困難さ)で取る**(ユーザーの明示方針)。

対象リポジトリ: `c:\vscode\SyogiNext`(branch: feature/shogi-next)。スペックは `docs/superpowers/specs/2026-07-19-shogi-next-design.md`。

## 新駒ラインナップ(確定)

### 新・神話レア(8種) — rarity: 'mythic'

| id | 駒 | 動き | 能力 | aiValue |
|---|---|---|---|---|
| raijin | 雷神 | 縦横2まで+斜め1 | 【落雷×1】任意の縦一列の敵駒(非ロイヤル)を全消滅 | 1700 |
| fujin | 風神 | 横スライダー+前後2まで | 【突風×2】任意の横一段の敵駒全てを1マス後退(各駒の自陣方向へ。移動先が空きの駒のみ。ロイヤルも押せる) | 1350 |
| chibosin | 地母神 | 縦横1 | 自動: **毎手番終了時**、隣接空きマスに「歩」を生成 | 1400 |
| kajishin | 鍛冶神 | 斜め2まで | 自動: **2手番ごと**に「金」→「銀」を交互に隣接空きマスに生成 | 1500 |
| shinigami | 死神 | 斜めスライダー | 敵駒を捕獲すると、着地マス周囲8マスの**敵駒**(非ロイヤル)も全消滅(味方無傷・連鎖なし) | 1650 |
| tokinomiko | 時の巫女 | 8方向1 | 【刻停×1】敵の全非ロイヤル駒を次の敵手番の間、行動不能(petrified付与) | 1550 |
| zanei | 残影 | 縦横2まで | 自動: **移動するたび**、元いたマスに「歩」を生成(張飛オマージュ) | 1450 |
| bunshin | 分身武者 | 8方向1 | 自動: **2手番ごと**に自分の複製を隣接空きマスに生成(増殖オマージュ。複製も増殖する) | 1550 |

### 天上レア(8種) — rarity: 'celestial'(新設)

| id | 駒 | 動き | 能力 | aiValue |
|---|---|---|---|---|
| amaterasu | 天照 | 全方向スライダー | **光臨オーラ**: 隣接する敵駒(非ロイヤル)は行動不能(passive常時) | 2600 |
| susanoo | 須佐之男 | 縦横スライダー+斜め2まで | 【十拳剣×1】自身中心5×5の敵駒(非ロイヤル)を全消滅 | 2400 |
| tsukuyomi | 月読 | 8方向2まで | **常時**: 盤上にいる間、敵は持ち駒を打てない | 2000 |
| inari | 稲荷 | 斜め2ジャンプ+縦横1 | 自動: **毎手番終了時**「銀→金→角→飛→馬」の順に隣接空きマスへ生成(以後ループ。馬は`{defId:'bishop',promoted:true}`で生成) | 2500 |
| orochi | 八岐大蛇 | 8方向1 | 自動: **毎手番終了時**、隣接する敵駒(非ロイヤル)1体をランダムに捕食して消滅させる(持ち駒にならない) | 2400 |
| magatsukami | 禍津神 | 斜め2まで | 自動: **2手番ごと**、隣接する敵の通常駒1体をランダムに寝返らせる(腐敗オマージュ。王・特殊駒不可、成り状態維持) | 2200 |
| enma | 閻魔 | 8方向1 | 【断罪×3】盤上の任意の敵駒(非ロイヤル)1体を消滅(距離無制限) | 2200 |
| ryujin | 龍神 | 全方向スライダーで**駒を1枚だけ飛び越えて進める**(貫通。能力=動き) | — | 2600 |

全16駒とも成りなし(`promotesTo`なし)。取られたら消滅(既存の特殊駒ルール)。旧設計案にあった大天狗・毘沙門天・弁財天は自動行動枠と入れ替えで**採用しない**。

## 裁定(スペック§7に追記する内容)

1. **消滅系(落雷・十拳剣・断罪・捕食・死神AoE)**: 捕獲ではない→怨念の道連れ/妖狐の歩返還/不死鳥の復活/爆弾兵の誘爆は**発動しない**(§7.4の既存原則どおり)。持ち駒にもならない。
2. **捕食(orochi)と守護**: `captureAllowed`(src/core/movegen.ts:18)の保護判定を通す — 軍神/覇王オーラ・盾兵/土竜のblockCaptureで守られている駒は捕食できない(isJump=false扱い)。守られた駒しか隣接していなければ不発。石化中の駒は捕食できる。
3. **自動行動の実行順**: 手番側の移動解決後 → 盤面走査順(sq昇順)に手番側の自動行動(spawn/replicate/devour/corrupt)を発火 → 石化カウント処理 → ボス回避 → 手番交代。生成先/対象が複数あるときはシード付きRNG(`state.rngState`)で選ぶ。空きマス/対象がなければ**カウントだけ進めて不発**。
4. **残影(leaveBehind)**: 移動解決の一部として処理(獅子の二段目・刺客の追撃後も、最初の`from`にのみ生成)。fromに駒が残る場合(ありえないが防御的に)は生成しない。ワープ等のactive移動では生成しない。
5. **刻停(timestop)**: 敵の全非ロイヤル駒に`petrified[id]=1`を付与。既存の石化解除ロジック(apply.ts:209-224)がそのまま消化する。
6. **麻痺オーラ(amaterasu)**: 非ロイヤル駒は、隣接に敵の`paralysisAura`駒がいる間`pieceMoves`が空になる(石化と同じ扱い=`isAttacked`にも数えない)。ロイヤルは免疫。天照同士は相互麻痺(仕様どおり)。
7. **打ち禁止(tsukuyomi)**: `genDrops`で相手側の`banEnemyDrops`駒が盤上にいれば打ち手を生成しない。
8. **貫通(ryujin)**: スライド中、敵味方問わず1枚だけ飛び越えて先へ進める。飛び越える駒は取らない。着地が敵駒なら通常の捕獲。
9. **合法手ゼロの自動パス**: 手番側に合法手が1つもない場合(刻停+持ち駒なし等)、`{kind:'pass'}`で手番だけ進む(石化カウント・自動行動・ボス回避は通常どおり処理)。
10. **生成された駒**: 通常駒として扱う(取られたら相手の持ち駒になる)。盤上生成は二歩制約を受けない(二歩は「打ち」の制約)。分身武者の複製は特殊駒なので取られたら消滅。

## エンジン変更(ファイル別)

### src/core/types.ts

```ts
export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'celestial';

// Piece に追加:
autoCount?: number;   // 自動行動カウンタ(生成/増殖/捕食/寝返り)

// MovePattern の slide に追加:
| { type: 'slide'; dirs: readonly Dir[]; max?: number; pierce?: number }  // ryujin: pierce=1

// PieceDef に追加:
auto?:
  | { kind: 'spawn'; every: number; sequence: { defId: string; promoted?: boolean }[] } // 地母神/鍛冶神/稲荷
  | { kind: 'replicate'; every: number }   // 分身武者
  | { kind: 'devour'; every: number }      // 八岐大蛇
  | { kind: 'corrupt'; every: number };    // 禍津神
leaveBehind?: { defId: string };           // 残影
paralysisAura?: boolean;                   // 天照
banEnemyDrops?: boolean;                   // 月読

// active.kind / Move(kind:'active').ability の union に追加:
'bolt' | 'gale' | 'timestop' | 'execute' | 'ohabari'

// Move union に追加:
| { kind: 'pass' }

// GameEvent の1行目unionに追加: 'bolt' | 'gale' | 'timestop' | 'execute' | 'devour' | 'spawn'
```

### src/core/movegen.ts

- `destsBasic`のslide分岐: `pierce`対応。塞がれたとき`pierceLeft>0`なら(敵駒なら捕獲候補もpushした上で)飛び越えて続行、`pierceLeft--`。
- `pieceMoves`冒頭(petrified checkの直後): 非ロイヤル駒で、`ADJ[sq]`に敵の`paralysisAura`駒がいれば`[]`を返す。
- `genDrops`冒頭: 盤上に相手(≠owner)の`banEnemyDrops`駒がいれば即return。
- `genActive`に新kind追加:
  - `bolt`: 各列(0-8)について、その列に敵の非ロイヤル駒が1体以上いれば、**その列の最初に見つかった敵非ロイヤル駒のマス**をtargetに1手生成(列につき1手。UIはそのマスをクリック)。
  - `gale`: 各段について、「後退先(自陣方向1マス)が盤内かつ空き」の敵駒が1体以上いる段に対し、その段の最初の該当敵駒マスをtargetに1手生成。
  - `timestop` / `ohabari`: 敵の非ロイヤル駒が(ohabariは自身中心5×5内に)1体以上いれば、`target: sq`(自分自身のマス)で1手生成。
  - `execute`: 盤上の全ての敵非ロイヤル駒マスそれぞれをtargetに生成。
- `captureAllowed`は変更不要(捕食側から呼ぶだけ)。

### src/core/apply.ts

- `resolveActive`に新case:
  - `bolt`: `col = m.target % 9`。その列の敵(≠使用者)非ロイヤルを全て`vanish`。event `'bolt'`。
  - `gale`: `row = Math.floor(m.target / 9)`。その段の敵駒それぞれについて、後退先(その駒の持ち主の自陣方向 = `rowOf(sq) - forward(owner)`…注: 持ち主の後方は`row - forward(piece.owner)`ではなく**`row + (owner==='player' ? 1 : -1) * (-1)`を整理し、playerの駒はrow+1へ、enemyの駒はrow-1へ**)が空きなら移動。event `'gale'`。
  - `timestop`: 敵の全非ロイヤル駒に`s.petrified[id] = 1`。event `'timestop'`。
  - `execute`: target駒を`vanish`。event `'execute'`。
  - `ohabari`: `m.from`中心の5×5(Chebyshev距離≤2)の敵非ロイヤルを全て`vanish`。event `'explode'`流用でも可だが`'ohabari'`は増やさず`'execute'`でよい(イベント名は実装judge)。
- `resolveBoardMove`:
  - 移動+捕獲解決後、`moved`が生存かつ捕獲が発生し(`state.board[m.to]`が敵駒だったかを事前に記録)、`effectiveDef(moved)`に死神タグ(`onCaptureAoE?: boolean`をPieceDefに追加)があれば、着地マス周囲8の敵非ロイヤルを`vanish`。
  - 冒頭で`const leaveFrom = m.from`を記録し、末尾で`def.leaveBehind`があり`s.board[leaveFrom]`が空なら`{id:nextPieceId++, defId, owner, promoted:false}`を生成。event `'spawn'`。
- `applyMove`:
  - `move.kind === 'pass'`の分岐追加(盤面変更なし)。
  - 移動解決後・石化カウントの前に**自動行動フェーズ**を追加: sq昇順で手番側の`auto`付き駒を走査。各駒`autoCount = (autoCount ?? 0) + 1`(コピーオンライト: `s.board[sq] = {...p, autoCount}`)。`autoCount % every === 0`のとき:
    - `spawn`: `sequence[(autoCount/every - 1) % sequence.length]`を隣接空きマス(rng pick)へ生成。
    - `replicate`: 自分と同じdefIdの新駒を隣接空きマスへ生成(autoCountは新規0)。
    - `devour`: 隣接の敵非ロイヤルのうち`captureAllowed(s, p, sq, targetSq, false)`を満たすものからrng pickして`vanish`。event `'devour'`。
    - `corrupt`: 隣接の敵`isNormal`非ロイヤルからrng pickして`owner`反転(既存convertと同じ、event `'convert'`)。
  - 対象なしは不発(カウントは進む)。
- rngは全て`s.rngState`を`pick`/`randInt`で更新すること(`Math.random`禁止)。

### src/ai/search.ts

- `orderedMoves`: `legalMoves`が空のとき`[{ kind: 'pass' }]`を返す(minimax/findBestMoveの「no legal moves」throwを除去)。
- `moveOrderScore`: `pass`は0。`active`のうち`bolt/ohabari/timestop/execute`は高スコア(例: 800)にして先に読ませる。

### src/core/run.ts

- `REWARD_WEIGHTS`をcelestial列付きで置き換え(合計100を維持):

| 面 | common | uncommon | rare | mythic | celestial |
|---|---|---|---|---|---|
| 1-3 | 70 | 25 | 5 | 0 | 0 |
| 4 | 50 | 35 | 13 | 2 | 0 |
| 5(ボス) | 0 | 0 | 75 | 20 | 5 |
| 6-9 | 35 | 35 | 22 | 7 | 1 |
| 10(ボス) | 0 | 0 | 60 | 30 | 10 |
| 11-12 | 18 | 33 | 33 | 12 | 4 |
| 13-14 | 8 | 27 | 38 | 20 | 7 |

- `OBTAINABLE_BY_RARITY`と`drawRarity`のレアリティ列挙に`celestial`を追加。
- 初心者モード(newRun)は現行のまま(rare70/mythic30)。

### src/core/stages.ts

- 敵編成に追加: 13面`shinigami`、14面`raijin`、15面`amaterasu`(いずれもHIGH_SLOTS消費。15面はhigh枠がちょうど6になる)。
- `enemySetupFor`のrarity分岐は`else`がHIGH扱いなのでcelestialは変更不要。

### src/core/defs/special.ts

- `MYTHICS`配列に新神話8種、新規`CELESTIALS`配列に天上8種を追加し`SPECIAL_DEFS`へ連結。descは上表の能力文をそのまま日本語で。
- 死神は`onCaptureAoE: true`(PieceDefに新規boolean)。

### UI(src/ui/ + src/style.css)

- `codex.ts`: `LABELS`に`celestial: '天上レア'`、レアリティ列挙ループに`'celestial'`追加。
- `reward.ts:16`: 生のrarity文字列表示をやめ、codexと同じ日本語ラベルへ(共通の`RARITY_LABELS`を`src/ui/labels.ts`等に切り出して両方から使う)。
- `style.css:44-47`: `.rarity-celestial { --rarity: ... }`を追加。虹/白金系(例: `conic-gradient`は--rarity変数と相性が悪ければ`#7de3e0`等の淡い光色+`box-shadow`でも可。見た目は実装者判断で「神話紫より明らかに上位」に)。
- `battle.ts:36-39 eventText`と`move-visuals.ts:16-18 effectNames`に新イベント(`bolt:'落雷', gale:'突風', timestop:'刻停', execute:'断罪', devour:'捕食', spawn:'生成'`)を追加。`move-visuals.ts:47 abilityNames`にも新active名を追加。
- `battle.ts`: 手番がplayerで`legalMoves`が空かつ未決着なら「動ける駒がありません。手番をスキップします」を表示して自動で`{kind:'pass'}`を適用する処理を追加(renderまたはapply後のフローに)。

### スペック更新

`docs/superpowers/specs/2026-07-19-shogi-next-design.md`:
- §2の表にレアリティ5種目(天上)を追記、§4.3の報酬表を上の新表に差し替え。
- §6に「6.6 新神話レア(8)」「6.7 天上レア(8)」の表を追加(上表を転記)。
- §7に本プランの裁定1〜10を追記(番号は§7.12以降)。
- §5のステージ表に13/14/15面の追加駒を反映。

## テスト計画(tests/)

新規 `tests/pieces-mythic2.test.ts` / `tests/pieces-celestial.test.ts`。既存の`bare()/put()`ヘルパ(tests/helpers.ts)を使用。最低限:

1. **雷神**: 落雷で列の敵非ロイヤル全滅・ロイヤル生存・妖狐の歩返還が発動しない・uses消費。
2. **風神**: 段の敵駒が各自の自陣方向へ1マス後退・塞がっている駒は不動。
3. **地母神/鍛冶神/稲荷**: 手番終了ごとのautoCount進行と生成物(稲荷は銀→金→角→飛→**馬(promoted bishop)**→銀のループを5手番+6手番目で検証)。空きなしで不発だがカウントは進む。
4. **残影**: 移動元に歩が湧く。ワープでは湧かない。
5. **分身武者**: 2手番ごとに複製。複製もさらに複製する。
6. **死神**: 捕獲時に周囲の敵のみ消滅・味方無傷・王生存。怨念を取ったら道連れで死にAoEなし。
7. **時の巫女**: 刻停後、敵の非ロイヤル全駒の`pieceMoves`が空・王は動ける・敵手番終了で解除。
8. **八岐大蛇**: 毎手番終了時に隣接敵1体が消える・軍神オーラで守られた駒は喰えない・対象なしで不発。
9. **禍津神**: 2手番ごとに隣接敵通常駒が寝返る(成銀→自軍成銀)。特殊駒は対象外。
10. **天照**: 隣接敵駒の`pieceMoves`が空・ロイヤルは動ける・`isAttacked`にも数えられない。
11. **月読**: 敵手番で打ち手が生成されない・月読を取ると打てるようになる。
12. **閻魔**: 任意マスの敵消滅×3回で尽きる・ロイヤル対象外。
13. **龍神**: 駒1枚を飛び越えた先へ移動/捕獲できる・2枚目は飛び越えられない。
14. **pass**: 合法手ゼロの局面で`orderedMoves`がpassを返し、`applyMove(pass)`で手番が進む。
15. **run**: 新報酬表の境界(1面でcelestial 0%・10面ボスでrare/mythic/celestialのみ)・celestialが抽選候補に入る。
16. 既存テストが全て通ること(`npm test`)、`npm run build`成功、既存selfplayテストが新13-15面(死神/雷神/天照入り)で例外なく回ること。

## 検証手順

1. `npm test` 全緑。
2. `npm run build` 成功。
3. `npm run dev` で実プレイ確認: 図鑑に「天上レア」セクション(虹枠・シルエット)が出る/報酬カードに日本語レアリティ表示/13面以降の敵が死神・雷神・天照を使ってくる/新アクティブのUI(能力を使う→対象マス選択)が動く/自動行動(生成・捕食)が敵思考後のイベントログに出る。
4. コミットは機能単位で分割(engine hooks → 新駒defs → run/stages → UI → spec/tests)。メッセージ末尾に`Co-Authored-By`既定を踏襲。
