/**
 * Pure view-model mapping for the Registry tab (plan §9.7, T7.2; design
 * `Weft UI.dc.html` "System" § REGISTRY). Turns the wire
 * `GET /v1/registry` snapshot (`weft.system.registry`,
 * `@lostgradient/weft`'s `RegistrySnapshot`, v2 — WFT-6) into sorted,
 * render-ready rows — kept framework-free so it is unit-testable without a
 * DOM.
 *
 * ## v2: `workflows` is a manifest array, not a flat map
 *
 * `RegistrySnapshot.workflows` is now `WorkflowRevisionManifest[]`, sorted
 * by `(name, revision)`, with `activeRevisions` pointing each workflow name
 * at the manifest currently active. This module resolves the active set
 * itself (`activeManifests`) the same way the engine-side
 * `registry-contract-builder.ts` and `weft codegen`'s `codegen-validate.ts`
 * do — one consistent resolution rule, not three independent inventions —
 * then reads each active manifest's identity (`revision`, `manifestVersion`,
 * `contractHash`) and its `.contract` for the fields below.
 *
 * ## The contract and activity gaps this module used to work around are closed (WFT-115)
 *
 * Earlier revisions of this module (through weft v0.11.0) noted that a
 * workflow manifest's `.contract` never carried `.signals`/`.updates`/
 * `.queries`/`.finalizer`, and that `RegistrySnapshot.activities[name]`
 * dropped `ActivityMetadata.retry`/`.timeout` — filed upstream as
 * https://github.com/stevekinney/weft/issues/736. That gap closed
 * engine-side in WFT-5..8 (`WorkflowContract` now carries all four message
 * kinds plus `finalizer`; `RegistryActivityEntry` now carries `retry`/
 * `timeout`) — this module now sources every one of those fields for real
 * rather than typing them permanently `undefined`. A signal/update/query/
 * activity/finalizer this module can't structurally validate (a malformed
 * schema fragment, an unsupported shape) still renders as "unknown" via the
 * existing `schemaTypeLabel` fallback rather than a fabricated narrow type
 * — the same honesty convention this module has always used for schema
 * fragments themselves.
 */
import type { Duration, RetryPolicy } from '@lostgradient/weft';

/** One signal, update, or query contract's schema pair. Mirrors `WorkflowMessageContract` (`@lostgradient/weft`) structurally. */
export interface WorkflowMessageContractSource {
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
}

/** One activity or finalizer contract's schema pair. Mirrors `WorkflowActivityContract` (`@lostgradient/weft`) structurally — currently identical to {@link WorkflowMessageContractSource}, kept as a distinct alias since the two vocabularies (message vs. activity) are independent on the wire and may diverge. */
export type WorkflowActivityContractSource = WorkflowMessageContractSource;

/** The subset of a `WorkflowRevisionManifest.contract` this module reads. Mirrors `WorkflowContract` (`@lostgradient/weft`) structurally rather than importing it, so this module has no runtime dependency on the package. */
export interface WorkflowContractSource {
  readonly name: string;
  readonly workflowVersion: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly signals?: Readonly<Record<string, WorkflowMessageContractSource>>;
  readonly updates?: Readonly<Record<string, WorkflowMessageContractSource>>;
  readonly queries?: Readonly<Record<string, WorkflowMessageContractSource>>;
  readonly activities?: Readonly<Record<string, WorkflowActivityContractSource>>;
  readonly finalizer?: WorkflowActivityContractSource;
}

/** Mirrors `WorkflowRevisionManifest` (`@lostgradient/weft`) structurally. */
export interface WorkflowRevisionManifestSource {
  readonly manifestVersion: number;
  readonly name: string;
  readonly workflowVersion: string;
  readonly revision: string;
  readonly contractHash: string;
  readonly contract: WorkflowContractSource;
}

/** Mirrors `RegistryActivityEntry` (`@lostgradient/weft`) structurally. `retry`/`timeout` types are imported `import type` only — erased at build time, zero bundle cost (see this module's own doc and `../../lib/faults.ts`'s identical constraint on runtime-safe imports). */
export interface RegistryActivityEntrySource {
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly queue: string;
  readonly description?: string;
  readonly retry?: RetryPolicy;
  readonly timeout?: Duration;
}

