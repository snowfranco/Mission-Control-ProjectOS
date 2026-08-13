// Append-only writers for the Mission Control queues, line schemas per
// queues/README.md. Records are appended, never edited in place.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './env.ts';

const DECISIONS = join(REPO_ROOT, 'queues', 'decisions.jsonl');
const HANDOFFS = join(REPO_ROOT, 'queues', 'handoffs.jsonl');

/** ISO-8601 with the America/Toronto offset, per queues/README.md. */
export function torontoIso(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const offsetRaw = get('timeZoneName'); // e.g. "GMT-04:00"
  const offset = offsetRaw.replace('GMT', '') || '-05:00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}

/** True when a queue file already carries this exact string value (e.g. an
 * outbox artifact url); keeps re-routing idempotent. Matching the
 * JSON-encoded form (quotes included) prevents a shorter id from matching
 * inside a longer one and survives ids that JSON escaping rewrites. */
export function queueContains(queue: 'decisions' | 'handoffs', needle: string): boolean {
  const path = queue === 'decisions' ? DECISIONS : HANDOFFS;
  if (!existsSync(path)) return false;
  return readFileSync(path, 'utf8').includes(JSON.stringify(needle));
}

function nextId(path: string, prefix: string, yyyymmdd: string): string {
  let count = 0;
  if (existsSync(path)) {
    const stem = `"${prefix}-${yyyymmdd}-`;
    count = readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.includes(stem)).length;
  }
  return `${prefix}-${yyyymmdd}-${String(count + 1).padStart(3, '0')}`;
}

export interface DecisionCard {
  kind: string;
  subject: string;
  artifact: string;
  options?: string[];
}

export function appendDecision(card: DecisionCard, now = new Date()): string {
  const ts = torontoIso(now);
  const id = nextId(DECISIONS, 'dq', ts.slice(0, 10).replaceAll('-', ''));
  const line = {
    id,
    ts,
    kind: card.kind,
    agent: 'manifold',
    subject: card.subject,
    artifact: card.artifact,
    options: card.options ?? ['go', 'no_go', 'park', 'revise'],
    status: 'pending',
    decision: null,
    decided_ts: null,
  };
  appendFileSync(DECISIONS, JSON.stringify(line) + '\n');
  return id;
}

export interface Handoff {
  to: string;
  task: string;
  context: string[];
  note: string;
}

export function appendHandoff(handoff: Handoff, now = new Date()): string {
  const ts = torontoIso(now);
  const id = nextId(HANDOFFS, 'ho', ts.slice(0, 10).replaceAll('-', ''));
  const line = {
    id,
    ts,
    from: 'manifold',
    to: handoff.to,
    task: handoff.task,
    context: handoff.context,
    note: handoff.note,
    deadline: null,
    status: 'dispatched',
  };
  appendFileSync(HANDOFFS, JSON.stringify(line) + '\n');
  return id;
}
