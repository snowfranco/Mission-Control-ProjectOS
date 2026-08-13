# manifold: reader loop closed, outbox drained (2026-08-12)

Answer first: the editorial pass now builds an exclusion set (read plus
parked item ids) before every run and the gate hard-fails any edition that
leads with, or recommends in start_here, an excluded item
(no-excluded-item-leads, src/gate.ts). The outbox sweep was run once and
drained all seven queued items cleanly, zero failures; both schedules are
enabled (editions Tuesday and Friday 07:00, sweep hourly, America/Toronto,
schedule/scheduler.yaml). One blocker remains: golden floors could not be
re-blessed because the local claude CLI's OAuth session is expired; the
command to finish is at the bottom.

## The drain, item by item (sweep run 2026-08-12 22:03 America/Toronto)

All seven applied and marked done; the queue reads zero afterward (verified
by a second sweep: "outbox empty, nothing to route"). The cockpit's queued
chip counts status=queued rows (Superlearn src/components/OutboxPanel.tsx),
so it now shows zero.

1. 741b7295 start-reading "An AI code review bot, built in 30 minutes":
   applied as a reader signal (state.json signals).
2. 80e2d7eb start-reading, same items: applied as a reader signal.
3. 255c8c67 start-reading, same items: applied as a reader signal.
4. 4cc2c978 sources-updated: applied (no state needed; every pass reads
   context fresh).
5. 1b077de4 note (command-bar, "preparing for an AI focused product manager
   role... Specs over vibes"): applied to state.json notes; the next
   editorial pass reads it.
6. 9d1b5c72 park "An AI code review bot, built in 30 minutes"
   (feed-feakxi, feed-wf6xzw, feed-1rm6l1f): applied to state.json parked.
   These are exactly the items backing edition 1's lede; they are now in the
   exclusion set and can never lead again (verified against live inputs, see
   below).
7. 078d38cf assign-to-theme "What is an Eval? -> Quality" (feed-13pwfzf,
   newThemeLabel Quality): applied to state.json assignments; the editorial
   prompt now instructs the pass to honor it (src/prompt.ts). Previously
   this kind fell into the default handoff-to-sphere branch, but theme
   creation and reconciliation are manifold's own decision right
   (OVERLAY.md), so it is applied, not handed off.

## What changed

- Exclusion set (src/inputs.ts): every pass fetches article_read_states
  (read=true ids) and outbox park rows in a rolling window
  (MANIFOLD_PARK_WINDOW_DAYS, default 90, any status so a queued park counts
  before the sweep runs), unions them with state parks, and carries the
  result on PassInputs.excludedItemIds. Both park payload shapes are read:
  plural itemIds (edition view) and ParkItemPayload's singular itemId
  (Feeds tab); the old code read only the plural shape and would have
  applied Feeds-tab parks as empty park marks (src/outbox.ts
  parkPayloadItemIds).
- Gate (src/gate.ts): new deterministic check no-excluded-item-leads; also
  listed in evals/RUBRIC.md. Excluded items may still back themes and
  emerging entries (engagement is clustering signal); they never lead and
  are never re-recommended.
- Smaller honest editions: below MANIFOLD_EDITION_FLOOR viable items
  (default 3) the prompt asks for a smaller edition; at zero viable items
  the run aborts with a report instead of recycling (src/cli.ts).
- Sweep verified idempotent and durable per-item with an offline harness
  (fake Supabase client): a failing PATCH leaves the item queued and the
  retry applies its state effect exactly once (hasOutboxId, src/state.ts);
  a full replay of already-applied items adds nothing; one bad row does not
  block the rest (per-item try/catch, src/outbox.ts). The prior report's
  claims hold, with the two fixes above.
- Schedules (schedule/scheduler.yaml): manifold_daily_edition renamed
  manifold_edition, cron "0 7 * * 2,5"; manifold_outbox_sweep cron
  "0 * * * *"; both enabled: true, disable switch intact.
- Vendored contract re-pinned d5595e2 -> 34ef77e
  (src/vendor/superlearn/VENDOR.md). [CONTRACT-NOTE] No Superlearn contract
  change was needed; the re-pin only picks up what the app already shipped
  in Phase 1.5: OutboxKind 'assign-to-theme', ParkItemPayload,
  AssignToThemePayload, validateOutboxPayload. Nothing manifold writes
  changed shape.

## Verification on live inputs (read-only, no model)

fetchPassInputs against production: 120 items in window, exclusion set 12
ids, 116 viable. feed-feakxi, feed-wf6xzw, feed-1rm6l1f (the parked lede)
and feed-1rrd4fq (read) are all excluded. A scripted output leding with
feed-feakxi fails the gate on no-excluded-item-leads; one recommending it in
start_here fails; a viable lede passes. The editorial prompt marks each
excluded item line, carries the never-lede instruction, and lists the
Quality assignment. So Friday's scheduled edition cannot resurface the
parked lede: the model is told not to, and the gate rejects it if it tries.

## Blocked: golden floors and the live-model checks

The evals runner and edition:dry both need a model, and the local claude
CLI cannot authenticate (OAuth session expired and could not be refreshed;
no ANTHROPIC_API_KEY configured). The mixed-relevance fixture was extended
(read mr-1, state-parked mr-4, outbox-parked mr-2 via the new excluded_ids
input; asserts lede_not_in and the new start_here_not_in) and the fixture
parses under the extended runner schema, but no fixture could execute a
pass. Once the operator re-authenticates the CLI (run `claude` and log in,
or set ANTHROPIC_API_KEY in the repo-root .env):

    cd agents/manifold
    node evals/runner.ts --bless    # full run, re-blesses golden floors
    npm run edition:dry             # optional: preview Friday's edition

-- manifold
