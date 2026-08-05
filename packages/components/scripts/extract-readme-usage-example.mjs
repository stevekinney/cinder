/**
 * Pure extraction/matching logic for `02-readme-compile-gate`.
 *
 * Plain JavaScript (no TypeScript syntax) so it can be `import`ed directly by
 * a Node-run `.mjs` script — `fixtures/typescript-consumer/generate-readme-usage-examples.mjs`
 * runs under plain `node`, matching `generate-probe.mjs`'s existing constraint
 * of simulating a real, Bun-free npm consumer, so anything it imports must
 * also run under plain Node with no TypeScript transpilation step.
 */

/**
 * Extracts the first fenced code block under a README's `## Usage` heading.
 *
 * Grammar: find the first line matching `/^## Usage\s*$/m`. If no such line
 * exists, fail with `'no-heading'`. Otherwise scan forward, skipping blank
 * and prose lines, until either a `/^## /` heading (or end of text) is
 * reached before any fence-opener line — fail with `'no-fence'` — or a
 * fence-opener line (`` /^```(\S*)\s*$/ ``) is found. That is the first fence
 * under the heading and the only one ever considered, regardless of its tag:
 * if the tag isn't exactly `svelte`, fail with `'no-fence'` immediately (do
 * not keep scanning for a later ```` ```svelte ```` fence). If the tag is
 * exactly `svelte`, scan forward to the next `` /^```\s*$/ `` line and return
 * everything between the two fence lines (exclusive) as `code`.
 *
 * @param {string} readmeText
 * @returns {{ code: string } | { error: 'no-heading' | 'no-fence' }}
 */
export function extractUsageFence(readmeText) {
  const lines = readmeText.split('\n');
  const headingIndex = lines.findIndex((line) => /^## Usage\s*$/.test(line));
  if (headingIndex === -1) return { error: 'no-heading' };

  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) return { error: 'no-fence' };

    const fenceOpenMatch = /^```(\S*)\s*$/.exec(line);
    if (!fenceOpenMatch) continue;

    const tag = fenceOpenMatch[1];
    if (tag !== 'svelte') return { error: 'no-fence' };

    const closeIndex = lines.findIndex(
      (candidate, index) => index > i && /^```\s*$/.test(candidate),
    );
    if (closeIndex === -1) return { error: 'no-fence' };

    return { code: lines.slice(i + 1, closeIndex).join('\n') };
  }

  return { error: 'no-fence' };
}

/**
 * Checks whether `code` renders the component's own tag: a literal `<`, the
 * component's PascalCase name, then a word boundary. `\b` is what keeps this
 * from over-matching — `<AlertDialog\b` matches `<AlertDialog ` / `>` / `/>`
 * but not `<AlertDialogExtra` (no boundary between `g` and `E`). A fence that
 * only imports the component but never renders its tag fails this check.
 *
 * @param {string} code
 * @param {string} pascalName
 * @returns {boolean}
 */
export function matchesComponentTag(code, pascalName) {
  return new RegExp(`<${pascalName}\\b`).test(code);
}
