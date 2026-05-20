/**
 * Taxonomy gate for the cinder AI-agent legibility work (Phase 1).
 *
 * This test gates merge to `main`. It enforces the metadata taxonomy defined
 * in `manifest.meta.ts` and the parts of the binary acceptance criteria that
 * can be checked from component metadata alone (criteria 1–4 in the plan).
 *
 * During the pilot phase most components lack `@cinder` JSDoc annotations.
 * The suite detects that, reports the first 10 extraction errors, and skips
 * downstream checks to keep failure output tractable.
 */

import { beforeAll, describe, expect, test } from 'bun:test';

import type { ComponentMetadata, ExtractError } from '../scripts/generate-component-metadata.ts';
import { extractAllComponentMetadata } from '../scripts/generate-component-metadata.ts';
import { discoverDirectoryComponents } from '../scripts/generate-exports.ts';
import { categories, overlapFamilies, requiredConstraints, statusLevels } from './manifest.meta.ts';

// State populated in beforeAll — shared across all describe blocks.
let allMetadata: ComponentMetadata[] = [];
let allErrors: ExtractError[] = [];
let discoveredIds: Set<string> = new Set();
/** True when extraction errors exist; downstream checks are skipped to avoid noise. */
let hasExtractionErrors = false;

beforeAll(async () => {
  const [{ metadata, errors }, discovered] = await Promise.all([
    extractAllComponentMetadata(),
    discoverDirectoryComponents(),
  ]);
  allMetadata = metadata;
  allErrors = errors;
  discoveredIds = new Set(discovered.map((c) => c.name));
  hasExtractionErrors = errors.length > 0;
});

/** Format the first N extraction errors into a human-readable string. */
function formatErrors(errors: ExtractError[], limit: number): string {
  const lines = errors
    .slice(0, limit)
    .map((e) => `  [${e.componentId}] ${e.file}\n    reason: ${e.reason}`);
  if (errors.length > limit) lines.push(`  … and ${errors.length - limit} more errors`);
  return lines.join('\n');
}

const SKIP_MESSAGE = 'Skipping downstream checks until extraction errors are resolved.';

