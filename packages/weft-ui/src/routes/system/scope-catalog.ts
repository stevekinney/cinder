/**
 * Static one-line descriptions for every authorization scope (plan §9.7:
 * "Scope panel — granted/not-granted scopes with one-line descriptions and
 * the UI actions each unlocks"). Feeds both the Scopes tab and the
 * `PermissionMatrix` row axis on the Operations tab.
 *
 * Descriptions are authored from `weft`'s scope vocabulary
 * (`src/lib/scopes.svelte.ts`'s `AUTHORIZATION_SCOPES`, itself mirroring
 * `weft/src/server/authorization-scope.ts`) and each surface's own plan
 * section — not generated from a wire source, because none exists (no
 * catalog operation documents scope semantics in prose). Kept in one place
 * so the two consuming surfaces never drift from each other.
 */
import { AUTHORIZATION_SCOPES, type AuthorizationScope } from '../../lib/scopes.svelte.ts';

export interface ScopeCatalogEntry {
  readonly scope: AuthorizationScope;
  readonly description: string;
  /** What granting this scope unlocks in the console UI, sentence case, no trailing period (matches badge/label copy voice). */
  readonly unlocks: string;
}

const SCOPE_DESCRIPTIONS: Readonly<Record<AuthorizationScope, ScopeCatalogEntry>> = {
  'workflows:read': {
    scope: 'workflows:read',
    description: 'View workflow list, detail, timeline, events, and logs.',
    unlocks: 'Workflow list and detail pages',
  },
  'workflows:write': {
    scope: 'workflows:write',
    description: 'Start, cancel, suspend, resume, time out, and fork workflows.',
    unlocks: 'Start wizard and per-run actions',
  },
  'workflows:admin': {
    scope: 'workflows:admin',
    description: 'Bulk cancel, retry, tag, delete, and purge workflows.',
    unlocks: 'Bulk selection bar and purge',
  },
  'schedules:read': {
    scope: 'schedules:read',
    description: 'View schedule list, detail, and fire history.',
    unlocks: 'Schedules list and detail pages',
  },
  'schedules:write': {
    scope: 'schedules:write',
    description: 'Create, edit, pause, resume, and cancel schedules.',
    unlocks: 'Create/edit schedule drawer',
  },
  'signals:write': {
    scope: 'signals:write',
    description: 'Send signals to running workflows.',
    unlocks: 'Signal forms on the Signals tab',
  },
  'updates:write': {
    scope: 'updates:write',
    description: 'Send updates to running workflows and read their results.',
    unlocks: 'Update forms on the Updates tab',
  },
  'queries:read': {
    scope: 'queries:read',
    description: "Run read-only queries against a workflow's live state.",
    unlocks: 'Query buttons on the workflow header',
  },
  'reviews:read': {
    scope: 'reviews:read',
    description: 'View pending and completed human review requests.',
    unlocks: 'The Reviews inbox and archive',
  },
  'reviews:write': {
    scope: 'reviews:write',
    description: 'Submit decisions on pending human reviews.',
    unlocks: 'The review decision form',
  },
  'attributes:read': {
    scope: 'attributes:read',
    description: "View a workflow's search attributes.",
    unlocks: 'Attributes panel on the Overview tab',
  },
  'attributes:write': {
    scope: 'attributes:write',
    description: "Edit a workflow's search attributes.",
    unlocks: 'Attribute edit controls',
  },
  'tags:write': {
    scope: 'tags:write',
    description: 'Add and remove tags on workflows.',
    unlocks: 'Tag add/remove controls',
  },
  'streams:read': {
    scope: 'streams:read',
    description: 'Read `ctx.stream` token chunks over the raw stream channel.',
    unlocks: 'Streamed-token payload display',
  },
  'events:read': {
    scope: 'events:read',
    description: 'Subscribe to the per-workflow and fleet-wide live event feeds.',
    unlocks: 'Live tails, the fleet activity feed, and notifications',
  },
  'storage:read': {
    scope: 'storage:read',
    description: 'Get and scan keys in the durable storage browser.',
    unlocks: 'Storage get/scan panels',
  },
  'storage:write': {
    scope: 'storage:write',
    description: 'Put, delete, and batch-write keys in the durable storage browser.',
    unlocks: 'Storage put/delete/batch panels',
  },
  'storage:admin': {
    scope: 'storage:admin',
    description: 'Perform conditional-batch writes and view storage capabilities.',
    unlocks: 'Conditional-batch panel and capabilities view',
  },
  'workers:write': {
    scope: 'workers:write',
    description: 'Drain and resume individual workers and worker deployments.',
    unlocks: 'Drain/resume buttons on Workers',
  },
  'system:read': {
    scope: 'system:read',
    description: 'View the registry, metrics, retention overview, and discovery documents.',
    unlocks: 'Registry, Metrics, Discovery, and Operation catalog tabs',
  },
  'system:admin': {
    scope: 'system:admin',
    description: 'Trigger recovery of stalled workflows and view lease health.',
    unlocks: 'The recover-all action on Health & lease',
  },
};

/** Every scope's catalog entry, in `AUTHORIZATION_SCOPES` declaration order. */
export const SCOPE_CATALOG: readonly ScopeCatalogEntry[] = AUTHORIZATION_SCOPES.map(
  (scope) => SCOPE_DESCRIPTIONS[scope],
);

export function scopeCatalogEntry(scope: AuthorizationScope): ScopeCatalogEntry {
  return SCOPE_DESCRIPTIONS[scope];
}
