import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { axeJsonPath, type ArtifactKey } from './artifact-path.ts';

export type AxeImpact = 'critical' | 'serious' | 'moderate' | 'minor';
export type AxeViolation = {
  id: string;
  impact: AxeImpact;
  help: string;
  helpUrl: string;
  description: string;
  tags: string[];
  nodes: Array<{ target: Array<string | string[]>; html: string; failureSummary?: string }>;
};
export type AxeBuckets = Record<AxeImpact, AxeViolation[]>;

const VALID_IMPACTS = new Set<string>(['critical', 'serious', 'moderate', 'minor']);

function isAxeImpact(value: string | null | undefined): value is AxeImpact {
  return value !== null && value !== undefined && VALID_IMPACTS.has(value);
}

const EMPTY_BUCKETS = (): AxeBuckets => ({ critical: [], serious: [], moderate: [], minor: [] });

export async function runAxe(page: Page, key: ArtifactKey): Promise<AxeBuckets> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const buckets = EMPTY_BUCKETS();
  for (const v of result.violations) {
    if (!isAxeImpact(v.impact)) continue;
    buckets[v.impact].push({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      description: v.description,
      tags: v.tags,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        html: n.html,
        ...(n.failureSummary !== undefined ? { failureSummary: n.failureSummary } : {}),
      })),
    });
  }

  const path = axeJsonPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        key,
        url: result.url,
        timestamp: result.timestamp,
        testEngine: result.testEngine,
        testRunner: result.testRunner,
        buckets,
        totals: {
          critical: buckets.critical.length,
          serious: buckets.serious.length,
          moderate: buckets.moderate.length,
          minor: buckets.minor.length,
        },
      },
      null,
      2,
    ),
  );

  return buckets;
}
