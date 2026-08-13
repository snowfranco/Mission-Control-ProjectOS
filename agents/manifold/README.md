# manifold

The Superlearn editor. Reads `reading_items` and `context` from the
Superlearn Supabase, writes one gated edition plus themes and theme links,
and routes the reader's outbox back into Mission Control. Behavior contract:
OVERLAY.md. Values: IDENTITY.md. Contract provenance: src/vendor/superlearn/VENDOR.md.

## Setup (once)

    cd agents/manifold
    npm install

Secrets: copy `.env.example` to `.env` at the repo root and fill in
`SUPABASE_SERVICE_ROLE_KEY` (the anon key works as a stopgap while RLS is
allow-all). Model auth: set `ANTHROPIC_API_KEY`, or leave it unset to use the
local `claude` CLI. Requires Node 23.6+ (runs TypeScript natively).

## Run

    npm run edition        # the editorial pass: writes to Supabase if the gate passes
    npm run edition:dry    # same pass, gate and report only, no writes
    npm run outbox         # route queued outbox items (parks, notes, requests)
    npm run outbox:dry     # preview routing decisions, nothing persisted

(npm swallows a bare `--dry-run`; use the `:dry` scripts, or
`node src/cli.ts <command> --dry-run` directly.)

Every editorial run (including dry runs and empty-corpus aborts) writes a
decision-grade report to `reports/manifold/`. A run that fails the
deterministic gate writes the report, writes nothing to Supabase, and exits 1.
The outbox router's record is its stdout log plus the queue lines it appends;
it writes no report file.

Scheduled runs: `manifold_edition` (Tuesday and Friday 07:00
America/Toronto) and `manifold_outbox_sweep` (hourly, on the hour) in
`schedule/scheduler.yaml`, both enabled since 2026-08-12; flip
`enabled: false` on either to pause it.

## Evals

    npm run evals                        # full: real pass + LLM judge per fixture
    node evals/runner.ts --skip-judge    # deterministic layer only
    node evals/runner.ts --fixture hype-but-stale
    node evals/runner.ts --bless         # re-bless golden floors (deliberate act)

Rubric and thresholds: evals/RUBRIC.md. Fixtures: evals/fixtures/ (format in
its README). Scores append to evals/results/history.jsonl; golden floors live
in evals/golden/golden.json. The deterministic subset of the rubric is the
same code (src/gate.ts) that gates real runs.

## Layout

    src/cli.ts         entry: edition | outbox
    src/run.ts         attempt loop: prompt, model, build, gate
    src/prompt.ts      the editorial prompt (versioned here, nowhere else)
    src/editorial.ts   deterministic build: heat, carry-forward, meta, ids
    src/gate.ts        the hard write gate (also the evals deterministic layer)
    src/contract.ts    strict writer schemas + app-contract round-trip
    src/vendor/        Superlearn types.ts/schemas.ts, pinned (VENDOR.md)
    src/outbox.ts      Slice B router (apply simple, route the rest)
    src/queues.ts      queues/decisions.jsonl and queues/handoffs.jsonl writers
    src/state.ts       agent memory: parks, notes, signals (state/state.json)
    evals/             rubric, fixtures, runner, judge, golden, results