/** Mirrors `RegistrySnapshot` (`@lostgradient/weft`, v2) structurally. */
export interface RegistrySnapshotSource {
  readonly registryVersion: number;
  readonly generatedAt?: string;
  readonly workflows: readonly WorkflowRevisionManifestSource[];
  readonly activeRevisions: Readonly<Record<string, string>>;
  readonly activities: Readonly<Record<string, RegistryActivityEntrySource>>;
}

/** Resolve the currently active manifest for each workflow name — `activeRevisions[name] === manifest.revision`. */
function activeManifests(
  snapshot: RegistrySnapshotSource,
): readonly WorkflowRevisionManifestSource[] {
  return snapshot.workflows.filter(
    (manifest) => snapshot.activeRevisions[manifest.name] === manifest.revision,
  );
}

/** One field extracted from a JSON Schema `properties` map, for the Tree/list rendering. */
export interface RegistrySchemaField {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string | undefined;
}

export interface RegistryWorkflowRow {
  readonly type: string;
  /** Content-derived or explicitly supplied opaque revision identity (`WorkflowRevisionManifest.revision`). */
  readonly revision: string;
  /** Manifest schema version this revision was built against. Never narrowed to the single literal this build understands — an unsupported value is exactly the `manifest-version-unsupported` compatibility reason surfacing honestly, not a type error. */
  readonly manifestVersion: number;
  /** Deterministic payload-only contract identity (`WorkflowRevisionManifest.contractHash`). */
  readonly contractHash: string;
  /** `WorkflowRevisionManifest.workflowVersion` — the compatibility-relevant version string a `workflow-version-incompatible` verdict compares against, independent of `manifestVersion`. Surfaced here so it's visible without `workflows:read` (the Revisions panel's own gate). */
  readonly workflowVersion: string;
  readonly description: string | undefined;
  readonly tags: readonly string[];
  readonly hasInputSchema: boolean;
  readonly inputFields: readonly RegistrySchemaField[];
  /** Recursive tree for the `Tree`-based detail view (§ REGISTRY DEFINITION DETAIL). */
  readonly inputSchemaTree: readonly SchemaTreeNode[];
  /** `schemaTypeLabel` of the declared root input schema — `undefined` when none is declared. Lets the detail view distinguish "declared as a non-object type, so the tree is legitimately empty" from "nothing declared" when `inputSchemaTree` is `[]`. */
  readonly inputSchemaRootType: string | undefined;
  readonly hasOutputSchema: boolean;
  readonly outputFields: readonly RegistrySchemaField[];
  readonly outputSchemaTree: readonly SchemaTreeNode[];
  /** `schemaTypeLabel` of the declared root output schema — `undefined` when none is declared. Same purpose as {@link RegistryWorkflowRow.inputSchemaRootType}. */
  readonly outputSchemaRootType: string | undefined;
  /** Signal contracts, sorted by name. */
  readonly signals: readonly RegistryContractMessageRow[];
  /** Update contracts, sorted by name. */
  readonly updates: readonly RegistryContractMessageRow[];
  /** Query contracts, sorted by name. */
  readonly queries: readonly RegistryContractMessageRow[];
  /** Activity contracts, sorted by name. */
  readonly activities: readonly RegistryContractMessageRow[];
  /** The definition-level finalizer contract, when declared. */
  readonly finalizer: RegistryContractMessageRow | undefined;
}

/** One signal/update/query/activity/finalizer contract, render-ready — the same schema-presence shape `RegistryWorkflowRow`'s own top-level input/output fields use. */
export interface RegistryContractMessageRow {
  readonly name: string;
  readonly hasInputSchema: boolean;
  readonly inputFields: readonly RegistrySchemaField[];
  readonly inputSchemaTree: readonly SchemaTreeNode[];
  /** See {@link RegistryWorkflowRow.inputSchemaRootType}. */
  readonly inputSchemaRootType: string | undefined;
  readonly hasOutputSchema: boolean;
  readonly outputFields: readonly RegistrySchemaField[];
  readonly outputSchemaTree: readonly SchemaTreeNode[];
  /** See {@link RegistryWorkflowRow.outputSchemaRootType}. */
  readonly outputSchemaRootType: string | undefined;
}

export interface RegistryActivityRow {
  readonly name: string;
  readonly queue: string;
  readonly description: string | undefined;
  readonly hasInputSchema: boolean;
  readonly inputFields: readonly RegistrySchemaField[];
  /** `undefined` when the activity was registered with no retry policy — never fabricated. */
  readonly retry: RetryPolicy | undefined;
  /** `undefined` when the activity was registered with no timeout — never fabricated. */
  readonly timeout: Duration | undefined;
}

function compareCodepoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isJsonSchemaTypeString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Best-effort "type" label for one JSON Schema property fragment — a
 * compact summary, not a full schema renderer. Also used at the schema
 * ROOT (not just for a `properties` entry): a declared root schema that
 * isn't `type: 'object'` — a bare `{ type: 'string' }` input/output/
 * message schema, which Weft permits — has no `properties` to walk, so
 * {@link buildSchemaTree} legitimately returns `[]` for it. That empty
 * tree must never be read as "no schema declared" when a schema WAS
 * declared; callers pair an empty tree with this root-type label so the
 * detail view can say what the schema actually is.
 */
export function schemaTypeLabel(fragment: unknown): string {
  if (!isRecord(fragment)) return 'unknown';
  const record = fragment;

  if (Array.isArray(record['enum'])) return 'enum';
  if (isJsonSchemaTypeString(record['type'])) return record['type'];
  if (Array.isArray(record['type']) && record['type'].every(isJsonSchemaTypeString)) {
    return record['type'].join(' | ');
  }
  if (record['anyOf'] !== undefined || record['oneOf'] !== undefined) return 'union';
  return 'unknown';
}

function schemaDescription(fragment: unknown): string | undefined {
  if (!isRecord(fragment)) return undefined;
  const description = fragment['description'];
  return typeof description === 'string' ? description : undefined;
}

/**
 * Extracts a flat field list from a top-level JSON Schema `object` fragment's
 * `properties`/`required`. Non-object schemas (a bare string/number input
 * schema) yield an empty list rather than throwing — the Tree view falls
 * back to a "no fields" note in that case.
 */
export function extractSchemaFields(
  schema: Record<string, unknown> | undefined,
): readonly RegistrySchemaField[] {
  if (!schema) return [];
  const properties = schema['properties'];
  if (typeof properties !== 'object' || properties === null) return [];

  const required = new Set(
    Array.isArray(schema['required'])
      ? schema['required'].filter((entry): entry is string => typeof entry === 'string')
      : [],
  );

  if (!isRecord(properties)) return [];
  return Object.entries(properties)
    .map(([name, fragment]): RegistrySchemaField => ({
      name,
      type: schemaTypeLabel(fragment),
      required: required.has(name),
      description: schemaDescription(fragment),
    }))
    .toSorted((a, b) => compareCodepoint(a.name, b.name));
}

/** One node in the recursive schema tree the Registry tab renders via Cinder's `Tree` (plan §9.7: "expandable inputSchema Tree"). */
export interface SchemaTreeNode extends RegistrySchemaField {
  readonly id: string;
  readonly children: readonly SchemaTreeNode[];
}

function objectPropertiesOf(fragment: unknown): Record<string, unknown> | undefined {
  if (!isRecord(fragment)) return undefined;
  const record = fragment;
  if (record['type'] !== 'object') return undefined;
  const properties = record['properties'];
  return isRecord(properties) ? properties : undefined;
}

/**
 * Recursively builds a `Tree`-ready node list from a JSON Schema `object`
 * fragment. Only `type: 'object'` fragments with a `properties` map expand
 * into children — arrays, unions, and primitives stay leaves (their `type`
 * label already summarizes them; a full array-item/union-branch renderer is
 * out of scope for a registry preview).
 */
export function buildSchemaTree(
  schema: Record<string, unknown> | undefined,
  idPrefix = 'field',
): readonly SchemaTreeNode[] {
  if (!schema) return [];
  const properties = objectPropertiesOf(schema) ?? schema['properties'];
  if (!isRecord(properties)) return [];

  const required = new Set(
    Array.isArray(schema['required'])
      ? schema['required'].filter((entry): entry is string => typeof entry === 'string')
      : [],
  );

  return Object.entries(properties)
    .map(([name, fragment]): SchemaTreeNode => {
      const id = `${idPrefix}.${name}`;
      const nestedProperties = objectPropertiesOf(fragment);
      return {
        id,
        name,
        type: schemaTypeLabel(fragment),
        required: required.has(name),
        description: schemaDescription(fragment),
        children: nestedProperties && isRecord(fragment) ? buildSchemaTree(fragment, id) : [],
      };
    })
    .toSorted((a, b) => compareCodepoint(a.name, b.name));
}

