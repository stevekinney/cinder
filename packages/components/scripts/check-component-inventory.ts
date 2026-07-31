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

const MODULE_SCRIPT_REGEX =
  /<script\b(?:[^>]*\bmodule\b[^>]*|[^>]*\bcontext\s*=\s*["']module["'][^>]*)>([\s\S]*?)<\/script>/gi;

function findCinderMetadataBlock(source: string): string {
  for (const moduleMatch of source.matchAll(MODULE_SCRIPT_REGEX)) {
    const moduleSource = moduleMatch[1] ?? '';
    for (const jsdocMatch of moduleSource.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
      const block = jsdocMatch[1] ?? '';
      if (/^\s*\*\s*@cinder\b/im.test(block)) return block;
    }
  }
  return '';
}

function findExplicitRationale(source: string): string {
  const metadataBlock = findCinderMetadataBlock(source);
  return metadataBlock.match(/^\s*\*\s*@rationale\s+(.+?)\s*$/im)?.[1]?.trim() ?? '';
}

/** Return violations for one authored component metadata block. */
export function findNeighbourRationaleViolations(entry: InventoryEntry): InventoryViolation[] {
  const hasRelatedAndAvoidWhen = entry.related.length > 0 && entry.avoidWhen.length > 0;
  const rationale = findExplicitRationale(entry.source);
  const namedMarker = rationale
    .match(/\b(?:nearest|closest)\s+alternative\s*:\s*(.+)$/i)?.[1]
    ?.trim();
  const namedPipeAlternative = rationale.match(/\|\s*([a-z][a-z0-9-]*)\b/)?.[1];
  const hasExplicitRationale = Boolean(namedMarker || namedPipeAlternative);

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
