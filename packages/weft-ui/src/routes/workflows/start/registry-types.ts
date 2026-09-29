/**
 * `weft.system.registry`'s generated operation-client output types
 * `workflows` (a manifest array, v2 — WFT-6) and `activeRevisions`/
 * `activities` as `unknown` by design — `get-registry.ts` (weft server)
 * deliberately treats those dictionaries/arrays as opaque on the wire
 * ("trusting the builder's TypeScript types … is enough for discovery"; a
 * `z.record()` schema would silently drop `__proto__`-named entries). This
 * module narrows that `unknown` back into the real, documented shape
 * (`RegistrySnapshot`, `weft/src/core/registry-snapshot.ts` — not exported
 * from `@lostgradient/weft`'s public surface) with a runtime type guard
 * rather than a bare cast, per this repo's "prefer type guards over
 * assertions" convention, then resolves each name's *active* manifest —
 * `activeRevisions[name] === manifest.revision` — the same resolution rule
 * `registry-view.ts` and the engine-side `registry-contract-builder.ts`/
 * `codegen-validate.ts` use.
 */

export interface RegistryWorkflowEntry {
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
  readonly description?: string;
  readonly tags?: readonly string[];
  /**
   * The active manifest's own `revision` (WFT-117) — every active manifest
   * carries one, so this is required rather than optional, unlike the
   * `.contract`-projected fields above. Lets the Review step tell the
   * operator which exact revision the run they are about to start will
   * resolve against.
   */
  readonly revision: string;
}

interface WorkflowRevisionManifestLike {
  readonly name: string;
  readonly revision: string;
  readonly contract: unknown;
}

/**
 * Project a manifest's `.contract` down to the `RegistryWorkflowEntry`
 * fields this module declares — `name`/`workflowVersion`/`signals`/etc.
 * that `WorkflowContract` also carries are deliberately not passed
 * through, matching the same projection `codegen-validate.ts` (weft
 * server) performs from the identical source shape.
 */
function toRegistryWorkflowEntry(
  value: unknown,
  revision: string,
): RegistryWorkflowEntry | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) record[key] = entry;
  const entry: {
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    description?: string;
    tags?: readonly string[];
    revision: string;
  } = { revision };
  const inputSchema = recordOf(record['inputSchema']);
  if (inputSchema) entry.inputSchema = inputSchema;
  const outputSchema = recordOf(record['outputSchema']);
  if (outputSchema) entry.outputSchema = outputSchema;
  if (typeof record['description'] === 'string') entry.description = record['description'];
  const tags = stringArrayOf(record['tags']);
  if (tags) entry.tags = tags;
  return entry;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) record[key] = nested;
  return record;
}

function stringArrayOf(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}

function isWorkflowRevisionManifestLike(value: unknown): value is WorkflowRevisionManifestLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Object.entries(value).find(([key]) => key === 'name')?.[1] === 'string' &&
    typeof Object.entries(value).find(([key]) => key === 'revision')?.[1] === 'string' &&
    'contract' in value
  );
}

/**
 * Narrows the registry's opaque `workflows`/`activeRevisions` fields into
 * `Record<name, RegistryWorkflowEntry>`, keeping only each name's currently
 * active manifest's `.contract` and dropping anything malformed (defensive
 * — the server always sends the documented shape here).
 *
 * Built on `Object.create(null)`: a workflow literally named `__proto__` is
 * grammar-valid and must be stored as an own property, not silently
 * dropped by the language's `obj['__proto__'] = value` prototype-mutation
 * special case (see `core/registry-snapshot.ts`'s identical rationale).
 */
export function narrowRegistryWorkflows(
  workflows: unknown,
  activeRevisions: unknown,
): Record<string, RegistryWorkflowEntry> {
  if (!Array.isArray(workflows)) return {};
  if (typeof activeRevisions !== 'object' || activeRevisions === null) return {};
  const activeEntries = Object.entries(activeRevisions);
  const result: Record<string, RegistryWorkflowEntry> = Object.setPrototypeOf({}, null);
  for (const manifest of workflows) {
    if (!isWorkflowRevisionManifestLike(manifest)) continue;
    const activeRevision = activeEntries.find(([name]) => name === manifest.name)?.[1];
    if (activeRevision !== manifest.revision) continue;
    const entry = toRegistryWorkflowEntry(manifest.contract, manifest.revision);
    if (entry === undefined) continue;
    result[manifest.name] = entry;
  }
  return result;
}
