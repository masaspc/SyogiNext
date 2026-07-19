import type { Dir, GameState, Move, MoveInfo, MovePattern, Owner, Piece, PieceDef } from './types';
import { colOf, onBoard, rowOf, sqOf } from './types';
import { ADJ, findRoyals, forward, inCamp, inPromoZone } from './board';
import { def, effectiveDef } from './defs';
import { ALL8, DROPPABLE } from './defs/normal';

function translate(sq: number, dir: Dir, owner: Owner): number | null {
  const s = owner === 'player' ? 1 : -1;
  const r = rowOf(sq) + dir[0] * s;
  const c = colOf(sq) + dir[1] * s;
  return onBoard(r, c) ? sqOf(r, c) : null;
}

export function isRoyalPiece(p: Piece): boolean {
  return !!effectiveDef(p).isRoyal;
}

export function isImmobilized(state: GameState, sq: number, piece: Piece | null = state.board[sq]): boolean {
  if (!piece) return false;
  if (state.petrified[piece.id]) return true;
  if (isRoyalPiece(piece)) return false;
  return ADJ[sq].some((a) => {
    const neighbor = state.board[a];
    return neighbor && neighbor.owner !== piece.owner && effectiveDef(neighbor).paralysisAura;
  });
}

// 捕獲可否(§7.1): ロイヤルは常に取れる。非ロイヤルは blockCapture とオーラ(軍神/覇王)で保護され得る
export function captureAllowed(state: GameState, attacker: Piece, from: number, to: number, isJump: boolean): boolean {
  const target = state.board[to];
  if (!target) return true;
  if (isRoyalPiece(target)) return true;
  const tDef = effectiveDef(target);
  const info: MoveInfo = { from, to, isJump };
  if (tDef.blockCapture && tDef.blockCapture(attacker, effectiveDef(attacker), info, target, state)) return false;
  for (const a of ADJ[to]) {
    const g = state.board[a];
    if (g && g.owner === target.owner && g.id !== target.id && effectiveDef(g).aura) return false;
  }
  return true;
}

export function kingMovePatterns(state: GameState, owner: Owner): MovePattern[] {
  if (state.cursedKing[owner]) return [{ type: 'step', dirs: [[-1, 0]] }];
  const hasBoon = state.board.some((piece) => piece && piece.owner === owner && effectiveDef(piece).kingBoon);
  return hasBoon ? [{ type: 'slide', dirs: ALL8, max: 2 }] : [{ type: 'step', dirs: ALL8 }];
}

function destsBasic(state: GameState, sq: number, p: Piece, d: PieceDef): { to: number; isJump: boolean }[] {
  const out: { to: number; isJump: boolean }[] = [];
  for (const pat of d.moves) {
    if (pat.type === 'step') {
      for (const dir of pat.dirs) {
        const to = translate(sq, dir, p.owner);
        if (to === null) continue;
        const occ = state.board[to];
        if (occ && occ.owner === p.owner) continue;
        out.push({ to, isJump: false });
      }
    } else if (pat.type === 'slide') {
      for (const dir of pat.dirs) {
        let cur = sq;
        let pierceLeft = pat.pierce ?? 0;
        for (let step = 0; step < (pat.max ?? 8); step++) {
          const to = translate(cur, dir, p.owner);
          if (to === null) break;
          const occ = state.board[to];
          if (!occ) {
            out.push({ to, isJump: false });
            cur = to;
            continue;
          }
          if (occ.owner !== p.owner) out.push({ to, isJump: false });
          if (pierceLeft <= 0) break;
          pierceLeft--;
          cur = to;
        }
      }
    } else if (pat.type === 'jump') {
      for (const off of pat.offsets) {
        const to = translate(sq, off, p.owner);
        if (to === null) continue;
        const occ = state.board[to];
        if (occ && occ.owner === p.owner) continue;
        out.push({ to, isJump: true });
      }
    }
  }
  return out;
}

// その位置から(占有無視で)動きが1つでも盤内に届くか。falseなら「行き所のない駒」(§7.8)
export function hasAnyDest(d: PieceDef, owner: Owner, sq: number): boolean {
  for (const pat of d.moves) {
    if (pat.type === 'lion') return true;
    const dirs = pat.type === 'jump' ? pat.offsets : pat.dirs;
    for (const dir of dirs) {
      if (translate(sq, dir, owner) !== null) return true;
    }
  }
  return false;
}

// 移動のみ簡易適用(能力の解決なし)。バリアント生成・獅子二段目の候補計算用
function simulateMove(state: GameState, from: number, to: number): GameState {
  const board = state.board.slice();
  board[to] = board[from];
  board[from] = null;
  return { ...state, board };
}

