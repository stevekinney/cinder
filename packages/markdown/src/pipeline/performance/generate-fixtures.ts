/**
 * Fixture generator for performance tests.
 * DEP-47: Creates markdown documents of various sizes for benchmarking.
 */

/**
 * Generate a markdown document of approximately the specified size in bytes.
 */
export function generateDocument(targetSizeBytes: number): string {
  const parts: string[] = [];
  let currentSize = 0;
  let sectionNumber = 0;

  // Header
  const header = '# Performance Test Document\n\nGenerated for diff computation benchmarking.\n\n';
  parts.push(header);
  currentSize += header.length;

  while (currentSize < targetSizeBytes) {
    sectionNumber++;

    // Generate section with varied content
    const section = generateSection(sectionNumber);
    parts.push(section);
    currentSize += section.length;
  }

  return parts.join('');
}

/**
 * Generate a section with heading, paragraphs, code, and lists.
 */
function generateSection(num: number): string {
  const lines: string[] = [];

  // Heading
  lines.push(`## Section ${num}\n`);

  // Paragraph
  lines.push(
    `This is section ${num} of the test document. It contains various markdown elements ` +
      `to simulate real-world content. Lorem ipsum dolor sit amet, consectetur adipiscing ` +
      `elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n`,
  );

  // Code block (every 3rd section)
  if (num % 3 === 0) {
    lines.push('```typescript');
    lines.push(`function processSection${num}(data: unknown) {`);
    lines.push(`  console.log('Processing section ${num}');`);
    lines.push('  return data;');
    lines.push('}');
    lines.push('```\n');
  }

  // List (every 2nd section)
  if (num % 2 === 0) {
    lines.push(`- Item ${num}.1: First list item`);
    lines.push(`- Item ${num}.2: Second list item`);
    lines.push(`- Item ${num}.3: Third list item\n`);
  }

  // Table (every 5th section)
  if (num % 5 === 0) {
    lines.push('| Column A | Column B | Column C |');
    lines.push('|----------|----------|----------|');
    lines.push(`| Value ${num} | ${num * 2} | ${num * 3} |`);
    lines.push(`| Data ${num + 1} | ${(num + 1) * 2} | ${(num + 1) * 3} |\n`);
  }

  // Blockquote (every 7th section)
  if (num % 7 === 0) {
    lines.push(`> This is a blockquote in section ${num}.`);
    lines.push(`> It spans multiple lines for testing purposes.\n`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate a modified version of a document with specified change percentage.
 */
export function generateModifiedDocument(original: string, changePercentage: number): string {
  const lines = original.split('\n');
  const numLinesToChange = Math.floor(lines.length * (changePercentage / 100));

  // Determine which lines to modify (spread evenly)
  const interval = Math.max(1, Math.floor(lines.length / numLinesToChange));

  const modified = lines.map((line, index) => {
    if (index % interval === 0 && line.trim().length > 0) {
      // Modify this line
      if (line.startsWith('#')) {
        return line + ' (Modified)';
      } else if (line.startsWith('-')) {
        return line + ' [Updated]';
      } else if (line.startsWith('|')) {
        return line; // Don't break tables
      } else if (line.trim().length > 10) {
        return line + ' CHANGED';
      }
    }
    return line;
  });

  // Add some new sections
  const addedSections = Math.floor(changePercentage / 10);
  for (let i = 0; i < addedSections; i++) {
    modified.push(`\n## New Section ${i + 1} (Added)\n`);
    modified.push(`This section was added during modification.\n`);
  }

  return modified.join('\n');
}

/**
 * Standard test fixtures with predefined sizes.
 */
export const FIXTURES = {
  /** ~5KB document */
  tiny: () => generateDocument(5 * 1024),

  /** ~20KB document - threshold for real-time */
  small: () => generateDocument(20 * 1024),

  /** ~60KB document - middle tier */
  medium: () => generateDocument(60 * 1024),

  /** ~100KB document - threshold for manual */
  large: () => generateDocument(100 * 1024),

  /** ~200KB document - beyond threshold */
  huge: () => generateDocument(200 * 1024),

  /** Identical documents for fast-path testing */
  identical: () => {
    const doc = generateDocument(20 * 1024);
    return { original: doc, current: doc };
  },

  /** Documents with 10% changes */
  tenPercentChange: () => {
    const original = generateDocument(20 * 1024);
    return {
      original,
      current: generateModifiedDocument(original, 10),
    };
  },

  /** Documents with 30% changes */
  thirtyPercentChange: () => {
    const original = generateDocument(60 * 1024);
    return {
      original,
      current: generateModifiedDocument(original, 30),
    };
  },
};
