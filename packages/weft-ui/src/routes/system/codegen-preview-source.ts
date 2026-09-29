/**
 * Picks the codegen-preview source workflow for the Health & lease tab's
 * codegen panel (plan §9.7 T7.5) — the first *active* registered workflow
 * (codepoint order, for determinism) that has an `inputSchema`, so the
 * preview always shows something concrete rather than an arbitrary/empty
 * one when the registry has a mix of typed and untyped definitions.
 */
import { inputInterfaceName, previewInterface } from './codegen-preview.ts';
import type { RegistrySnapshotSource } from './registry-view.ts';

export type RegistryLike = RegistrySnapshotSource;

function compareCodepoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Renders a codegen preview for the first (codepoint-sorted) active workflow with an input schema, or `undefined` if none has one. */
export function codegenPreviewSource(registry: RegistryLike): string | undefined {
  const withSchema = registry.workflows
    .filter((manifest) => registry.activeRevisions[manifest.name] === manifest.revision)
    .filter((manifest) => manifest.contract.inputSchema !== undefined)
    .toSorted((a, b) => compareCodepoint(a.name, b.name));

  const first = withSchema[0];
  if (!first) return undefined;

  return previewInterface(inputInterfaceName(first.name), first.contract.inputSchema);
}