const ORTH_ABS: readonly Dir[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function pushMoveVariants(state: GameState, moves: Move[], p: Piece, d: PieceDef, from: number, to: number, promote: boolean): void {
  const captured = state.board[to];
  const baseMove: Move = { kind: 'move', from, to, promote };
  if (d.chainOnCapture && captured) {
    moves.push({ ...baseMove, chain: null });
    const canPay = !d.chainCostsHand || DROPPABLE.some((id) => (state.hands[p.owner][id] ?? 0) > 0);
    if (canPay) {
      const after = simulateMove(state, from, to);
      for (const { to: c, isJump } of destsBasic(after, to, p, d)) {
        const occ2 = after.board[c];
        if (occ2 && !captureAllowed(after, p, to, c, isJump)) continue;
        moves.push({ ...baseMove, chain: c });
      }
    }
  } else if (d.afterMoveChoice === 'magnetPull') {
    moves.push({ ...baseMove, pull: null });
    const after = simulateMove(state, from, to);
    for (const dir of ORTH_ABS) {
      let cur = to;
      let dist = 0;
      while (true) {
        const r = rowOf(cur) + dir[0];
        const c = colOf(cur) + dir[1];
        if (!onBoard(r, c)) break;
        cur = sqOf(r, c);
        dist++;
        const occ2 = after.board[cur];
        if (occ2) {
          if (occ2.owner !== p.owner && !isRoyalPiece(occ2) && dist > 1) {
            const pullTo = sqOf(rowOf(cur) - dir[0], colOf(cur) - dir[1]);
            moves.push({ ...baseMove, pull: { target: cur, to: pullTo } });
          }
          break;
        }
      }
    }
  } else if (d.afterMoveChoice === 'petrify') {
    moves.push({ ...baseMove, petrify: null });
    const after = simulateMove(state, from, to);
    for (const a of ADJ[to]) {
      const occ2 = after.board[a];
      if (occ2 && occ2.owner !== p.owner && !isRoyalPiece(occ2)) {
        moves.push({ ...baseMove, petrify: a });
      }
    }
  } else {
    moves.push(baseMove);
  }
}

// 獅子(§6.4 M1): 8方向1マスを1手番に2回まで。二段目は停止(null)・帰還(=居食い)も可
function genLion(state: GameState, sq: number, p: Piece, moves: Move[]): void {
  for (const a of ADJ[sq]) {
    const occ = state.board[a];
    if (occ && occ.owner === p.owner) continue;
    if (occ && !captureAllowed(state, p, sq, a, false)) continue;
    moves.push({ kind: 'move', from: sq, to: a, promote: false, second: null });
    if (occ && isRoyalPiece(occ)) continue; // 一段目でロイヤル捕獲なら即勝ち、二段目なし
    const after = simulateMove(state, sq, a);
    for (const b of ADJ[a]) {
      const occ2 = after.board[b];
      if (occ2 && occ2.owner === p.owner) continue;
      if (occ2 && !captureAllowed(after, p, a, b, false)) continue;
      moves.push({ kind: 'move', from: sq, to: a, promote: false, second: b });
    }
  }
}

function genActive(state: GameState, sq: number, p: Piece, d: PieceDef, moves: Move[]): void {
  if (!d.active || !p.usesLeft || p.usesLeft <= 0) return;
  const kind = d.active.kind;
  if (kind === 'warp') {
    for (let s = 0; s < 81; s++) {
      if (inCamp(p.owner, s) && !state.board[s]) moves.push({ kind: 'active', from: sq, ability: 'warp', target: s });
    }
  } else if (kind === 'kingSwap') {
    const royals = findRoyals(state, p.owner).filter((r) => r !== sq);
    const king = royals.find((r) => state.board[r]!.defId === 'king');
    const target = king ?? royals[0];
    if (target !== undefined) moves.push({ kind: 'active', from: sq, ability: 'kingSwap', target });
  } else if (kind === 'snipe') {
    const f = forward(p.owner);
    let cur = sq;
    for (let i = 0; i < 3; i++) {
      const r = rowOf(cur) + f;
      const c = colOf(cur);
      if (!onBoard(r, c)) break;
      cur = sqOf(r, c);
      const occ = state.board[cur];
      if (occ) {
        if (occ.owner !== p.owner && !isRoyalPiece(occ)) moves.push({ kind: 'active', from: sq, ability: 'snipe', target: cur });
        break; // 遮蔽(§6.3 R6)
      }
    }
  } else if (kind === 'convert') {
    for (const a of ADJ[sq]) {
      const occ = state.board[a];
      if (occ && occ.owner !== p.owner && !isRoyalPiece(occ) && def(occ.defId).isNormal) {
        moves.push({ kind: 'active', from: sq, ability: 'convert', target: a });
      }
    }
  } else if (kind === 'bolt') {
    for (let col = 0; col < 9; col++) {
      for (let row = 0; row < 9; row++) {
        const target = sqOf(row, col);
        const occ = state.board[target];
        if (occ && occ.owner !== p.owner && !isRoyalPiece(occ)) {
          moves.push({ kind: 'active', from: sq, ability: 'bolt', target });
          break;
        }
      }
    }
  } else if (kind === 'gale') {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const target = sqOf(row, col);
        const occ = state.board[target];
        if (!occ || occ.owner === p.owner) continue;
        const backRow = row + (occ.owner === 'player' ? 1 : -1);
        if (onBoard(backRow, col) && !state.board[sqOf(backRow, col)]) {
          moves.push({ kind: 'active', from: sq, ability: 'gale', target });
          break;
        }
      }
    }
  } else if (kind === 'timestop') {
    const hasTarget = state.board.some((occ) => occ && occ.owner !== p.owner && !isRoyalPiece(occ));
    if (hasTarget) moves.push({ kind: 'active', from: sq, ability: 'timestop', target: sq });
  } else if (kind === 'execute') {
    for (let target = 0; target < 81; target++) {
      const occ = state.board[target];
      if (occ && occ.owner !== p.owner && !isRoyalPiece(occ)) {
        moves.push({ kind: 'active', from: sq, ability: 'execute', target });
      }
    }
  } else if (kind === 'ohabari') {
    const hasTarget = state.board.some((occ, target) => occ
      && occ.owner !== p.owner
      && !isRoyalPiece(occ)
      && Math.max(Math.abs(rowOf(target) - rowOf(sq)), Math.abs(colOf(target) - colOf(sq))) <= 2);
    if (hasTarget) moves.push({ kind: 'active', from: sq, ability: 'ohabari', target: sq });
  } else if (kind === 'apocalypse') {
    const hasTarget = state.board.some((occ, target) => target !== sq && occ && !isRoyalPiece(occ));
    if (hasTarget) moves.push({ kind: 'active', from: sq, ability: 'apocalypse', target: sq });
  }
}

