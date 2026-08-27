/**
 * Asserts the generated token registry advertises no private custom property.
 *
 * The rule: a `public: true` entry must carry the `--cinder-` prefix, and a
 * `public: false` entry must carry `--_cinder-`. Both are checked positively.
 * The two prefixes are DISJOINT -- `--_cinder-` diverges at the third character
 * -- so "not private" never implies "public", and deriving either check from
 * the negation of the other would admit a third namespace such as
 * `--vendor-foo` entirely.
 *
 * This deliberately duplicates a rule `registry.ts` already enforces while
 * BUILDING the registry, and the duplication is the point: that guard protects
 * the generator's inputs, this one protects the artifact that ships. A
 * generator bug, a hand-edit to `registry.generated.json`, or a bad merge would
 * all pass the first check and fail this one. Expect it to pass on a healthy
 * tree -- a failure here means the committed artifact disagrees with the corpus
 * it claims to describe, so run `tokens:generate` and look at the diff before
 * anything else.
 *
 * Run with `bun run tokens:privacy`.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const registryPath = join(componentsRoot, 'src', 'tokens', 'registry.generated.json');

export const PUBLIC_TOKEN_PREFIX = '--cinder-';
export const PRIVATE_TOKEN_PREFIX = '--_cinder-';

export type RegistryEntry = {
  path: string;
  cssProperty: string;
  public: boolean;
};

export type PrivacyViolation = {
  path: string;
  cssProperty: string;
  expectedPrefix: string;
  reason: string;
};

/**
 * Every entry whose `public` flag and `cssProperty` prefix disagree. Pure so
 * the rule is testable without a registry on disk.
 */
export function findPrivacyViolations(
  entries: readonly RegistryEntry[],
): readonly PrivacyViolation[] {
  const violations: PrivacyViolation[] = [];
  for (const entry of entries) {
    const expectedPrefix = entry.public ? PUBLIC_TOKEN_PREFIX : PRIVATE_TOKEN_PREFIX;
    if (entry.cssProperty.startsWith(expectedPrefix)) continue;
    violations.push({
      path: entry.path,
      cssProperty: entry.cssProperty,
      expectedPrefix,
      reason: entry.public
        ? `advertised as public but its property does not use the ${PUBLIC_TOKEN_PREFIX} prefix`
        : `marked private but its property does not use the ${PRIVATE_TOKEN_PREFIX} prefix`,
    });
  }
  return violations;
}

async function main(): Promise<void> {
  // Narrowed through `unknown`: a registry that is not an object, or has no
  // `entries` array, should fail with a named reason rather than as an
  // undefined-property read inside the rule.
  const parsed: unknown = await Bun.file(registryPath).json();
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${registryPath} is not a JSON object.`);
  }
  const entriesValue = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entriesValue)) {
    throw new Error(`${registryPath} has no \`entries\` array.`);
  }
  const entries = entriesValue as readonly RegistryEntry[];
  const violations = findPrivacyViolations(entries);

  if (violations.length > 0) {
    const detail = violations
      .map((violation) => `  ${violation.path} (${violation.cssProperty}) — ${violation.reason}`)
      .join('\n');
    process.stderr.write(
      `tokens:privacy — the generated token registry advertises properties whose ` +
        `privacy and prefix disagree:\n${detail}\n\n` +
        `The generated registry disagrees with the corpus it describes. Run ` +
        `\`bun run --filter=@lostgradient/cinder tokens:generate\` and inspect the diff.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const publicCount = entries.filter((entry) => entry.public).length;
  process.stdout.write(
    `tokens:privacy — OK (${entries.length} tokens, ${publicCount} public, ` +
      `no private property advertised as public).\n`,
  );
}

if (import.meta.main) await main();