/** Builds one render-ready contract-message row (a signal, update, query, activity, or finalizer) from its `{inputSchema?, outputSchema?}` pair. */
function toContractMessageRow(
  name: string,
  entry: WorkflowMessageContractSource,
  idPrefix: string,
): RegistryContractMessageRow {
  return {
    name,
    hasInputSchema: entry.inputSchema !== undefined,
    inputFields: extractSchemaFields(entry.inputSchema),
    inputSchemaTree: buildSchemaTree(entry.inputSchema, `${idPrefix}.input`),
    inputSchemaRootType:
      entry.inputSchema === undefined ? undefined : schemaTypeLabel(entry.inputSchema),
    hasOutputSchema: entry.outputSchema !== undefined,
    outputFields: extractSchemaFields(entry.outputSchema),
    outputSchemaTree: buildSchemaTree(entry.outputSchema, `${idPrefix}.output`),
    outputSchemaRootType:
      entry.outputSchema === undefined ? undefined : schemaTypeLabel(entry.outputSchema),
  };
}

/** Sorted (codepoint order, by name) contract-message rows for one signal/update/query/activity record — `[]` when the contract declares none. */
function toContractMessageRows(
  record: Readonly<Record<string, WorkflowMessageContractSource>> | undefined,
  idPrefix: string,
): readonly RegistryContractMessageRow[] {
  if (!record) return [];
  return Object.entries(record)
    .map(([name, entry]) => toContractMessageRow(name, entry, `${idPrefix}.${name}`))
    .toSorted((a, b) => compareCodepoint(a.name, b.name));
}

function toWorkflowRow(manifest: WorkflowRevisionManifestSource): RegistryWorkflowRow {
  const {
    name: type,
    revision,
    manifestVersion,
    contractHash,
    workflowVersion,
    contract,
  } = manifest;
  return {
    type,
    revision,
    manifestVersion,
    contractHash,
    workflowVersion,
    description: contract.description,
    tags: contract.tags ?? [],
    hasInputSchema: contract.inputSchema !== undefined,
    inputFields: extractSchemaFields(contract.inputSchema),
    inputSchemaTree: buildSchemaTree(contract.inputSchema, `${type}.input`),
    inputSchemaRootType:
      contract.inputSchema === undefined ? undefined : schemaTypeLabel(contract.inputSchema),
    hasOutputSchema: contract.outputSchema !== undefined,
    outputFields: extractSchemaFields(contract.outputSchema),
    outputSchemaTree: buildSchemaTree(contract.outputSchema, `${type}.output`),
    outputSchemaRootType:
      contract.outputSchema === undefined ? undefined : schemaTypeLabel(contract.outputSchema),
    signals: toContractMessageRows(contract.signals, `${type}.signals`),
    updates: toContractMessageRows(contract.updates, `${type}.updates`),
    queries: toContractMessageRows(contract.queries, `${type}.queries`),
    activities: toContractMessageRows(contract.activities, `${type}.activities`),
    finalizer:
      contract.finalizer === undefined
        ? undefined
        : toContractMessageRow('finalizer', contract.finalizer, `${type}.finalizer`),
  };
}

function toActivityRow(name: string, entry: RegistryActivityEntrySource): RegistryActivityRow {
  return {
    name,
    queue: entry.queue,
    description: entry.description,
    hasInputSchema: entry.inputSchema !== undefined,
    inputFields: extractSchemaFields(entry.inputSchema),
    retry: entry.retry,
    timeout: entry.timeout,
  };
}

/** Sorted (codepoint order) workflow rows ready for the definitions list, one per currently-active manifest. */
export function registryWorkflowRows(
  snapshot: RegistrySnapshotSource,
): readonly RegistryWorkflowRow[] {
  return activeManifests(snapshot)
    .map((manifest) => toWorkflowRow(manifest))
    .toSorted((a, b) => compareCodepoint(a.type, b.type));
}

/** Sorted (codepoint order) activity rows ready for the activity-definitions grid. */
export function registryActivityRows(
  snapshot: RegistrySnapshotSource,
): readonly RegistryActivityRow[] {
  return Object.entries(snapshot.activities)
    .map(([name, entry]) => toActivityRow(name, entry))
    .toSorted((a, b) => compareCodepoint(a.name, b.name));
}

/** `true` when the registry has nothing registered at all — drives the 3-step onboarding empty state (plan §10.7, Appendix B). */
export function isRegistryEmpty(snapshot: RegistrySnapshotSource): boolean {
  return snapshot.workflows.length === 0 && Object.keys(snapshot.activities).length === 0;
}