export function pieceMoves(state: GameState, sq: number): Move[] {
  const p = state.board[sq];
  if (!p || state.winner) return [];
  if (isImmobilized(state, sq, p)) return []; // 石化・麻痺中(§7.10, §7.16)
  const effective = effectiveDef(p);
  const d = p.defId === 'king' ? { ...effective, moves: kingMovePatterns(state, p.owner) } : effective;
  const moves: Move[] = [];
  if (d.moves.some((m) => m.type === 'lion')) genLion(state, sq, p, moves);
  const base = def(p.defId);
  const canPromote = !p.promoted && !!base.promotesTo;
  for (const { to, isJump } of destsBasic(state, sq, p, d)) {
    const occ = state.board[to];
    if (occ && !captureAllowed(state, p, sq, to, isJump)) continue;
    const zone = inPromoZone(p.owner, sq) || inPromoZone(p.owner, to);
    const must = canPromote && !hasAnyDest(base, p.owner, to);
    const promoteOpts = canPromote && zone ? (must ? [true] : [false, true]) : [false];
    for (const promote of promoteOpts) {
      pushMoveVariants(state, moves, p, d, sq, to, promote);
    }
  }
  genActive(state, sq, p, d, moves);
  return moves;
}

function hasOwnPawnInCol(state: GameState, owner: Owner, col: number): boolean {
  for (let r = 0; r < 9; r++) {
    const p = state.board[sqOf(r, col)];
    if (p && p.owner === owner && p.defId === 'pawn' && !p.promoted) return true;
  }
  return false;
}

function genDrops(state: GameState, owner: Owner, moves: Move[]): void {
  if (state.board.some((p) => p && p.owner !== owner && effectiveDef(p).banEnemyDrops)) return;
  const hand = state.hands[owner];
  for (const defId of Object.keys(hand)) {
    if (!hand[defId]) continue;
    const d = def(defId);
    for (let s = 0; s < 81; s++) {
      if (state.board[s]) continue;
      if (!hasAnyDest(d, owner, s)) continue; // 行き所のない打ち禁止
      if (defId === 'pawn' && hasOwnPawnInCol(state, owner, colOf(s))) continue; // 二歩
      moves.push({ kind: 'drop', defId, to: s });
    }
  }
}

export function legalMoves(state: GameState, owner: Owner): Move[] {
  if (state.winner) return [];
  const moves: Move[] = [];
  for (let sq = 0; sq < 81; sq++) {
    const p = state.board[sq];
    if (p && p.owner === owner) moves.push(...pieceMoves(state, sq));
  }
  genDrops(state, owner, moves);
  return moves;
}

// sqがbyの手で取られ得るか(王手警告・ボス回避用。§7.10: 石化駒の手は含まれない)
export function isAttacked(state: GameState, sq: number, by: Owner): boolean {
  return legalMoves(state, by).some(
    (m) => m.kind === 'move' && (m.to === sq || m.second === sq || m.chain === sq),
  );
}
