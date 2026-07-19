import type { GameState, Move, Owner, Piece } from './types';
import { ADJ, findRoyals } from './board';
import { def, effectiveDef } from './defs';
import { captureAllowed, isImmobilized, isRoyalPiece, pieceMoves } from './movegen';
import { pick } from './rng';
import { inCamp } from './board';
import { colOf, onBoard, rowOf, sqOf } from './types';
import { DROPPABLE } from './defs/normal';

function opponent(o: Owner): Owner {
  return o === 'player' ? 'enemy' : 'player';
}

// 早期脱出つき被攻撃判定(byの手がsqを取れる/到達できるか)
export function attacked(state: GameState, sq: number, by: Owner): boolean {
  for (let s = 0; s < 81; s++) {
    const p = state.board[s];
    if (!p || p.owner !== by) continue;
    for (const m of pieceMoves(state, s)) {
      if (m.kind === 'move' && (m.to === sq || m.second === sq || m.chain === sq)) return true;
    }
  }
  return false;
}

function removeFromBoard(
  s: GameState,
  sq: number,
  toGraveyard: boolean,
  removed: Piece | null = s.board[sq],
  emitVanish = true,
): Piece | null {
  if (!removed) return null;
  if (s.board[sq]?.id === removed.id) s.board[sq] = null;
  if (emitVanish) s.events.push({ t: 'vanish', sq, defId: removed.defId });
  if (toGraveyard && !isRoyalPiece(removed)) {
    s.graveyard.push({ defId: removed.defId, promoted: removed.promoted });
  }
  if (effectiveDef(removed).kingBoon && !s.cursedKing[removed.owner]) {
    s.cursedKing[removed.owner] = true;
    s.events.push({ t: 'curse', sq, defId: removed.defId });
  }
  return removed;
}

function vanish(s: GameState, sq: number): void {
  removeFromBoard(s, sq, true);
}

function createPiece(s: GameState, defId: string, owner: Owner, promoted = false, autoCount?: number): Piece {
  const d = def(defId);
  return {
    id: s.nextPieceId++,
    defId,
    owner,
    promoted,
    ...(d.active ? { usesLeft: d.active.uses } : {}),
    ...(autoCount !== undefined ? { autoCount } : {}),
  };
}

// 爆発(§7.3-7.4): centerと周囲8の非ロイヤルを消滅。消えた爆弾兵は連鎖。捕獲扱いではない
function explode(s: GameState, center: number): void {
  const queue = [center];
  const done = new Set<number>();
  while (queue.length) {
    const c = queue.shift()!;
    if (done.has(c)) continue;
    done.add(c);
    s.events.push({ t: 'explode', sq: c, defId: 'bomber' });
    for (const sq of [c, ...ADJ[c]]) {
      const v = s.board[sq];
      if (!v || isRoyalPiece(v)) continue;
      const isBomb = effectiveDef(v).onCapturedEffects === 'bomb';
      removeFromBoard(s, sq, true);
      if (isBomb) queue.push(sq);
    }
  }
}

