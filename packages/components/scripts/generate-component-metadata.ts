/**
 * Extracts per-component metadata from the module-script JSDoc block in
 * `{componentDir}/{componentId}.svelte` files.
 *
 * Parsing strategy: regex-based (approach a from the plan spec).
 *
 * Rationale: the module `<script>` block is a well-defined surface — a single
 * regex extracts its text content, and standard JSDoc tag parsing handles the
 * rest. A ts-morph AST (approach b) would require converting the Svelte file
 * into a synthetic TypeScript source string first, adding complexity without
 * any benefit for what is ultimately just line-by-line tag extraction. Regex
 * is simpler, faster, and adequate for the well-structured JSDoc format.
 */

import { join } from 'node:path';

import type { CategoryId, StatusLevel } from '../src/manifest.meta.ts';
import { categories, statusLevels } from '../src/manifest.meta.ts';
import { discoverDirectoryComponents } from './generate-exports.ts';

export type { CategoryId, StatusLevel };

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

// Length caps for the free-text metadata fields. Kept internal (not exported):
// the manifest JSON schema is the published contract and pins the same numbers
// independently — these only shape the generator's error messages.
/** Maximum length of an `@avoidWhen` reason (matches the old flat-string budget). */
const AVOID_WHEN_REASON_MAX_LENGTH = 140;
/** Maximum length of an `@avoidWhen` `alternative` component id. */
const AVOID_WHEN_ALTERNATIVE_MAX_LENGTH = 64;
/** Maximum length of an `@useWhen` entry. */
const USE_WHEN_MAX_LENGTH = 140;
/** Maximum length of an `@a11yPattern` name. */
const A11Y_PATTERN_MAX_LENGTH = 80;
/** Maximum length of the keys / action half of a `@keyboardShortcut`. */
const KEYBOARD_SHORTCUT_HALF_MAX_LENGTH = 120;
/** Maximum length of an `@a11yNote` entry. */
const A11Y_NOTE_MAX_LENGTH = 280;

/**
 * One "avoid when" guidance entry: a reason not to use the component, plus an
 * optional kebab-case id of the component to reach for instead. Authored as
 * `@avoidWhen <reason> | <kebab-id>` (the alternative is optional).
 */
export type AvoidWhenEntry = {
  /** Why not to use this component in this situation. 1–140 characters. */
  reason: string;
  /** Kebab-case id of the component to use instead, when one applies. */
  alternative?: string;
};

/** One keyboard interaction: a key (or chord) and what it does. */
export type KeyboardShortcut = {
  /** Key or chord, e.g. `Enter / Space` or `Shift + Tab`. */
  keys: string;
  /** What the key does. */
  action: string;
};

/**
 * Accessibility metadata for a component, assembled from the optional
 * `@a11yPattern` / `@keyboardShortcut` / `@a11yNote` tags. Absent entirely when
 * none of those tags are present, so the field is always optional downstream.
 */
export type A11yMetadata = {
  /** WAI-ARIA pattern name this component implements, e.g. `WAI-ARIA Accordion`. */
  pattern?: string;
  /** Keyboard interactions, in author order. */
  keyboard?: KeyboardShortcut[];
  /** Free-form accessibility notes, in author order. */
  notes?: string[];
};

/** Validated metadata for one component, ready for the manifest generator. */
export type ComponentMetadata = {
  /** Kebab-case directory name — the canonical component identifier. */
  id: string;
  /** True when the component lives under `src/components/experimental/`. */
  isExperimental: boolean;
  /** Closed-vocabulary category from `manifest.meta.ts`. */
  category: CategoryId;
  /** Closed-vocabulary status level from `manifest.meta.ts`. */
  status: StatusLevel;
  /** One-sentence purpose description. 1–200 characters. */
  purpose: string;
  /** Free-form classification tags (zero or more single words). */
  tags: string[];
  /** Guidance on when to reach for this component (zero or more, each ≤ 140 chars). */
  useWhen: string[];
  /** Guidance on when NOT to use this component (zero or more entries). */
  avoidWhen: AvoidWhenEntry[];
  /** Kebab-case ids of related components (zero or more). */
  related: string[];
  /** Accessibility metadata, present only when a11y tags were authored. */
  a11y?: A11yMetadata;
};

