/**
 * Generates `src/styles/tokens-base.css` and the resolved-context JSON files
 * under `src/tokens/resolved/` from the DTCG token corpus at
 * `src/tokens/`.
 *
 * ARCHITECTURE NOTE: this generator reads the corpus SOURCE documents (the
 * `sets/`, `themes/`, and `modes/` token files), not resolved output. To emit
 * a `[data-theme='dark']` block we need to know WHICH tokens that theme
 * overrides -- resolved output is a flat merged map where an inherited token
 * and an overridden token look identical, so it cannot answer that question.
 * The theme document itself is the list of what to emit in that block, and
 * the same is true of the `reduced` and `forced-reduced-motion` motion
 * contexts, each of which backs its own selector (the `prefers-reduced-motion`
 * media block and the `data-reduced-motion='on'` override, respectively).
 * Reading source documents also
 * sidesteps a known limitation of `resolve.ts`'s `mergeGroup`: it replaces a
 * colliding token wholesale, which drops `$description` and `$extensions`
 * (including `cssProperty`) for overridden tokens in fully-resolved output.
 * `resolve.ts` is still used for exactly one thing here: standing up the
 * resolved-context JSON files (see {@link buildResolvedContexts}), which are
 * a deliberately flat, fully-resolved view and do not feed CSS generation.
 *
 * VALUE EMISSION RULE: the generator does no independent unit selection or
 * precision rounding. If a token's `cssRecipe` extension is a non-null
 * string, it is emitted verbatim. Otherwise the typed `$value` is serialized
 * with straightforward, non-lossy formatting -- the few conversions below
 * (dimension/duration units, oklch lightness-to-percentage, hex shorthand,
 * font-family quoting) are required CSS syntax, not formatting choices. If a
 * serialized value would ever disagree with the current file with no
 * `cssRecipe` explaining why, the fix is correcting the corpus value, not
 * adding generator formatting logic.
 */

import { join } from 'node:path';
import { buildTokensBaseCss } from './css-generator.ts';
import { resolvedDirectory, tokensBaseCssPath } from './generator-configuration.ts';
import { loadRawTokenDocuments, loadResolverDocument } from './load.ts';
import { buildResolvedContexts } from './resolved-contexts.ts';
import type { ResolverDocument, TokenDocument } from './types.ts';
import { normalizedDocumentsByPath, validateLoadedTokenDocuments } from './validate-corpus.ts';

// Entry point.
// ---------------------------------------------------------------------------

export async function loadCorpus(): Promise<{
  resolver: ResolverDocument;
  documentsByPath: Map<string, TokenDocument>;
}> {
  const resolver = await loadResolverDocument();
  const loaded = await loadRawTokenDocuments();
  const validated = validateLoadedTokenDocuments(resolver, loaded);
  const documentsByPath = normalizedDocumentsByPath(
    new Map(validated.map(({ path, document }) => [path, document])),
  );
  return { resolver, documentsByPath };
}

/** Absolute output path -> generated file content, for every file `tokens:generate` produces. */
export async function buildGeneratedOutputs(): Promise<Map<string, string>> {
  const { resolver, documentsByPath } = await loadCorpus();
  const css = await buildTokensBaseCss(resolver, documentsByPath);
  const resolvedContexts = await buildResolvedContexts(resolver, documentsByPath);

  const outputs = new Map<string, string>();
  outputs.set(tokensBaseCssPath, css);
  for (const [name, content] of resolvedContexts) {
    outputs.set(join(resolvedDirectory, `${name}.json`), content);
  }
  return outputs;
}

/**
 * Compares freshly generated output against the committed content at each
 * output path (`undefined` for a missing/unreadable file) and returns the
 * absolute paths that drifted. Empty means everything committed matches what
 * the generator produces right now -- exactly what `--check` gates on.
 */
export function findDriftedPaths(
  generated: ReadonlyMap<string, string>,
  existing: ReadonlyMap<string, string | undefined>,
): string[] {
  const drifted: string[] = [];
  for (const [path, content] of generated) {
    if (existing.get(path) !== content) drifted.push(path);
  }
  return drifted;
}

/**
 * Reads the currently-committed content at each of `paths` (`undefined` for a
 * missing/unreadable file). Exported so `generate-artifacts.ts` -- the actual
 * `tokens:generate` CLI entry point, which also writes the docs, registry,
 * outputs this file knows nothing about -- can compare
 * ALL generated outputs (this file's CSS/JSON plus its own) against the
 * committed tree with one shared helper instead of two divergent ones.
 */
export async function readExisting(
  paths: Iterable<string>,
): Promise<Map<string, string | undefined>> {
  const existing = new Map<string, string | undefined>();
  for (const path of paths) {
    existing.set(
      path,
      await Bun.file(path)
        .text()
        .catch(() => undefined),
    );
  }
  return existing;
}
