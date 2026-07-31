/**
 * Enforces a written neighbour rationale for every canonical component.
 *
 * This guard validates authored metadata only. It deliberately does not try to
 * infer whether two components should be consolidated.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  discoverComponentDirectories,
  type DiscoveredComponent,
} from './discover-component-directories.ts';
import { extractFromSource, type AvoidWhenEntry } from './generate-component-metadata.ts';

export type InventoryEntry = {
  id: string;
  related: readonly string[];
  avoidWhen: readonly AvoidWhenEntry[];
  source: string;
};

export type InventoryViolation = {
  id: string;
  reason: string;
};

/** Return violations for one authored component metadata block. */
export function findNeighbourRationaleViolations(entry: InventoryEntry): InventoryViolation[] {
  const hasRelatedAndAvoidWhen = entry.related.length > 0 && entry.avoidWhen.length > 0;
  const rationale = entry.source.match(/@rationale\s+([^\n*]+)/i)?.[1]?.trim() ?? '';
  const hasExplicitRationale =
    rationale.length > 0 &&
    (/\bnearest\s+alternative\b/i.test(rationale) ||
      /\bclosest\s+alternative\b/i.test(rationale) ||
      /\|\s*[a-z][a-z0-9-]*\b/.test(rationale));

  if (hasRelatedAndAvoidWhen || hasExplicitRationale) return [];
  return [
    {
      id: entry.id,
      reason:
        'component metadata must provide @related and @avoidWhen, or an explicit @rationale naming the nearest alternative',
    },
  ];
}

async function readInventoryEntry(
  component: DiscoveredComponent,
): Promise<InventoryEntry | InventoryViolation> {
  const sourcePath = join(component.directory, `${component.name}.svelte`);
  const source = await readFile(sourcePath, 'utf8');
  const result = extractFromSource(source, component.name, sourcePath, component.isExperimental);
  if (!result.ok) return { id: component.name, reason: result.error.reason };
  return {
    id: component.name,
    related: result.metadata.related,
    avoidWhen: result.metadata.avoidWhen,
    source,
  };
}

export async function checkComponentInventory(): Promise<InventoryViolation[]> {
  const violations: InventoryViolation[] = [];
  for (const component of await discoverComponentDirectories()) {
    const entry = await readInventoryEntry(component);
    if ('reason' in entry) {
      violations.push(entry);
      continue;
    }
    violations.push(...findNeighbourRationaleViolations(entry));
  }
  return violations;
}

if (import.meta.main) {
  const violations = await checkComponentInventory();
  if (violations.length > 0) {
    console.error(`Component inventory neighbour rationale check failed (${violations.length}):`);
    for (const violation of violations) console.error(`- ${violation.id}: ${violation.reason}`);
    process.exit(1);
  }
  console.log('Component inventory neighbour rationale check passed.');
}