// 捕獲の解決。attackerは既にtoに置かれている。targetは盤から外れている
function resolveCapture(s: GameState, attacker: Piece, target: Piece, to: number): void {
  s.events.push({ t: 'capture', sq: to, defId: target.defId });
  const tDef = effectiveDef(target);
  if (tDef.isRoyal) {
    removeFromBoard(s, to, false, target, false);
    if (findRoyals(s, target.owner).length === 0) {
      s.winner = attacker.owner;
      s.events.push({ t: 'win', who: attacker.owner });
    }
    return;
  }
  const effect = tDef.onCapturedEffects;
  if (effect === 'foxRevert') {
    removeFromBoard(s, to, false, target, false);
    // 妖狐(§6.2 U8): 持ち主の駒台に歩として戻る
    s.hands[target.owner]['pawn'] = (s.hands[target.owner]['pawn'] ?? 0) + 1;
  } else if (effect === 'phoenixRevive' && !target.revived) {
    // 不死鳥(§6.4 M3): 自陣ランダム空きマスに1度だけ復活
    const empties: number[] = [];
    for (let sq = 0; sq < 81; sq++) {
      if (inCamp(target.owner, sq) && !s.board[sq]) empties.push(sq);
    }
    if (empties.length) {
      removeFromBoard(s, to, false, target, false);
      const r = pick(s.rngState, empties);
      s.rngState = r.state;
      s.board[r.value] = { ...target, revived: true };
      s.events.push({ t: 'revive', sq: r.value, defId: target.defId });
    } else {
      removeFromBoard(s, to, true, target, false);
    }
  } else if (effect === 'grudge') {
    removeFromBoard(s, to, true, target, false);
    // 怨念(§6.2 U6): 道連れ。取った駒(非ロイヤル)も消滅
    if (!isRoyalPiece(attacker) && s.board[to] === attacker) removeFromBoard(s, to, true);
  } else if (effect === 'bomb') {
    removeFromBoard(s, to, true, target, false);
    explode(s, to);
  } else if (def(target.defId).isNormal) {
    removeFromBoard(s, to, false, target, false);
    // 通常駒: 生駒として持ち駒へ(成りはpromotedフラグなのでdefIdそのまま)
    s.hands[attacker.owner][target.defId] = (s.hands[attacker.owner][target.defId] ?? 0) + 1;
  } else {
    removeFromBoard(s, to, true, target, false);
  }
  // その他の特殊駒はそのまま消滅(§3.2)
}

// 1ステップの移動+捕獲解決。移動後も盤上に生きていればその駒(新オブジェクト)を返す
function moveStep(s: GameState, from: number, to: number): Piece | null {
  const orig = s.board[from]!;
  const moved: Piece = { ...orig };
  const target = s.board[to];
  s.board[from] = null;
  s.board[to] = moved;
  if (target) resolveCapture(s, moved, target, to);
  return s.board[to] === moved ? moved : null;
}

function resolveBoardMove(s: GameState, m: Extract<Move, { kind: 'move' }>): void {
  const captured = s.board[m.to];
  let moved = moveStep(s, m.from, m.to);
  let finalSq = m.to;
  if (s.winner) return;
  // 獅子の二段目(§7.6)
  if (moved && m.second != null) {
    moved = moveStep(s, m.to, m.second);
    finalSq = m.second;
    if (s.winner) return;
  }
  // 影の刺客の追撃(§6.3 R7)
  if (moved && m.chain != null) {
    const costsHand = effectiveDef(moved).chainCostsHand;
    const sacrifice = costsHand ? DROPPABLE.find((id) => (s.hands[moved!.owner][id] ?? 0) > 0) : undefined;
    if (!costsHand || sacrifice) {
      if (sacrifice) {
        s.hands[moved.owner][sacrifice]--;
        if (!s.hands[moved.owner][sacrifice]) delete s.hands[moved.owner][sacrifice];
        s.events.push({ t: 'sacrifice', sq: m.to, defId: sacrifice });
      }
      moved = moveStep(s, m.to, m.chain);
      finalSq = m.chain;
      if (s.winner) return;
    }
  }
  // 磁将の引き寄せ(§6.3 R5)
  if (moved && m.pull) {
    const t = s.board[m.pull.target];
    if (t && t.owner !== moved.owner && !isRoyalPiece(t) && !s.board[m.pull.to]) {
      s.board[m.pull.to] = t;
      s.board[m.pull.target] = null;
      s.events.push({ t: 'pull', sq: m.pull.to, defId: t.defId });
    }
  }
  // 石化(§6.3 R8)
  if (moved && m.petrify != null) {
    const t = s.board[m.petrify];
    if (t && t.owner !== moved.owner && !isRoyalPiece(t)) {
      s.petrified[t.id] = 1;
      s.events.push({ t: 'petrify', sq: m.petrify, defId: t.defId });
    }
  }
  // 成り(§3.3)
  if (moved && m.promote && s.board[finalSq] === moved) {
    moved.promoted = true;
  }
  if (moved && captured && captured.owner !== moved.owner && effectiveDef(moved).onCaptureAoE) {
    for (const around of ADJ[finalSq]) {
      const target = s.board[around];
      if (target && target.owner !== moved.owner && !isRoyalPiece(target)) vanish(s, around);
    }
  }
  const leave = moved && effectiveDef(moved).leaveBehind;
  if (moved && leave && !s.board[m.from]) {
    s.board[m.from] = createPiece(s, leave.defId, moved.owner);
    s.events.push({ t: 'spawn', sq: m.from, defId: leave.defId });
  }
  if (moved && effectiveDef(moved).doomsday) {
    const finalRow = rowOf(finalSq);
    const enemyBackRank = moved.owner === 'player' ? 0 : 8;
    if (finalRow === enemyBackRank) {
      for (let targetSq = 0; targetSq < 81; targetSq++) {
        const target = s.board[targetSq];
        if (target && target.owner !== moved.owner && !isRoyalPiece(target)) removeFromBoard(s, targetSq, true);
      }
      s.events.push({ t: 'doomsday', sq: finalSq, defId: moved.defId });
    }
  }
}

