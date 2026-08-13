// manifold's own working state: parks, reader notes, and reading signals
// consumed by the next editorial pass. Superlearn's tables are the app
// contract; this file is agent memory, kept in the Mission Control repo
// (agents/manifold/state/state.json) like the queues are.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AGENT_ROOT } from './env.ts';

export interface ParkMark {
  ts: string;
  themeId: string | null;
  itemIds: string[];
  label: string;
  /** Outbox row this came from; makes re-application idempotent. */
  outboxId?: string;
}

export interface ReaderNote {
  ts: string;
  text: string;
  source: string;
  outboxId?: string;
}

export interface ReaderSignal {
  ts: string;
  kind: 'start-reading' | 'read-next';
  themeId: string | null;
  itemIds: string[];
  label: string;
  outboxId?: string;
}

/** A reader assign-to-theme intent (AssignToThemePayload in the vendored
 * contract): exactly one of themeId or newThemeLabel is set. manifold owns
 * theme creation and reconciliation, so these are applied here and consumed
 * by the next editorial pass, never handed to another agent. */
export interface ThemeAssignment {
  ts: string;
  itemId: string;
  themeId: string | null;
  newThemeLabel: string | null;
  label: string;
  outboxId?: string;
}

export interface ManifoldState {
  parked: ParkMark[];
  notes: ReaderNote[];
  signals: ReaderSignal[];
  assignments: ThemeAssignment[];
}

const STATE_PATH = join(AGENT_ROOT, 'state', 'state.json');
const KEEP = 500;

export function loadState(): ManifoldState {
  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as Partial<ManifoldState>;
    return {
      parked: raw.parked ?? [],
      notes: raw.notes ?? [],
      signals: raw.signals ?? [],
      assignments: raw.assignments ?? [],
    };
  } catch {
    return { parked: [], notes: [], signals: [], assignments: [] };
  }
}

/** True when any state entry already records this outbox row. */
export function hasOutboxId(state: ManifoldState, outboxId: string): boolean {
  return (
    state.parked.some((p) => p.outboxId === outboxId) ||
    state.notes.some((n) => n.outboxId === outboxId) ||
    state.signals.some((s) => s.outboxId === outboxId) ||
    state.assignments.some((a) => a.outboxId === outboxId)
  );
}

export function saveState(state: ManifoldState): void {
  const trimmed: ManifoldState = {
    parked: state.parked.slice(-KEEP),
    notes: state.notes.slice(-KEEP),
    signals: state.signals.slice(-KEEP),
    assignments: state.assignments.slice(-KEEP),
  };
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  // Write-then-rename so a crash mid-write can never truncate the reader's
  // accumulated intent; loadState treats a corrupt file as empty, so an
  // in-place write here would risk silently wiping every note and park.
  const tmp = `${STATE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(trimmed, null, 2) + '\n');
  renameSync(tmp, STATE_PATH);
}
