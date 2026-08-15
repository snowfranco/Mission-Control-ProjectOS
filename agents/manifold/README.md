# manifold (ARCHIVED, extracted 2026-08-15)

manifold no longer lives here. It was extracted into the Superlearn repo,
where it is now a first-class part of the product: versioned with the app,
deployed with it, and contract-native to it.

## Where it lives now

The Superlearn repo (github.com/snowfranco/Superlearn), directory `manifold/`.
It runs on GitHub Actions (Node via tsx): the editorial pass Tuesday and Friday
07:00 America/Toronto (`.github/workflows/manifold-edition.yml`) and the outbox
sweep hourly (`.github/workflows/manifold-sweep.yml`). Setup, schedules, and
the disable switches are in that repo's `manifold/README.md`; the reasoning for
the move and the runtime choice is in its `docs/adr/0001-manifold-runtime.md`.

## Why it moved

Living inside Mission Control meant Superlearn could not be installed by anyone
else (the app shipped without its editor), editions only ran when Mission
Control was up and the local `claude` CLI was authenticated (one of those broke
and blocked eval re-blessing), and the app contract had to be vendored and
re-pinned by hand. In the new home manifold imports the app's `src/schemas.ts`
and `src/types.ts` directly, so drift is impossible, and a fresh clone plus a
Supabase project plus one Anthropic key produces editions with no other repo
involved.

## State of this directory

Frozen, not deleted. Every source file under `src/` and `evals/` is preserved
for history and provenance. Both scheduler triggers (`manifold_edition`,
`manifold_outbox_sweep`) are disabled in `../../schedule/scheduler.yaml` so this
repo never double-runs the agent against the same Supabase. Do not re-enable
them: the live agent is the one in the Superlearn repo. The reader state that
lived in `state/state.json` was migrated into Supabase (`manifold_state`) as
part of the extraction; nothing here writes to Supabase anymore.

A future overseer agent may read Superlearn's outputs, but the brain lives with
the product now.