/** A structured extraction failure for one component. */
export type ExtractError = {
  /** The component id being processed when the error occurred. */
  componentId: string;
  /** Absolute path to the `.svelte` file. */
  file: string;
  /** Human-readable description, including the offending text when relevant. */
  reason: string;
};

/** Discriminated union returned by `extractComponentMetadata`. */
export type ExtractResult =
  | { ok: true; metadata: ComponentMetadata }
  | { ok: false; error: ExtractError };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Matches any `<script>` block that carries the Svelte 5 `module` attribute or Svelte 4 `context="module"`. */
const MODULE_SCRIPT_REGEX =
  /<script\b(?:[^>]*\bmodule\b[^>]*|[^>]*\bcontext\s*=\s*["']module["'][^>]*)>([\s\S]*?)<\/script>/g;

/** Matches the first JSDoc block inside a string. */
const JSDOC_REGEX = /\/\*\*([\s\S]*?)\*\//;

/** Strips the leading ` * ` decoration from a single JSDoc source line. */
const JSDOC_LINE_PREFIX = /^\s*\*\s?/;

/**
 * Extract the text content of the `<script module>` block from Svelte source.
 * Returns `null` when zero or more than one such block is found.
 */
function extractModuleScriptContent(source: string): string | null {
  const matches: string[] = [];
  const regex = new RegExp(MODULE_SCRIPT_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    if (match[1] !== undefined) matches.push(match[1]);
  }
  if (matches.length !== 1) return null;
  return matches[0]!;
}

/**
 * Split a tag value on its FIRST pipe separator, tolerating optional whitespace
 * around the pipe (the JSDoc line parser trims trailing whitespace, so an
 * authored ` | ` arrives as ` |` when it ends the line). Returns the trimmed
 * text before the pipe and the trimmed text after it, or `after: null` when no
 * pipe is present.
 */
function splitOnFirstPipe(value: string): { before: string; after: string | null } {
  const match = /\s*\|\s*/.exec(value);
  if (match === null) return { before: value.trim(), after: null };
  return {
    before: value.slice(0, match.index).trim(),
    after: value.slice(match.index + match[0].length).trim(),
  };
}

type ParsedTag = { name: string; value: string };

/**
 * Parse the inner content of a JSDoc block (the text captured between `/**`
 * and `*\/`) into `{ name, value }` tag objects, starting from the first
 * `@cinder` tag. Multi-line tag values are joined with a single space.
 * Returns `null` when no `@cinder` tag is present.
 */
function parseCinderTags(scriptContent: string): ParsedTag[] | null {
  // Walk every JSDoc block in the module script. Use the first block that
  // contains an `@cinder` tag — components may have a preceding banner JSDoc
  // (license header, etc.) that is unrelated to metadata.
  const allBlocks = new RegExp(JSDOC_REGEX.source, 'g');
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = allBlocks.exec(scriptContent)) !== null) {
    const body = blockMatch[1];
    if (body === undefined) continue;
    const lines = body.split('\n').map((line) => line.replace(JSDOC_LINE_PREFIX, '').trimEnd());
    const cinderIndex = lines.findIndex((line) => /^\s*@cinder\b/.test(line));
    if (cinderIndex !== -1) return parseTagsFromLines(lines, cinderIndex);
  }
  return null;
}

