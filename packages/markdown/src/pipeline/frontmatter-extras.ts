import { parseFrontMatter } from './frontmatter.js';

/** Extract front matter and body as a tuple. */
export function extractFrontMatter(
  markdown: string,
): [Record<string, unknown> | null, string | null, string] {
  const result = parseFrontMatter(markdown);
  return [result.data, result.raw, result.body];
}

/** Check whether a Markdown document contains recognized front matter. */
export function hasFrontMatter(markdown: string): boolean {
  return parseFrontMatter(markdown).hasFrontMatter;
}

/** Merge front matter values, deleting keys whose update is undefined. */
export function mergeFrontMatter(
  existing: Record<string, unknown> | null,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) delete result[key];
    else result[key] = value;
  }
  return result;
}