/** Skip-guard used at the top of every downstream test. */
function skipIfExtractionErrors(): boolean {
  if (hasExtractionErrors) {
    console.log(SKIP_MESSAGE);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 1. No extraction errors
// ---------------------------------------------------------------------------

describe('extraction', () => {
  test('all components extract without errors', () => {
    if (allErrors.length === 0) {
      expect(allErrors).toHaveLength(0);
      return;
    }
    const detail = formatErrors(allErrors, 10);
    const trailer = allErrors.length > 10 ? `\n${SKIP_MESSAGE}` : '';
    throw new Error(
      `${allErrors.length} component(s) failed metadata extraction:\n${detail}${trailer}`,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. All components enumerated
// ---------------------------------------------------------------------------

describe('enumeration', () => {
  test('no extras — extracted ids are all known to the enumerator', () => {
    if (skipIfExtractionErrors()) return;
    const extractedIds = new Set(allMetadata.map((m) => m.id));
    const extras = [...extractedIds].filter((id) => !discoveredIds.has(id));
    expect(extras).toEqual([]);
  });

  test('no missing — every discovered id was extracted', () => {
    if (skipIfExtractionErrors()) return;
    const extractedIds = new Set(allMetadata.map((m) => m.id));
    const missing = [...discoveredIds].filter((id) => !extractedIds.has(id));
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Category membership
// ---------------------------------------------------------------------------

describe('category membership', () => {
  test('every component category is in the closed set', () => {
    if (skipIfExtractionErrors()) return;
    const valid = new Set<string>(Object.keys(categories));
    const violations = allMetadata
      .filter((m) => !valid.has(m.category))
      .map((m) => `${m.id}: '${m.category}'`);
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Status membership
// ---------------------------------------------------------------------------

describe('status membership', () => {
  test('every component status is in the closed set', () => {
    if (skipIfExtractionErrors()) return;
    const valid = new Set<string>(Object.keys(statusLevels));
    const violations = allMetadata
      .filter((m) => !valid.has(m.status))
      .map((m) => `${m.id}: '${m.status}'`);
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5 & 6. Related ids — resolve and no PascalCase
// ---------------------------------------------------------------------------

describe('related ids', () => {
  test('every related id resolves to a known component', () => {
    if (skipIfExtractionErrors()) return;
    const violations: string[] = [];
    for (const meta of allMetadata) {
      for (const relatedId of meta.related) {
        if (!discoveredIds.has(relatedId)) {
          violations.push(`${meta.id} → '${relatedId}' (not a known component id)`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('no PascalCase ids appear in related arrays', () => {
    if (skipIfExtractionErrors()) return;
    const violations: string[] = [];
    for (const meta of allMetadata) {
      for (const relatedId of meta.related) {
        if (/[A-Z]/.test(relatedId)) {
          violations.push(`${meta.id} → '${relatedId}' (must be kebab-case)`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. No duplicate purpose strings
// ---------------------------------------------------------------------------

describe('purpose uniqueness', () => {
  test('no two components share the same purpose string', () => {
    if (skipIfExtractionErrors()) return;
    const seen = new Map<string, string>(); // normalised purpose → first component id
    const violations: string[] = [];
    for (const meta of allMetadata) {
      const normalised = meta.purpose.trim();
      const prior = seen.get(normalised);
      if (prior !== undefined) {
        violations.push(`'${meta.id}' and '${prior}' share the same purpose string`);
      } else {
        seen.set(normalised, meta.id);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. Overlap families well-formed
// ---------------------------------------------------------------------------

describe('overlap families', () => {
  test('every family has at least two members', () => {
    if (skipIfExtractionErrors()) return;
    const violations = Object.entries(overlapFamilies)
      .filter(([, members]) => members.length < 2)
      .map(([name]) => `family '${name}' has fewer than 2 members`);
    expect(violations).toEqual([]);
  });

  test('every family member id is a known component', () => {
    if (skipIfExtractionErrors()) return;
    const violations: string[] = [];
    for (const [familyName, members] of Object.entries(overlapFamilies)) {
      for (const memberId of members) {
        if (!discoveredIds.has(memberId)) {
          violations.push(`family '${familyName}': member '${memberId}' is not a known component`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('every family member mentions at least one sibling in useWhen or avoidWhen', () => {
    if (skipIfExtractionErrors()) return;
    const metadataById = new Map(allMetadata.map((m) => [m.id, m]));
    const violations: string[] = [];
    for (const [familyName, members] of Object.entries(overlapFamilies)) {
      for (const memberId of members) {
        const meta = metadataById.get(memberId);
        if (!meta) continue; // caught by the "known component" test above
        const siblings = members.filter((id) => id !== memberId);
        const guidance = [
          ...meta.useWhen.map((s) => s.toLowerCase()),
          ...meta.avoidWhen.map((s) => s.toLowerCase()),
        ].join(' ');
        const mentionsASibling = siblings.some((sibling) => guidance.includes(sibling));
        if (!mentionsASibling) {
          violations.push(
            `family '${familyName}': '${memberId}' does not mention any sibling ` +
              `(${siblings.join(', ')}) in useWhen or avoidWhen`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 9. Length budgets
// ---------------------------------------------------------------------------

describe('length budgets', () => {
  test('purpose does not exceed 200 characters', () => {
    if (skipIfExtractionErrors()) return;
    const violations = allMetadata
      .filter((m) => m.purpose.length > 200)
      .map((m) => `${m.id}: purpose is ${m.purpose.length} chars`);
    expect(violations).toEqual([]);
  });

  test('each useWhen entry does not exceed 140 characters', () => {
    if (skipIfExtractionErrors()) return;
    const violations: string[] = [];
    for (const meta of allMetadata) {
      for (const entry of meta.useWhen) {
        if (entry.length > 140) {
          violations.push(
            `${meta.id}: useWhen entry is ${entry.length} chars: "${entry.slice(0, 40)}…"`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('each avoidWhen entry does not exceed 140 characters', () => {
    if (skipIfExtractionErrors()) return;
    const violations: string[] = [];
    for (const meta of allMetadata) {
      for (const entry of meta.avoidWhen) {
        if (entry.length > 140) {
          violations.push(
            `${meta.id}: avoidWhen entry is ${entry.length} chars: "${entry.slice(0, 40)}…"`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. Per-entry manifest size budget (≤ 1024 bytes serialized)
// ---------------------------------------------------------------------------

describe('manifest size budget', () => {
  test('each component serializes to at most 1024 bytes', () => {
    if (skipIfExtractionErrors()) return;
    const violations: string[] = [];
    for (const meta of allMetadata) {
      const entry = {
        id: meta.id,
        category: meta.category,
        status: meta.status,
        purpose: meta.purpose,
        tags: meta.tags,
        useWhen: meta.useWhen,
        avoidWhen: meta.avoidWhen,
        related: meta.related,
        hasConstraints: false,
        hasExamples: false,
        artifacts: {},
      };
      const bytes = Buffer.byteLength(JSON.stringify(entry), 'utf8');
      if (bytes > 1024) {
        violations.push(`${meta.id}: serialized entry is ${bytes} bytes (limit 1024)`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 11. Required-constraints ids are valid (typo guard — sidecar check is Phase 4)
// ---------------------------------------------------------------------------

describe('required constraints', () => {
  test('every id in requiredConstraints is a known component', () => {
    // Runs even during the pilot phase: catches typos in manifest.meta.ts.
    // The "must ship a sidecar" check lives in Phase 4 work.
    const violations = requiredConstraints.filter((id) => !discoveredIds.has(id));
    expect(violations).toEqual([]);
  });
});