/** Parse tag lines starting at the `@cinder` index. Multi-line values are joined with single spaces. */
function parseTagsFromLines(lines: string[], cinderIndex: number): ParsedTag[] {
  const tags: ParsedTag[] = [];
  let current: ParsedTag | null = null;

  for (const line of lines.slice(cinderIndex)) {
    const tagMatch = /^@(\S+)(?:\s+(.*))?$/.exec(line.trim());
    if (tagMatch) {
      if (current) tags.push(current);
      current = { name: tagMatch[1]!, value: (tagMatch[2] ?? '').trim() };
    } else if (current !== null) {
      const trimmed = line.trim();
      if (trimmed) {
        current = { name: current.name, value: `${current.value} ${trimmed}`.trim() };
      }
    }
  }
  if (current) tags.push(current);

  return tags;
}

/**
 * Inline fix appended to the "no @cinder metadata header found" failure.
 * Tells the author exactly where the tag goes and where to read more.
 */
const NO_CINDER_HEADER_FIX =
  '\n  Fix: Add @cinder as the first tag in the <script lang="ts" module> JSDoc block. See AGENTS.md §The five analyzer conventions.';

/**
 * Inline fix appended to the "missing required tags" failure. A copy-pasteable
 * minimal block showing the three mandatory tags in context.
 */
const MISSING_REQUIRED_TAGS_FIX =
  '\n  Fix: the minimal block is:\n  /**\n   * @cinder\n   * @category <valid category id — see AGENTS.md §The five analyzer conventions>\n   * @status <valid status id — see AGENTS.md §The five analyzer conventions>\n   * @purpose <one-sentence description>\n   */';

/**
 * Return a short "did you mean X?" hint when `actual` shares a leading
 * prefix with one of the `candidates`. Only fires when the match is
 * reasonably strong (≥4 shared leading characters).
 */
function didYouMean(actual: string, candidates: string[]): string {
  const prefixLength = Math.min(4, actual.length);
  if (prefixLength < 3) return '';
  const prefix = actual.slice(0, prefixLength);
  const hint = candidates.find((c) => c.startsWith(prefix));
  return hint ? ` (did you mean '${hint}'?)` : '';
}

/** Type guard: narrows `value` to `CategoryId` without an `as` assertion. */
function isCategoryId(value: string): value is CategoryId {
  // Own-property check rejects inherited keys like `toString` that would
  // otherwise satisfy `in` and bypass the closed vocabulary.
  return Object.prototype.hasOwnProperty.call(categories, value);
}

/** Type guard: narrows `value` to `StatusLevel` without an `as` assertion. */
function isStatusLevel(value: string): value is StatusLevel {
  return Object.prototype.hasOwnProperty.call(statusLevels, value);
}

// ---------------------------------------------------------------------------
// Core extraction (pure, no I/O — testable with inline fixtures)
// ---------------------------------------------------------------------------

/**
 * Extract and validate the `@cinder` metadata block from a pre-loaded Svelte source string.
 * Pure function — no file I/O. Tests call this directly with inline fixtures.
 *
 * @internal Prefer `extractComponentMetadata` for file-based callers.
 */