function resolveActive(s: GameState, m: Extract<Move, { kind: 'active' }>): void {
  const orig = s.board[m.from]!;
  const p: Piece = { ...orig, usesLeft: (orig.usesLeft ?? 0) - 1 };
  s.board[m.from] = p;
  if (m.ability === 'warp') {
    s.board[m.target] = p;
    s.board[m.from] = null;
    s.events.push({ t: 'warp', sq: m.target, defId: p.defId });
  } else if (m.ability === 'kingSwap') {
    const k = s.board[m.target]!;
    s.board[m.target] = p;
    s.board[m.from] = k;
    s.events.push({ t: 'swap', sq: m.target, defId: p.defId });
  } else if (m.ability === 'snipe') {
    const t = s.board[m.target]!;
    removeFromBoard(s, m.target, true);
    s.events.push({ t: 'snipe', sq: m.target, defId: t.defId });
  } else if (m.ability === 'convert') {
    const t = s.board[m.target]!;
    s.board[m.target] = { ...t, owner: p.owner };
    s.events.push({ t: 'convert', sq: m.target, defId: t.defId });
  } else if (m.ability === 'bolt') {
    const col = colOf(m.target);
    for (let row = 0; row < 9; row++) {
      const targetSq = sqOf(row, col);
      const target = s.board[targetSq];
      if (target && target.owner !== p.owner && !isRoyalPiece(target)) vanish(s, targetSq);
    }
    s.events.push({ t: 'bolt', sq: m.target, defId: p.defId });
  } else if (m.ability === 'gale') {
    const row = rowOf(m.target);
    const targets: number[] = [];
    for (let col = 0; col < 9; col++) {
      const targetSq = sqOf(row, col);
      const target = s.board[targetSq];
      if (target && target.owner !== p.owner) targets.push(targetSq);
    }
    for (const targetSq of targets) {
      const target = s.board[targetSq];
      if (!target || target.owner === p.owner) continue;
      const backRow = rowOf(targetSq) + (target.owner === 'player' ? 1 : -1);
      const backSq = onBoard(backRow, colOf(targetSq)) ? sqOf(backRow, colOf(targetSq)) : null;
      if (backSq !== null && !s.board[backSq]) {
        s.board[backSq] = target;
        s.board[targetSq] = null;
      }
    }
    s.events.push({ t: 'gale', sq: m.target, defId: p.defId });
  } else if (m.ability === 'timestop') {
    for (const target of s.board) {
      if (target && target.owner !== p.owner && !isRoyalPiece(target)) s.petrified[target.id] = 1;
    }
    s.events.push({ t: 'timestop', sq: m.from, defId: p.defId });
  } else if (m.ability === 'execute') {
    const target = s.board[m.target];
    if (target && target.owner !== p.owner && !isRoyalPiece(target)) vanish(s, m.target);
    s.events.push({ t: 'execute', sq: m.target, defId: p.defId });
  } else if (m.ability === 'ohabari') {
    const centerRow = rowOf(m.from);
    const centerCol = colOf(m.from);
    for (let targetSq = 0; targetSq < 81; targetSq++) {
      const target = s.board[targetSq];
      if (!target || target.owner === p.owner || isRoyalPiece(target)) continue;
      if (Math.max(Math.abs(rowOf(targetSq) - centerRow), Math.abs(colOf(targetSq) - centerCol)) <= 2) {
        vanish(s, targetSq);
      }
    }
    s.events.push({ t: 'execute', sq: m.from, defId: p.defId });
  } else if (m.ability === 'apocalypse') {
    s.events.push({ t: 'apocalypse', sq: m.from, defId: p.defId });
    for (let targetSq = 0; targetSq < 81; targetSq++) {
      const target = s.board[targetSq];
      if (target && !isRoyalPiece(target)) removeFromBoard(s, targetSq, true);
    }
    s.hands = { player: {}, enemy: {} };
  }
}

