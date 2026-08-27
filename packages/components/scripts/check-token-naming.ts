/**
 * Enforces CIN-33's token naming rules against the generated registry.
 *
 * The rules this checks, and the ones it deliberately does not:
 *
 *   - **Segment shape.** Every dot-separated segment is lowercase kebab-case.
 *     Uppercase and underscores are legal CSS but are not the corpus's
 *     convention, and `registry.ts` already rejects them in the CSS property.
 *   - **No CSS-derived abbreviations.** `bg` and `fg` are banned as segments.
 *     The word `text` is NOT banned: the ticket's parenthetical lists it, but
 *     three of its own examples use it, and worked examples beat a
 *     parenthetical.
 *   - **The CSS property is checked too, not just the path.** They are authored
 *     independently, so a path can satisfy every rule while its property
 *     reintroduces exactly what the rename removed.
 *   - **No `color.*` top-level namespace.** Every token is a color or is not;
 *     a `color` domain says nothing about intent, which is what a name is for.
 *   - **A token path names a role, not just a domain.** A bare `accent` or
 *     `danger` carries no role, so it cannot be read without context.
 *
 * Depth is deliberately NOT capped at three. `status.<name>` reads as a
 * compound domain, and the corpus already carries four-segment component paths
 * (`button.padding.x.xs`) and `motion.progress.ring.spin`. A cap would force
 * either a flattening that hides structure or an exception list.
 *
 * Run with `bun run check:token-naming`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const registryPath = join(componentsRoot, 'src', 'tokens', 'registry.generated.json');

/** Lowercase kebab-case: letters and digits, single hyphens between them. */
export const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** CSS-derived abbreviations that say how a value is used, not what it means. */
export const BANNED_SEGMENTS = new Set(['bg', 'fg']);

/** Top-level namespaces that classify by type rather than by intent. */
export const BANNED_DOMAINS = new Set(['color', 'colour']);

export type NamingViolation = { path: string; reason: string };

/** The two independently authored names a registry entry carries. */
export type NamedToken = { path: string; cssProperty: string };

/**
 * The CSS property a path should produce, by the corpus's own convention:
 * dots become hyphens under the `--cinder-` prefix.
 *
 * This is NOT enforced as an equality, because several deliberate exceptions
 * exist -- `motion.fast` emits `--cinder-duration-fast`, and `type.*` emits
 * `--cinder-text-*`. What IS enforced is that the property carries no banned
 * segment and no banned namespace, which is the part the rename was about.
 */
function propertySegments(cssProperty: string): string[] {
  return cssProperty.replace(/^--_?cinder-/, '').split('-');
}

/** Pure so the rules are testable without a registry on disk. */
export function findNamingViolations(
  tokens: readonly (NamedToken | string)[],
): readonly NamingViolation[] {
  const violations: NamingViolation[] = [];

  for (const token of tokens) {
    // Accepts a bare path so the path rules stay testable on their own.
    const path = typeof token === 'string' ? token : token.path;
    const cssProperty = typeof token === 'string' ? undefined : token.cssProperty;
    // The document-level `$root` token resolves to the empty path; it has no
    // name to check and is not part of the public naming surface.
    if (path === '') continue;

    const segments = path.split('.');

    if (segments.length < 2) {
      violations.push({
        path,
        reason: 'is a bare domain with no role — a name should read without context',
      });
    }

    if (BANNED_DOMAINS.has(segments[0] ?? '')) {
      violations.push({
        path,
        reason: `uses the "${segments[0]}" top-level namespace, which classifies by type rather than intent`,
      });
    }

    for (const segment of segments) {
      if (!SEGMENT_PATTERN.test(segment)) {
        violations.push({ path, reason: `has the non-kebab-case segment "${segment}"` });
      }
      if (BANNED_SEGMENTS.has(segment)) {
        violations.push({
          path,
          reason: `uses the CSS-derived abbreviation "${segment}"`,
        });
      }
    }

    // The CSS property is authored independently of the path, so a compliant
    // path can still ship `--cinder-color-danger-bg` to consumers. That is the
    // surface the rename actually changed, so it is checked on its own terms.
    if (cssProperty !== undefined) {
      const propertyParts = propertySegments(cssProperty);
      for (const segment of propertyParts) {
        if (BANNED_SEGMENTS.has(segment)) {
          violations.push({
            path,
            reason: `has cssProperty "${cssProperty}", which uses the CSS-derived abbreviation "${segment}"`,
          });
        }
      }
      if (BANNED_DOMAINS.has(propertyParts[0] ?? '')) {
        violations.push({
          path,
          reason: `has cssProperty "${cssProperty}", which reintroduces the "${propertyParts[0]}" namespace`,
        });
      }
    }
  }

  return violations;
}

/** One field of an already-narrowed object, without asserting a shape over it. */
function readField(source: object, field: string): unknown {
  return Object.hasOwn(source, field)
    ? (Object.getOwnPropertyDescriptor(source, field)?.value as unknown)
    : undefined;
}

function readRegistryTokens(): NamedToken[] {
  const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${registryPath} is not a JSON object.`);
  }
  const entries = readField(parsed, 'entries');
  if (!Array.isArray(entries)) {
    throw new Error(`${registryPath} has no \`entries\` array.`);
  }
  const tokens: NamedToken[] = [];
  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`${registryPath} entries[${index}] is not an object.`);
    }
    const path = readField(entry, 'path');
    const cssProperty = readField(entry, 'cssProperty');
    if (typeof path !== 'string' || typeof cssProperty !== 'string') {
      throw new Error(`${registryPath} entries[${index}] has no string path and cssProperty.`);
    }
    tokens.push({ path, cssProperty });
  }
  return tokens;
}

function main(): void {
  const tokens = readRegistryTokens();
  const violations = findNamingViolations(tokens);

  if (violations.length > 0) {
    const detail = violations
      .map((violation) => `  ${violation.path} — ${violation.reason}`)
      .join('\n');
    process.stderr.write(
      `check:token-naming — ${violations.length} token name(s) break the naming rules:\n` +
        `${detail}\n\nSee the rules in this script's header. Renaming a token is a ` +
        `breaking change: update the corpus, every var() reference, and add a changeset.\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `check:token-naming — OK (${tokens.length} token names and CSS properties).\n`,
  );
}

if (import.meta.main) main();
