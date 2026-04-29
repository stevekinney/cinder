/**
 * Performance benchmarks for the Markdown pipeline.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * These tests verify that parsing and serialization meet performance
 * requirements. They are SKIPPED in CI because:
 * 1. CI runners have variable performance (2-10x slower than local)
 * 2. Absolute timing thresholds don't work across environments
 * 3. These are benchmarks, not correctness tests
 *
 * Run locally with: bun run test src/lib/document/performance.test.ts
 * For proper benchmarking, consider using `vitest bench` instead.
 */

import { describe, expect, it } from 'bun:test';
import { parse, parseOrThrow, roundTrip, serialize } from './pipeline/index.js';

// Skip performance tests in CI - they're benchmarks, not correctness tests
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const describeUnlessCI = isCI ? describe.skip : describe;

/**
 * Generate a Markdown document of approximately the specified size.
 *
 * @param targetBytes - Target document size in bytes
 * @returns Markdown string of approximately the target size
 */
function generateDocument(targetBytes: number): string {
  const sections: string[] = [];
  let currentSize = 0;

  // Build up document with varied content
  let sectionNumber = 1;
  while (currentSize < targetBytes) {
    // Add a heading
    const heading = `## Section ${sectionNumber}\n\n`;
    sections.push(heading);
    currentSize += heading.length;

    // Add a paragraph with inline formatting
    const para = `This is paragraph ${sectionNumber} with *emphasis* and **strong** text, plus some \`inline code\`. Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n`;
    sections.push(para);
    currentSize += para.length;

    // Add a list every 3rd section
    if (sectionNumber % 3 === 0) {
      const list = `- Item one\n- Item two with *emphasis*\n- Item three with \`code\`\n\n`;
      sections.push(list);
      currentSize += list.length;
    }

    // Add a code block every 4th section
    if (sectionNumber % 4 === 0) {
      const code = `\`\`\`javascript
const section${sectionNumber} = {
  id: ${sectionNumber},
  name: "Section ${sectionNumber}",
  active: true,
};
\`\`\`\n\n`;
      sections.push(code);
      currentSize += code.length;
    }

    // Add a table every 5th section
    if (sectionNumber % 5 === 0) {
      const table = `| Column A | Column B | Column C |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
| Value 4  | Value 5  | Value 6  |\n\n`;
      sections.push(table);
      currentSize += table.length;
    }

    // Add a blockquote every 6th section
    if (sectionNumber % 6 === 0) {
      const quote = `> This is a blockquote for section ${sectionNumber}.\n> It spans multiple lines.\n\n`;
      sections.push(quote);
      currentSize += quote.length;
    }

    // Add a task list every 7th section
    if (sectionNumber % 7 === 0) {
      const tasks = `- [x] Completed task ${sectionNumber}\n- [ ] Pending task ${sectionNumber}\n\n`;
      sections.push(tasks);
      currentSize += tasks.length;
    }

    sectionNumber++;
  }

  return '# Performance Test Document\n\n' + sections.join('');
}

describeUnlessCI('performance: parsing', () => {
  it('parses 1KB document in <10ms', () => {
    const doc = generateDocument(1_000);
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      parse(doc);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(10);
  });

  it('parses 5KB document in <25ms', () => {
    const doc = generateDocument(5_000);
    const iterations = 5;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      parse(doc);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(25);
  });

  it('parses 20KB document in <50ms', () => {
    const doc = generateDocument(20_000);
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      parse(doc);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(50);
  });

  it('parses 50KB document in <100ms', () => {
    const doc = generateDocument(50_000);
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      parse(doc);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(100);
  });
});

describeUnlessCI('performance: serialization', () => {
  it('serializes 1KB document in <10ms', () => {
    const doc = generateDocument(1_000);
    const ast = parseOrThrow(doc);
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      serialize(ast);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(10);
  });

  it('serializes 5KB document in <25ms', () => {
    const doc = generateDocument(5_000);
    const ast = parseOrThrow(doc);
    const iterations = 5;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      serialize(ast);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(25);
  });

  it('serializes 20KB document in <50ms', () => {
    const doc = generateDocument(20_000);
    const ast = parseOrThrow(doc);
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      serialize(ast);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(50);
  });

  it('serializes 50KB document in <100ms', () => {
    const doc = generateDocument(50_000);
    const ast = parseOrThrow(doc);
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      serialize(ast);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(100);
  });
});

