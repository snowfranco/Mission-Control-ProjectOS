# manifold: contract notes and flagged mismatches (2026-08-05)

Answer first: manifold builds against the Superlearn repo's src/types.ts and
src/schemas.ts at commit d5595e2 (vendored, agents/manifold/src/vendor/superlearn/),
which is the declared source of truth. Three mismatches were found and
flagged rather than silently adapted to. None blocks the build.

## 1. The build brief's inline contract is stale against the repo

The operator's build brief pasted a types.ts/schemas.ts pair (flat Edition
fields ledeKicker/ledeTitle/ledeDeck, Theme without lane, ThemeLink without
id, Context with flat source list). The actual repo at main (commit d5595e2,
2026-08-05) defines a different and richer contract: Edition with a nested
lede object carrying item_ids, emerging entries with theme_id and lane,
start_here with item_id and minutes, Theme with lane, snake_case row shapes,
and reader-side zod salvage. The repo version is also the shape the live
Supabase migration created (Superlearn repo,
supabase/migrations/20260804000000_superlearn.sql, applied: all tables
verified live 2026-08-05). manifold follows the repo. If the brief's inline
snippets came from an older commit or another branch, nothing further is
needed; if the operator expected the flat shapes, that is an upstream
conversation, not a manifold change.

## 2. types.ts names a "recommendations" write target that does not exist

The vendored types.ts header says manifold writes "editions, themes,
theme_links, and recommendations", but no recommendations table exists in
the migration, no schema exists in schemas.ts, and the app never reads one.
manifold v0 writes editions, themes, and theme_links only. [GAP] upstream:
either the comment is aspirational (a later canon layer) or a table is
missing; the Superlearn repo should say which.

## 3. Read flags live outside the declared read set

types.ts says manifold reads outbox, context, and reading_items. In
practice the app records read state in article_read_states
(src/state/AppStore.tsx markRead), while reading_items.read stays false. An
editor that ignores article_read_states would treat everything as unread,
so manifold joins that table read-only (agents/manifold/src/inputs.ts) and
never writes it. This is an input-side addition, not an output-shape
divergence; flagged so the upstream read/write comment can be corrected.

## Enforcement

Every manifold write must pass the strict writer schemas and round-trip the
vendored reader schemas with salvage treated as failure
(agents/manifold/src/contract.ts; DECISIONS.md 2026-08-05). Re-vendoring
after any upstream contract change is a deliberate step documented in
src/vendor/superlearn/VENDOR.md, followed by an evals run before the next
real write.

-- manifold
