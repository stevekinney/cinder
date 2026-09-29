/**
 * Pure row-shaping for the Realms tab (COR-243). Separated from
 * `realms-tab.svelte` so the projection from `weft.realms.diagnostics`'
 * wire shape to table rows is testable without mounting a component —
 * mirrors `registry-view.ts`'s split for the Registry tab.
 *
 * @module routes/system/realms-view
 */

/** One `weft.realms.diagnostics` realm entry, as the operation's generated client types it. */
export interface RealmDiagnosticsEntrySource {
  readonly state: 'warming' | 'ready' | 'active' | 'draining' | 'terminated' | 'crashed';
  readonly realmGeneration: string | null;
  readonly restartCount: number;
  readonly pendingTurnCount: number;
}

/** One `weft.realms.diagnostics` pool entry, as the operation's generated client types it. */
export interface RealmPoolDiagnosticsSource {
  readonly name: string;
  readonly revision: string;
  readonly revisionActive: boolean;
  readonly realms: readonly RealmDiagnosticsEntrySource[];
}

/** `weft.realms.diagnostics`'s full output shape. */
export interface RealmDiagnosticsSource {
  readonly pools: readonly RealmPoolDiagnosticsSource[];
}

/** One flattened table row: a pool with no realms still renders (an active, idle `(name, revision)`), with `realmIndex` absent. */
export interface RealmDiagnosticsRow {
  readonly key: string;
  readonly name: string;
  readonly revision: string;
  readonly revisionActive: boolean;
  readonly realmIndex: number | null;
  readonly state: RealmDiagnosticsEntrySource['state'] | null;
  readonly realmGeneration: string | null;
  readonly restartCount: number | null;
  readonly pendingTurnCount: number | null;
}

/**
 * Flatten every pool's realm list into one row per realm — or one row for
 * the pool itself when it currently tracks no realms (an active revision
 * with nothing warmed yet, or a revision mid-deactivation whose realms have
 * all already drained). Sorted by `(name, revision)` for stable rendering;
 * `weft.realms.diagnostics` makes no ordering guarantee of its own.
 */
export function realmDiagnosticsRows(
  source: RealmDiagnosticsSource,
): readonly RealmDiagnosticsRow[] {
  const rows: RealmDiagnosticsRow[] = [];
  const pools = [...source.pools].sort(
    (a, b) => a.name.localeCompare(b.name) || a.revision.localeCompare(b.revision),
  );
  for (const pool of pools) {
    if (pool.realms.length === 0) {
      rows.push({
        key: `${pool.name}:${pool.revision}`,
        name: pool.name,
        revision: pool.revision,
        revisionActive: pool.revisionActive,
        realmIndex: null,
        state: null,
        realmGeneration: null,
        restartCount: null,
        pendingTurnCount: null,
      });
      continue;
    }
    pool.realms.forEach((realm, index) => {
      rows.push({
        key: `${pool.name}:${pool.revision}:${index}`,
        name: pool.name,
        revision: pool.revision,
        revisionActive: pool.revisionActive,
        realmIndex: index,
        state: realm.state,
        realmGeneration: realm.realmGeneration,
        restartCount: realm.restartCount,
        pendingTurnCount: realm.pendingTurnCount,
      });
    });
  }
  return rows;
}

/** Total realm count across every pool — the tab's headline count. */
export function totalRealmCount(source: RealmDiagnosticsSource): number {
  return source.pools.reduce((total, pool) => total + pool.realms.length, 0);
}

/** `Badge` variant for a realm lifecycle state — mirrors the state machine's own doc (`core/realm/realm-lifecycle.ts`): terminal-good is neutral, in-service is success, transitional is warning, `crashed` is danger. */
export function realmStateBadgeVariant(
  state: RealmDiagnosticsEntrySource['state'],
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (state) {
    case 'active':
    case 'ready':
      return 'success';
    case 'warming':
    case 'draining':
      return 'warning';
    case 'crashed':
      return 'danger';
    case 'terminated':
      return 'neutral';
    default:
      return 'neutral';
  }
}