export function extractFromSource(
  source: string,
  componentId: string,
  filePath: string,
  isExperimental: boolean,
): ExtractResult {
  const fail = (reason: string): ExtractResult => ({
    ok: false,
    error: { componentId, file: filePath, reason },
  });

  // Step 1 — Locate the module script block.
  const scriptContent = extractModuleScriptContent(source);
  if (scriptContent === null) {
    const moduleTagCount =
      (source.match(/<script\b[^>]*\bmodule\b/g) ?? []).length +
      (source.match(/<script\b[^>]*\bcontext\s*=\s*["']module["']/g) ?? []).length;
    return moduleTagCount === 0
      ? fail(`no module script block found in ${filePath}`)
      : fail(`duplicate module script blocks found in ${filePath}`);
  }

  // Step 2 — Parse JSDoc tags after `@cinder`.
  const tags = parseCinderTags(scriptContent);
  if (tags === null) {
    return fail(`no @cinder metadata header found in ${filePath}${NO_CINDER_HEADER_FIX}`);
  }

  // Step 3 — Bucket tag values by name.
  const categoryValues: string[] = [];
  const statusValues: string[] = [];
  const purposeValues: string[] = [];
  const tagValues: string[] = [];
  const useWhenValues: string[] = [];
  const avoidWhenValues: string[] = [];
  const relatedValues: string[] = [];
  const a11yPatternValues: string[] = [];
  const keyboardShortcutValues: string[] = [];
  const a11yNoteValues: string[] = [];

  for (const { name, value } of tags) {
    switch (name) {
      case '@lostgradient/cinder':
        break; // marker only
      case 'category':
        categoryValues.push(value);
        break;
      case 'status':
        statusValues.push(value);
        break;
      case 'purpose':
        purposeValues.push(value);
        break;
      case 'tag':
        tagValues.push(value);
        break;
      case 'useWhen':
        useWhenValues.push(value);
        break;
      case 'avoidWhen':
        avoidWhenValues.push(value);
        break;
      case 'related':
        relatedValues.push(value);
        break;
      case 'a11yPattern':
        a11yPatternValues.push(value);
        break;
      case 'keyboardShortcut':
        keyboardShortcutValues.push(value);
        break;
      case 'a11yNote':
        a11yNoteValues.push(value);
        break;
      default:
        break; // silently ignored for forward-compat
    }
  }

  // Step 4 — Enforce exactly-one cardinality.
  if (categoryValues.length > 1) return fail('duplicate @category tag');
  if (statusValues.length > 1) return fail('duplicate @status tag');
  if (purposeValues.length > 1) return fail('duplicate @purpose tag');
  if (a11yPatternValues.length > 1) return fail('duplicate @a11yPattern tag');

  // Step 5 — Require all three mandatory tags.
  const missing: string[] = [];
  if (categoryValues.length === 0) missing.push('@category');
  if (statusValues.length === 0) missing.push('@status');
  if (purposeValues.length === 0) missing.push('@purpose');
  if (missing.length > 0) {
    return fail(`missing required tags: ${missing.join(', ')}${MISSING_REQUIRED_TAGS_FIX}`);
  }

  const categoryRaw = categoryValues[0]!;
  const statusRaw = statusValues[0]!;
  const purposeRaw = purposeValues[0]!;

  // Step 6 — Validate closed vocabulary ids.
  if (!isCategoryId(categoryRaw)) {
    const categoryKeys = Object.keys(categories);
    return fail(
      `unknown category '${categoryRaw}'${didYouMean(categoryRaw, categoryKeys)}. Valid values: ${categoryKeys.join(', ')}`,
    );
  }

  if (!isStatusLevel(statusRaw)) {
    const statusKeys = Object.keys(statusLevels);
    return fail(
      `unknown status '${statusRaw}'${didYouMean(statusRaw, statusKeys)}. Valid values: ${statusKeys.join(', ')}`,
    );
  }

  // Step 7 — Validate @purpose constraints.
  if (purposeRaw.length === 0) return fail('@purpose must be non-empty');
  if (purposeRaw.length > 200) {
    return fail(
      `@purpose exceeds 200 characters (got ${purposeRaw.length}): "${purposeRaw.slice(0, 40)}…"`,
    );
  }

  // Step 8 — Validate @useWhen length and parse @avoidWhen into structured entries.
  for (const entry of useWhenValues) {
    if (entry.length > USE_WHEN_MAX_LENGTH) {
      return fail(
        `@useWhen entry exceeds ${USE_WHEN_MAX_LENGTH} characters (got ${entry.length}): "${entry.slice(0, 40)}…"`,
      );
    }
  }

  // `@avoidWhen <reason> | <kebab-id>`: split on the FIRST pipe (with optional
  // surrounding whitespace) only. The left side is the reason; the optional
  // right side is a kebab-case component id linking to the recommended
  // alternative. Lines without a pipe are reason-only.
  const avoidWhen: AvoidWhenEntry[] = [];
  for (const rawEntry of avoidWhenValues) {
    const { before: reason, after: alternativeRaw } = splitOnFirstPipe(rawEntry);
    if (reason.length === 0) return fail('@avoidWhen reason must be non-empty');
    if (reason.length > AVOID_WHEN_REASON_MAX_LENGTH) {
      return fail(
        `@avoidWhen reason exceeds ${AVOID_WHEN_REASON_MAX_LENGTH} characters (got ${reason.length}): "${reason.slice(0, 40)}…"`,
      );
    }
    if (alternativeRaw === null) {
      avoidWhen.push({ reason });
      continue;
    }
    const alternative = alternativeRaw;
    if (alternative.length === 0) {
      return fail(`@avoidWhen alternative is empty for reason "${reason.slice(0, 40)}…"`);
    }
    if (alternative.length > AVOID_WHEN_ALTERNATIVE_MAX_LENGTH) {
      return fail(
        `@avoidWhen alternative exceeds ${AVOID_WHEN_ALTERNATIVE_MAX_LENGTH} characters (got ${alternative.length}): "${alternative}"`,
      );
    }
    if (!/^[a-z][a-z0-9-]*$/.test(alternative)) {
      return fail(
        `@avoidWhen alternative '${alternative}' must be a kebab-case component id (^[a-z][a-z0-9-]*$)`,
      );
    }
    avoidWhen.push({ reason, alternative });
  }

  // Step 9 — Parse @related and reject PascalCase.
  const related: string[] = [];
  for (const rawLine of relatedValues) {
    for (const part of rawLine.split(',')) {
      const id = part.trim();
      if (!id) continue;
      if (/[A-Z]/.test(id)) {
        return fail(`@related id '${id}' must be kebab-case (PascalCase is not allowed)`);
      }
      related.push(id);
    }
  }

  // Step 10 — Parse optional a11y tags.
  const a11yResult = parseA11yMetadata(
    a11yPatternValues[0],
    keyboardShortcutValues,
    a11yNoteValues,
  );
  if ('error' in a11yResult) return fail(a11yResult.error);
  const a11y = a11yResult.value;

  return {
    ok: true,
    metadata: {
      id: componentId,
      isExperimental,
      category: categoryRaw,
      status: statusRaw,
      purpose: purposeRaw,
      tags: tagValues,
      useWhen: useWhenValues,
      avoidWhen,
      related,
      ...(a11y !== undefined ? { a11y } : {}),
    },
  };
}

/**
 * Parse the optional a11y tags into an {@link A11yMetadata} object, or
 * `undefined` when none were authored. `@keyboardShortcut` requires a `|`
 * separator with non-empty halves; `@a11yNote` and `@a11yPattern` reject empty
 * values. Returns `{ value }` on success or `{ error }` (the human-readable
 * reason) on any violation, so the caller maps it onto its own failure shape.
 */
function parseA11yMetadata(
  patternRaw: string | undefined,
  keyboardRaw: string[],
  notesRaw: string[],
): { value: A11yMetadata | undefined } | { error: string } {
  let pattern: string | undefined;
  if (patternRaw !== undefined) {
    const trimmed = patternRaw.trim();
    if (trimmed.length === 0) return { error: '@a11yPattern must be non-empty' };
    if (trimmed.length > A11Y_PATTERN_MAX_LENGTH) {
      return {
        error: `@a11yPattern exceeds ${A11Y_PATTERN_MAX_LENGTH} characters (got ${trimmed.length})`,
      };
    }
    pattern = trimmed;
  }

  const keyboard: KeyboardShortcut[] = [];
  for (const rawShortcut of keyboardRaw) {
    const { before: keys, after: action } = splitOnFirstPipe(rawShortcut);
    if (action === null) {
      return {
        error: `@keyboardShortcut is missing the '|' separator (format: <keys> | <action>): "${rawShortcut.slice(0, 40)}…"`,
      };
    }
    if (keys.length === 0 || action.length === 0) {
      return {
        error: `@keyboardShortcut keys and action must both be non-empty: "${rawShortcut}"`,
      };
    }
    if (keys.length > KEYBOARD_SHORTCUT_HALF_MAX_LENGTH) {
      return {
        error: `@keyboardShortcut keys exceed ${KEYBOARD_SHORTCUT_HALF_MAX_LENGTH} characters`,
      };
    }
    if (action.length > KEYBOARD_SHORTCUT_HALF_MAX_LENGTH) {
      return {
        error: `@keyboardShortcut action exceeds ${KEYBOARD_SHORTCUT_HALF_MAX_LENGTH} characters`,
      };
    }
    keyboard.push({ keys, action });
  }

  const notes: string[] = [];
  for (const rawNote of notesRaw) {
    const trimmed = rawNote.trim();
    if (trimmed.length === 0) return { error: '@a11yNote must be non-empty' };
    if (trimmed.length > A11Y_NOTE_MAX_LENGTH) {
      return {
        error: `@a11yNote exceeds ${A11Y_NOTE_MAX_LENGTH} characters (got ${trimmed.length})`,
      };
    }
    notes.push(trimmed);
  }

  if (pattern === undefined && keyboard.length === 0 && notes.length === 0) {
    return { value: undefined };
  }
  return {
    value: {
      ...(pattern !== undefined ? { pattern } : {}),
      ...(keyboard.length > 0 ? { keyboard } : {}),
      ...(notes.length > 0 ? { notes } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// File-based extraction API
// ---------------------------------------------------------------------------

/**
 * Extract metadata for one component directory by reading its `.svelte` file
 * from disk. Returns a typed `ExtractResult` — never throws.
 */
export async function extractComponentMetadata(
  componentId: string,
  componentDir: string,
  isExperimental: boolean,
): Promise<ExtractResult> {
  const filePath = join(componentDir, `${componentId}.svelte`);
  let source: string;
  try {
    source = await Bun.file(filePath).text();
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        componentId,
        file: filePath,
        reason: `could not read file: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  return extractFromSource(source, componentId, filePath, isExperimental);
}

/**
 * Extract metadata for every directory component discovered by
 * `discoverDirectoryComponents()`. Returns successes and errors separately.
 */
export async function extractAllComponentMetadata(): Promise<{
  metadata: ComponentMetadata[];
  errors: ExtractError[];
}> {
  const components = await discoverDirectoryComponents();
  const componentsRoot = new URL('../src/components', import.meta.url).pathname;

  const allResults = await Promise.all(
    components.map(async ({ name, isExperimental }) => {
      const componentDir = isExperimental
        ? `${componentsRoot}/experimental/${name}`
        : `${componentsRoot}/${name}`;
      return extractComponentMetadata(name, componentDir, isExperimental);
    }),
  );

  const metadata: ComponentMetadata[] = [];
  const errors: ExtractError[] = [];

  for (const result of allResults) {
    if (result.ok) {
      metadata.push(result.metadata);
    } else {
      errors.push(result.error);
    }
  }

  return {
    metadata: metadata.toSorted((a, b) => a.id.localeCompare(b.id)),
    errors: errors.toSorted((a, b) => a.componentId.localeCompare(b.componentId)),
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const { metadata, errors } = await extractAllComponentMetadata();
  if (errors.length > 0) {
    process.stderr.write(`\nExtraction errors (${errors.length}):\n`);
    for (const error of errors) {
      process.stderr.write(`  [${error.componentId}] ${error.reason}\n`);
    }
  }
  process.stdout.write(
    `\nExtracted metadata for ${metadata.length} components, ${errors.length} errors.\n`,
  );
}