function pickAndUpdate<T>(s: GameState, items: readonly T[]): T {
  const result = pick(s.rngState, items);
  s.rngState = result.state;
  return result.value;
}

// 移動解決後、手番側が元から盤上にいた自動行動駒を盤面順に処理する。
// フェーズ中に生成された駒は次の手番までカウントしない。
function resolveAutomaticActions(s: GameState, mover: Owner): void {
  const actors = s.board
    .map((p, sq) => ({ p, sq }))
    .filter(({ p }) => p && p.owner === mover && !!effectiveDef(p).auto)
    .map(({ p, sq }) => ({ id: p!.id, sq }));

  for (const actor of actors) {
    const currentSq = s.board.findIndex((piece) => piece?.id === actor.id);
    if (currentSq < 0) continue;
    const current = s.board[currentSq];
    if (!current || current.owner !== mover) continue;
    if (isImmobilized(s, currentSq, current)) continue;
    const auto = effectiveDef(current).auto;
    if (!auto) continue;
    const p: Piece = { ...current, autoCount: (current.autoCount ?? 0) + 1 };
    s.board[currentSq] = p;
    if (p.autoCount! % auto.every !== 0) continue;

    if (auto.kind === 'spawn' || auto.kind === 'replicate') {
      const empties = ADJ[currentSq].filter((sq) => !s.board[sq]);
      if (!empties.length) continue;
      const targetSq = pickAndUpdate(s, empties);
      if (auto.kind === 'spawn') {
        const sequenceIndex = (p.autoCount! / auto.every - 1) % auto.sequence.length;
        const next = auto.sequence[sequenceIndex];
        s.board[targetSq] = createPiece(s, next.defId, mover, next.promoted ?? false);
        s.events.push({ t: 'spawn', sq: targetSq, defId: next.defId });
      } else {
        s.board[targetSq] = createPiece(s, p.defId, mover, p.promoted, 0);
        s.events.push({ t: 'spawn', sq: targetSq, defId: p.defId });
      }
    } else if (auto.kind === 'devour') {
      let targets = ADJ[currentSq].filter((sq) => {
        const target = s.board[sq];
        return target
          && target.owner !== mover
          && !isRoyalPiece(target)
          && captureAllowed(s, p, currentSq, sq, false);
      });
      if (!targets.length && auto.allyFallback) {
        targets = ADJ[currentSq].filter((sq) => {
          const target = s.board[sq];
          return target && target.owner === mover && target.id !== p.id && !isRoyalPiece(target);
        });
      }
      if (!targets.length) continue;
      const targetSq = pickAndUpdate(s, targets);
      const target = s.board[targetSq]!;
      removeFromBoard(s, targetSq, true);
      s.events.push({ t: 'devour', sq: targetSq, defId: target.defId });
    } else if (auto.kind === 'corrupt') {
      const targets = ADJ[currentSq].filter((sq) => {
        const target = s.board[sq];
        return target && target.owner !== mover && !isRoyalPiece(target) && !!def(target.defId).isNormal;
      });
      if (!targets.length) continue;
      const targetSq = pickAndUpdate(s, targets);
      const target = s.board[targetSq]!;
      s.board[targetSq] = { ...target, owner: mover };
      s.events.push({ t: 'convert', sq: targetSq, defId: target.defId });
    } else if (auto.kind === 'gate') {
      const oldest = s.graveyard[0];
      const empties = ADJ[currentSq].filter((sq) => !s.board[sq]);
      if (!oldest || !empties.length) continue;
      const targetSq = pickAndUpdate(s, empties);
      s.graveyard.shift();
      s.board[targetSq] = createPiece(s, oldest.defId, mover, oldest.promoted);
      s.events.push({ t: 'resurrect', sq: targetSq, defId: oldest.defId });
    } else if (auto.kind === 'swapChaos') {
      const enemies = s.board.flatMap((target, sq) => target && target.owner !== mover && !isRoyalPiece(target) ? [sq] : []);
      const allies = s.board.flatMap((target, sq) => target && target.owner === mover && !isRoyalPiece(target) ? [sq] : []);
      if (!enemies.length || !allies.length) continue;
      const enemySq = pickAndUpdate(s, enemies);
      const allySq = pickAndUpdate(s, allies);
      const enemy = s.board[enemySq]!;
      s.board[enemySq] = s.board[allySq];
      s.board[allySq] = enemy;
      s.events.push({ t: 'swap', sq: enemySq, defId: p.defId });
    }
  }
}

