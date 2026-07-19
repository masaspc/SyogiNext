import type { GameState, Move, Owner, Piece } from './types';
import { ADJ, findRoyals } from './board';
import { def, effectiveDef } from './defs';
import { isRoyalPiece, pieceMoves } from './movegen';
import { pick } from './rng';
import { inCamp } from './board';

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

function vanish(s: GameState, sq: number): void {
  const p = s.board[sq];
  if (!p) return;
  s.board[sq] = null;
  s.events.push({ t: 'vanish', sq, defId: p.defId });
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
      vanish(s, sq);
      if (isBomb) queue.push(sq);
    }
  }
}

// 捕獲の解決。attackerは既にtoに置かれている。targetは盤から外れている
function resolveCapture(s: GameState, attacker: Piece, target: Piece, to: number): void {
  s.events.push({ t: 'capture', sq: to, defId: target.defId });
  const tDef = effectiveDef(target);
  if (tDef.isRoyal) {
    if (findRoyals(s, target.owner).length === 0) {
      s.winner = attacker.owner;
      s.events.push({ t: 'win', who: attacker.owner });
    }
    return;
  }
  const effect = tDef.onCapturedEffects;
  if (effect === 'foxRevert') {
    // 妖狐(§6.2 U8): 持ち主の駒台に歩として戻る
    s.hands[target.owner]['pawn'] = (s.hands[target.owner]['pawn'] ?? 0) + 1;
  } else if (effect === 'phoenixRevive' && !target.revived) {
    // 不死鳥(§6.4 M3): 自陣ランダム空きマスに1度だけ復活
    const empties: number[] = [];
    for (let sq = 0; sq < 81; sq++) {
      if (inCamp(target.owner, sq) && !s.board[sq]) empties.push(sq);
    }
    if (empties.length) {
      const r = pick(s.rngState, empties);
      s.rngState = r.state;
      s.board[r.value] = { ...target, revived: true };
      s.events.push({ t: 'revive', sq: r.value, defId: target.defId });
    }
  } else if (effect === 'grudge') {
    // 怨念(§6.2 U6): 道連れ。取った駒(非ロイヤル)も消滅
    if (!isRoyalPiece(attacker) && s.board[to] === attacker) vanish(s, to);
  } else if (effect === 'bomb') {
    explode(s, to);
  } else if (def(target.defId).isNormal) {
    // 通常駒: 生駒として持ち駒へ(成りはpromotedフラグなのでdefIdそのまま)
    s.hands[attacker.owner][target.defId] = (s.hands[attacker.owner][target.defId] ?? 0) + 1;
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
    moved = moveStep(s, m.to, m.chain);
    finalSq = m.chain;
    if (s.winner) return;
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
    s.board[m.target] = null;
    s.events.push({ t: 'snipe', sq: m.target, defId: t.defId });
  } else if (m.ability === 'convert') {
    const t = s.board[m.target]!;
    s.board[m.target] = { ...t, owner: p.owner };
    s.events.push({ t: 'convert', sq: m.target, defId: t.defId });
  }
}

// ボスの回避ワープ(§7.5): playerの手の完全解決後、利きに入っていたら安全な隣接空きマスへ
function bossDodge(s: GameState): void {
  for (let sq = 0; sq < 81; sq++) {
    const p = s.board[sq];
    if (!p || p.owner !== 'enemy') continue;
    if (!effectiveDef(p).dodge) continue;
    if (!attacked(s, sq, 'player')) return;
    const candidates = ADJ[sq].filter((a) => !s.board[a] && !attacked(s, a, 'player'));
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
    events: [],
  };
  const mover = s.turn;
  if (move.kind === 'drop') {
    s.hands[mover][move.defId]--;
    if (!s.hands[mover][move.defId]) delete s.hands[mover][move.defId];
    s.board[move.to] = { id: s.nextPieceId++, defId: move.defId, owner: mover, promoted: false };
  } else if (move.kind === 'active') {
    resolveActive(s, move);
  } else {
    resolveBoardMove(s, move);
  }
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
