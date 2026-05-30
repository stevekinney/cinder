/**
 * Example metadata extraction for `.example.svelte` files.
 *
 * Every page title and description shown in the playground is sourced from the
 * `export const title = '…'` / `export const description = '…'` declarations in
 * an example file's module script. This module owns the regex-based extraction
 * so `server.ts` has a single, testable source of truth — the pure string
 * parser is separated from the file read so it can be unit-tested without
 * touching the filesystem.
 */

/** Parsed metadata for a single example file. */
export type ExampleMetadata = {
  /** Display title; falls back to `'Untitled'` when no `title` export exists. */
  title: string;
  /** Optional description; omitted entirely when no `description` export exists. */
  description?: string;
};

// Named group `quote` = the surrounding quote (one of `'`, `"`, `` ` ``);
// named group `body` = the string body. The body matches anything that's not a
// backslash-escape, and `\\.` consumes any escaped character so the matching
// close-quote isn't confused by an escaped quote inside the literal. The
// backreference `\k<quote>` enforces a same-quote close.
const STRING_PATTERN = /(?<quote>['"`])(?<body>(?:[^\\]|\\.)*?)\k<quote>/.source;

const TITLE_PATTERN = new RegExp(`export\\s+const\\s+title\\s*=\\s*${STRING_PATTERN}`);
const DESCRIPTION_PATTERN = new RegExp(
  `export\\s+const\\s+description\\s*=\\s*${STRING_PATTERN}`,
);

/**
 * Extract title/description from example source text via regex. Pure — no I/O.
 *
 * Supports single-quoted, double-quoted, and template-literal (backtick)
 * strings. The matched body is run through {@link unescapeStringLiteral} so
 * escape sequences like `\n`, `\'`, and `\\` render correctly. Template
 * literals with `${...}` interpolations are intentionally not supported —
 * example metadata is a static label, not a computed expression.
 *
 * A missing `title` export falls back to `'Untitled'` rather than throwing; a
 * missing `description` export is omitted from the result entirely (never set
 * to an empty string).
 */
export function extractExampleMetadataFromSource(source: string): ExampleMetadata {
  const titleMatch = source.match(TITLE_PATTERN);
  const descriptionMatch = source.match(DESCRIPTION_PATTERN);
  const meta: ExampleMetadata = {
    title: titleMatch ? unescapeStringLiteral(titleMatch.groups?.['body'] ?? '') : 'Untitled',
  };
  const descriptionBody = descriptionMatch?.groups?.['body'];
  if (descriptionBody !== undefined) {
    meta.description = unescapeStringLiteral(descriptionBody);
  }
  return meta;
}

/**
 * Read an example file and extract its title/description metadata. Thin I/O
 * wrapper around {@link extractExampleMetadataFromSource}.
 *
 * Warns once per read when the file is missing a `title` export and the title
 * therefore falls back to `'Untitled'`, so authors get a nudge to add one
 * without the dev server failing. The build-time `validate-playground.ts` check
 * is the hard gate; this is the soft runtime signal.
 */
export async function readExampleMetadata(filePath: string): Promise<ExampleMetadata> {
  const source = await Bun.file(filePath).text();
  const meta = extractExampleMetadataFromSource(source);
  if (meta.title === 'Untitled') {
    console.warn(`[playground] example missing title: ${filePath}`);
  }
  return meta;
}

/** Resolve common JavaScript string escape sequences in a captured literal body. */
export function unescapeStringLiteral(raw: string): string {
  return raw.replace(/\\(.)/g, (_match, char: string) => {
    switch (char) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '\\':
        return '\\';
      case "'":
        return "'";
      case '"':
        return '"';
      case '`':
        return '`';
      default:
        return char;
    }
  });
}