// ボスの回避ワープ(§7.5): playerの手の完全解決後、利きに入っていたら安全な隣接空きマスへ
function bossDodge(s: GameState): void {
  for (let sq = 0; sq < 81; sq++) {
    const p = s.board[sq];
    if (!p || p.owner !== 'enemy') continue;
    if (!effectiveDef(p).dodge) continue;
    if (!attacked(s, sq, 'player')) return;
    const candidates = ADJ[sq].filter((a) => {
      if (s.board[a]) return false;
      // 元マスが空くことで飛車角などの射線が開く場合も含め、移動後の盤で安全性を判定する。
      const board = s.board.slice();
      board[a] = p;
      board[sq] = null;
      return !attacked({ ...s, board }, a, 'player');
    });
    if (candidates.length) {
      const r = pick(s.rngState, candidates);
      s.rngState = r.state;
      s.board[r.value] = p;
      s.board[sq] = null;
      s.bossDodgesLeft--;
      s.events.push({ t: 'warp', sq: r.value, defId: p.defId });
    }
    return;
  }
}

export function applyMove(state: GameState, move: Move): GameState {
  const s: GameState = {
    ...state,
    board: state.board.slice(),
    hands: { player: { ...state.hands.player }, enemy: { ...state.hands.enemy } },
    petrified: { ...state.petrified },
    graveyard: state.graveyard.slice(),
    cursedKing: { ...state.cursedKing },
    events: [],
  };
  const mover = s.turn;
  if (move.kind === 'drop') {
    s.hands[mover][move.defId]--;
    if (!s.hands[mover][move.defId]) delete s.hands[mover][move.defId];
    s.board[move.to] = { id: s.nextPieceId++, defId: move.defId, owner: mover, promoted: false };
  } else if (move.kind === 'active') {
    resolveActive(s, move);
  } else if (move.kind === 'move') {
    resolveBoardMove(s, move);
  }
  if (!s.winner) resolveAutomaticActions(s, mover);
  // 手番を終えた側の石化解除(§7.10: 相手の次の手番の間=その駒の持ち主の手番が1回経過)
  for (const idStr of Object.keys(s.petrified)) {
    const id = Number(idStr);
    let found: Piece | null = null;
    for (let sq = 0; sq < 81 && !found; sq++) {
      const p = s.board[sq];
      if (p && p.id === id) found = p;
    }
    if (!found) {
      delete s.petrified[id];
      continue;
    }
    if (found.owner === mover) {
      s.petrified[id]--;
      if (s.petrified[id] <= 0) delete s.petrified[id];
    }
  }
  if (!s.winner && mover === 'player' && s.bossDodgesLeft > 0) {
    bossDodge(s);
  }
  s.turn = opponent(mover);
  s.moveCount++;
  return s;
}
