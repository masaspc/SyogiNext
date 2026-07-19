# Claude Review Handoff

## Review target

- Branch: `feature/shogi-next`
- Implementation range: `76e8d37..450bb4d`
- Scope: Task 7 completion through Task 16
- Source of truth:
  - `docs/superpowers/specs/2026-07-19-shogi-next-design.md`
  - `docs/superpowers/plans/2026-07-19-shogi-next.md`

## Implemented

- Task 7: rare pieces and effects (bomb chain, pull, snipe, chain move, petrify)
- Task 8: mythic pieces and effects
- Task 9: bosses, aura, and dodge warp
- Task 10: 15 stages, rewards, formation, beginner mode, run transitions
- Task 11: deterministic iterative-deepening alpha-beta AI and Web Worker
- Task 12: versioned localStorage persistence
- Task 13-15: title, codex, formation, battle, reward, and result screens
- Task 16: all-stage self-play smoke test
- Review fix: a completed battle restored during the result-transition window now proceeds to result handling instead of starting AI with no legal moves

## Verification

```text
npm test
13 test files passed
96 tests passed

npm run build
TypeScript and Vite production build passed
```

The Vite development server returned HTTP 200 and served an `#app` root. The automated in-app browser was unavailable in the Codex session, so visual interaction could not be completed there.

## Decisions to review

1. Stage 15 lists five rare-or-higher non-boss pieces, but the stated replacement pool (two golds, bishop, rook) has only four squares. `stages.ts` uses one silver square as the fifth fixed fallback while preserving the king square for Haoh.
2. Optional move effects are selected after the first destination through a list of generated move variants. Please confirm this interaction is acceptable for lion second moves, assassin chain moves, magnet pull, petrify, and promotion combinations.
3. The codex groups the 32 obtainable pieces by rarity. Bosses are recorded as encountered but are not shown because they have no rarity group in the specified codex layout.

## Manual review checklist

- Start with `npm run dev`.
- Check title to codex and back.
- Start beginner mode, confirm one rare/mythic piece is owned and already deployed.
- Start a battle, make a move, wait for the worker AI response, then reload and continue.
- Exercise promotion and each optional move-effect selector.
- Confirm win to reward to next formation, resign to result, and save removal after a run ends.