describeUnlessCI('performance: round-trip', () => {
  it('round-trips 5KB document in <50ms', () => {
    const doc = generateDocument(5_000);
    const iterations = 5;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      roundTrip(doc);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(50);
  });

  it('round-trips 20KB document in <100ms', () => {
    const doc = generateDocument(20_000);
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      roundTrip(doc);
      times.push(performance.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(100);
  });
});

describeUnlessCI('performance: concurrent operations', () => {
  it('handles multiple sequential parses efficiently', () => {
    const docs = Array.from({ length: 10 }, (_, i) => generateDocument(2_000 + i * 500));

    const start = performance.now();
    for (const doc of docs) {
      parse(doc);
    }
    const totalTime = performance.now() - start;

    // 10 documents should complete in reasonable time
    expect(totalTime).toBeLessThan(200);
  });

  it('handles alternating parse/serialize efficiently', () => {
    const doc = generateDocument(5_000);
    const iterations = 20;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const ast = parseOrThrow(doc);
      serialize(ast);
    }
    const totalTime = performance.now() - start;

    // 20 parse+serialize cycles should complete in reasonable time
    expect(totalTime).toBeLessThan(500);
  });
});

describeUnlessCI('performance: memory efficiency', () => {
  it('does not leak significant memory on repeated parsing', () => {
    const doc = generateDocument(10_000);

    // Warm up
    parse(doc);

    // Detect runtime capabilities
    const hasProcess = typeof process !== 'undefined' && typeof process.memoryUsage === 'function';
    const hasGC =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as unknown as { gc?: () => void }).gc === 'function';

    // If we can't reliably measure memory, just exercise the code path and exit.
    if (!hasProcess) {
      for (let i = 0; i < 100; i++) {
        parse(doc);
      }
      return;
    }

    // Encourage GC before taking the initial measurement (Node.js with --expose-gc).
    if (hasGC) {
      (globalThis as unknown as { gc: () => void }).gc();
    }

    // Capture initial memory
    const initialHeap = process.memoryUsage().heapUsed;

    // Parse many times
    for (let i = 0; i < 100; i++) {
      parse(doc);
    }

    // Encourage GC again before taking the final measurement.
    if (hasGC) {
      (globalThis as unknown as { gc: () => void }).gc();
    }

    // Check final memory
    const finalHeap = process.memoryUsage().heapUsed;

    // Memory growth should be bounded.
    // Note: This check is only meaningful when running in Node.js with --expose-gc;
    // GC behavior and heap sizing can still introduce some noise.
    const growth = finalHeap - initialHeap;
    // Allow up to 50MB growth (generous to account for GC timing and allocator behavior)
    expect(growth).toBeLessThan(50_000_000);
  });
});

describeUnlessCI('performance: pathological cases', () => {
  it('handles document with 1000 list items efficiently', () => {
    const items = Array.from({ length: 1000 }, (_, i) => `- Item ${i + 1}`).join('\n');
    const doc = `# Large List\n\n${items}`;

    const start = performance.now();
    const result = roundTrip(doc);
    const elapsed = performance.now() - start;

    expect(result.passes).toBe(true);
    expect(elapsed).toBeLessThan(200);
  });

  it('handles document with 100 tables efficiently', () => {
    const tables = Array.from(
      { length: 100 },
      (_, i) => `### Table ${i + 1}\n\n| A | B |\n|---|---|\n| ${i} | ${i + 1} |`,
    ).join('\n\n');
    const doc = `# Many Tables\n\n${tables}`;

    const start = performance.now();
    const result = roundTrip(doc);
    const elapsed = performance.now() - start;

    expect(result.passes).toBe(true);
    expect(elapsed).toBeLessThan(300);
  });

  it('handles deeply nested blockquotes efficiently', () => {
    // Create 20 levels of nesting
    const quotes = Array.from(
      { length: 20 },
      (_, i) => '>'.repeat(i + 1) + ' Level ' + (i + 1),
    ).join('\n');
    const doc = `# Nested Quotes\n\n${quotes}`;

    const start = performance.now();
    const result = roundTrip(doc);
    const elapsed = performance.now() - start;

    expect(result.passes).toBe(true);
    expect(elapsed).toBeLessThan(50);
  });

  it('handles very long single paragraph efficiently', () => {
    const longPara = 'Word '.repeat(5000);
    const doc = `# Long Paragraph\n\n${longPara}`;

    const start = performance.now();
    const result = roundTrip(doc);
    const elapsed = performance.now() - start;

    expect(result.passes).toBe(true);
    expect(elapsed).toBeLessThan(100);
  });
});
