// Slice B: the outbox router. The outbox is the human-to-manifold queue.
// Simple intents are applied to manifold's own state and marked done;
// anything that needs another agent or an operator gate is routed into the
// Mission Control queues and marked seen (in flight elsewhere). Nothing is
// deleted; nothing loops.
import type { OutboxItem } from './vendor/superlearn/types.ts';
import type { SupabaseClient } from './supabase.ts';
import { hasOutboxId, loadState, saveState } from './state.ts';
import { appendDecision, appendHandoff, queueContains, torontoIso } from './queues.ts';

export interface RoutedItem {
  id: string;
  kind: string;
  label: string;
  action: 'applied' | 'routed-decision' | 'routed-handoff';
  detail: string;
  newStatus: 'seen' | 'done';
  /** Set when persisting this item failed; it stays queued for the next sweep. */
  error?: string;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Item ids a park payload references. Two shapes exist in the wild: the
 * edition view parks with a plural itemIds array, the Feeds tab parks with
 * ParkItemPayload's singular itemId (vendored contract, re-pinned at
 * 34ef77e). Reading only one shape silently drops the other's parks. */
export function parkPayloadItemIds(payload: Record<string, unknown>): string[] {
  const ids = strArray(payload['itemIds']);
  const single = str(payload['itemId']);
  if (single && !ids.includes(single)) ids.push(single);
  return ids;
}

/** Pure routing decision for one item; the caller persists the effects. */
export function routeItem(item: OutboxItem): RoutedItem {
  const themeId = str(item.payload['themeId']);
  const itemIds = parkPayloadItemIds(item.payload);
  const artifact = `supabase://outbox/${item.id}`;

  switch (item.kind) {
    case 'note':
    case 'add-note':
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'applied',
        detail: 'attached to manifold state; the next editorial pass reads it',
        newStatus: 'done',
      };
    case 'park':
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'applied',
        detail: themeId
          ? `theme ${themeId} marked parked in manifold state`
          : `items [${itemIds.join(', ')}] marked parked in manifold state`,
        newStatus: 'done',
      };
    case 'assign-to-theme': {
      // manifold owns theme creation and reconciliation (vendored contract,
      // AssignToThemePayload): applied here as an assignment the next
      // editorial pass honors, never handed to another agent.
      const itemId = str(item.payload['itemId']);
      const newLabel = str(item.payload['newThemeLabel']);
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'applied',
        detail: newLabel
          ? `item ${itemId ?? '(unknown)'} assigned to new theme "${newLabel}"; the next editorial pass reconciles it`
          : `item ${itemId ?? '(unknown)'} assigned to theme ${themeId ?? '(unknown)'}; the next editorial pass reconciles it`,
        newStatus: 'done',
      };
    }
    case 'start-reading':
    case 'read-next':
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'applied',
        detail: 'recorded as a reader signal for the next pass',
        newStatus: 'done',
      };
    case 'sources-updated':
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'applied',
        detail: 'noted; every pass reads context fresh',
        newStatus: 'done',
      };
    case 'request-edition':
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'applied',
        detail: 'edition requested; run `npm run edition` or enable the scheduler trigger',
        newStatus: 'done',
      };
    case 'draft-position':
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'routed-decision',
        detail: `decision card: draft a position on theme ${themeId ?? '(unknown)'} (${artifact})`,
        newStatus: 'seen',
      };
    case 'publish-column':
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'routed-decision',
        detail: `publish gate for "${item.label}" (${artifact})`,
        newStatus: 'seen',
      };
    default:
      // send-to-project, challenge-response, and anything a future app
      // version adds: hand off to Sphere with the payload attached.
      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        action: 'routed-handoff',
        detail: `handed to sphere: ${item.kind} "${item.label}" (${artifact})`,
        newStatus: 'seen',
      };
  }
}

/** Apply one item's effect to manifold state. Idempotent: an item whose
 * outboxId is already recorded is skipped, so a sweep that died between
 * saving state and PATCHing the row can rerun safely. */
function applyToState(state: ReturnType<typeof loadState>, item: OutboxItem): void {
  if (hasOutboxId(state, item.id)) return;
  const ts = torontoIso();
  const themeId = str(item.payload['themeId']);
  const itemId = str(item.payload['itemId']);
  const itemIds = parkPayloadItemIds(item.payload);

  if (item.kind === 'note' || item.kind === 'add-note') {
    // The app puts the note body in payload.note for add-note (the label is
    // only a caption like "note on <theme>"); the command bar's plain
    // 'note' carries the text as the label. A note referencing a theme or
    // an item keeps that reference in the text the next pass reads.
    const body = str(item.payload['note']) ?? item.label;
    const ref = themeId ? `[theme ${themeId}] ` : itemId ? `[item ${itemId}] ` : '';
    state.notes.push({ ts, text: `${ref}${body}`, source: str(item.payload['source']) ?? item.kind, outboxId: item.id });
  } else if (item.kind === 'park') {
    state.parked.push({ ts, themeId, itemIds, label: item.label, outboxId: item.id });
  } else if (item.kind === 'assign-to-theme') {
    state.assignments.push({
      ts,
      itemId: itemId ?? '(unknown)',
      themeId,
      newThemeLabel: str(item.payload['newThemeLabel']),
      label: item.label,
      outboxId: item.id,
    });
  } else if (item.kind === 'start-reading' || item.kind === 'read-next') {
    state.signals.push({ ts, kind: item.kind, themeId, itemIds, label: item.label, outboxId: item.id });
  } else if (item.kind === 'request-edition') {
    state.notes.push({ ts, text: `reader requested an edition: ${item.label}`, source: item.kind, outboxId: item.id });
  }
}

export async function processOutbox(
  sb: SupabaseClient,
  items: OutboxItem[],
  dryRun: boolean,
): Promise<RoutedItem[]> {
  const state = loadState();
  const routed: RoutedItem[] = [];

  for (const item of items) {
    const decision = routeItem(item);
    routed.push(decision);
    if (dryRun) continue;

    const artifact = `supabase://outbox/${item.id}`;
    try {
      // Persist the effect durably BEFORE flipping the row's status, and
      // make every effect idempotent, so a failure at any point leaves the
      // item queued and the next sweep neither loses nor duplicates it.
      if (decision.action === 'applied') {
        applyToState(state, item);
        saveState(state);
      } else if (decision.action === 'routed-decision') {
        if (!queueContains('decisions', artifact)) {
          appendDecision({
            kind: item.kind === 'publish-column' ? 'publish_gate' : 'other',
            subject: `${item.kind}: ${item.label}`,
            artifact,
          });
        }
      } else {
        if (!queueContains('handoffs', artifact)) {
          appendHandoff({
            to: 'sphere',
            task: `Route the reader's ${item.kind} request: ${item.label}`,
            context: [artifact, 'agents/manifold/OVERLAY.md'],
            note: `manifold applied nothing; payload: ${JSON.stringify(item.payload).slice(0, 300)}. Needs routing or an operator decision.`,
          });
        }
      }

      await sb.fetch(`/outbox?id=eq.${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: { status: decision.newStatus },
        prefer: 'return=minimal',
      });
    } catch (err) {
      decision.error = err instanceof Error ? err.message : String(err);
      decision.detail += ' (persist failed; item stays queued for the next sweep)';
    }
  }

  return routed;
}
