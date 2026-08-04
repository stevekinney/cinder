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

/** Whether the inventory rationale guard owns this discovered component. */
export function isCanonicalInventoryComponent(
  component: Pick<DiscoveredComponent, 'isExperimental'>,
): boolean {
  return !component.isExperimental;
}

const MODULE_SCRIPT_REGEX =
  /<script\b(?:[^>]*\bmodule\b[^>]*|[^>]*\bcontext\s*=\s*["']module["'][^>]*)>([\s\S]*?)<\/script>/gi;

function findCinderMetadataBlock(source: string): string {
  for (const moduleMatch of source.matchAll(MODULE_SCRIPT_REGEX)) {
    const moduleSource = moduleMatch[1] ?? '';
    for (const jsdocMatch of moduleSource.matchAll(/\/\*\*([\s\S]*?)\*\//g)) {
      const block = jsdocMatch[1] ?? '';
      if (/^\s*(?:\*\s*)?@cinder\b/m.test(block)) return block;
    }
  }
  return '';
}

function findExplicitRationale(source: string): string {
  const metadataBlock = findCinderMetadataBlock(source);
  const rationaleLines: string[] = [];
  let collecting = false;
  let sawCinderMarker = false;
  for (const line of metadataBlock.split('\n')) {
    const content = line.replace(/^\s*\*\s?/, '').trim();
    if (/^@cinder\b/.test(content)) {
      sawCinderMarker = true;
      continue;
    }
    if (!sawCinderMarker) continue;
    if (/^@rationale\b/i.test(content)) {
      rationaleLines.push(content.replace(/^@rationale\s*/i, '').trim());
      collecting = true;
    } else if (collecting && /^@\S+/.test(content)) {
      break;
    } else if (collecting && content) {
      rationaleLines.push(content);
    }
  }
  return rationaleLines.join(' ').trim();
}

function findNamedAlternative(rationale: string): string | null {
  const patterns = [
    /\b(?:nearest|closest)\s+alternative\s*:\s*[*_`]*([a-z][a-z0-9-]*)\b/i,
    /\b(?:nearest|closest)\s+alternative\s+(?:is|would be)\s+[*_`]*([a-z][a-z0-9-]*)\b/i,
    /\|\s*[*_`]*([a-z][a-z0-9-]*)\b/i,
  ];
  for (const pattern of patterns) {
    const alternative = rationale.match(pattern)?.[1]?.toLowerCase();
    if (alternative) return alternative;
  }
  return null;
}

/** Return violations for one authored component metadata block. */
export function findNeighbourRationaleViolations(
  entry: InventoryEntry,
  knownComponentIds: ReadonlySet<string> = new Set(),
): InventoryViolation[] {
  const hasRelatedAndAvoidWhen =
    entry.related.some((relatedId) => relatedId !== entry.id) && entry.avoidWhen.length > 0;
  const namedAlternative = findNamedAlternative(findExplicitRationale(entry.source));
  const hasExplicitRationale =
    namedAlternative !== null &&
    namedAlternative !== entry.id &&
    knownComponentIds.has(namedAlternative);

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
  const components = await discoverComponentDirectories();
  const knownComponentIds = new Set(components.map((component) => component.name));
  for (const component of components) {
    if (!isCanonicalInventoryComponent(component)) continue;
    const entry = await readInventoryEntry(component);
    if ('reason' in entry) {
      violations.push(entry);
      continue;
    }
    violations.push(...findNeighbourRationaleViolations(entry, knownComponentIds));
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
