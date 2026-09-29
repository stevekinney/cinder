/**
 * Correctness checks for pathological Markdown documents.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * These assertions were split out of performance.test.ts: the wall-clock
 * budgets that used to sit alongside them are non-deterministic under
 * machine load and now live in
 * `../scripts/benchmarks/performance.bench.ts`, run on demand via
 * `bun run test:benchmarks`. This file keeps the correctness assertion
 * (`result.passes`) that must run in the default suite.
 */

import { describe, expect, it } from 'bun:test';
import { roundTrip } from './pipeline/index.js';

describe('performance: pathological cases (correctness)', () => {
  it('round-trips a document with 1000 list items', () => {
    const items = Array.from({ length: 1000 }, (_, i) => `- Item ${i + 1}`).join('\n');
    const doc = `# Large List\n\n${items}`;

    const result = roundTrip(doc);

    expect(result.passes).toBe(true);
  });

  it('round-trips a document with 100 tables', () => {
    const tables = Array.from(
      { length: 100 },
      (_, i) => `### Table ${i + 1}\n\n| A | B |\n|---|---|\n| ${i} | ${i + 1} |`,
    ).join('\n\n');
    const doc = `# Many Tables\n\n${tables}`;

    const result = roundTrip(doc);

    expect(result.passes).toBe(true);
  });

  it('round-trips deeply nested blockquotes', () => {
    // Create 20 levels of nesting
    const quotes = Array.from(
      { length: 20 },
      (_, i) => '>'.repeat(i + 1) + ' Level ' + (i + 1),
    ).join('\n');
    const doc = `# Nested Quotes\n\n${quotes}`;

    const result = roundTrip(doc);

    expect(result.passes).toBe(true);
  });

  it('round-trips a very long single paragraph', () => {
    const longPara = 'Word '.repeat(5000);
    const doc = `# Long Paragraph\n\n${longPara}`;

    const result = roundTrip(doc);

    expect(result.passes).toBe(true);
  });
});
