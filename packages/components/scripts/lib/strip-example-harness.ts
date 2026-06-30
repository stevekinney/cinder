/**
 * Strips the doc-page mount-isolation harness from an example's source so the
 * reader-facing "Show code" snippet shows clean, idiomatic consumer usage.
 *
 * ## Why this exists
 *
 * The component doc page mounts a component's featured example twice in one
 * document — once in the Overview hero and once in the Examples section
 * (`component-page.svelte`). If an example hardcoded element ids, both mounts
 * emitted identical ids → invalid HTML, broken `aria-labelledby` (#399). The
 * fix: each example accepts a `mountIdPrefix` prop (its container's DOM id) and
 * derives every id from it, so the two mounts produce distinct id trees.
 *
 * That scoping is a doc-harness concern, not something a consumer writes. The
 * "Show code" disclosure serves the RAW `.example.svelte` file
 * (`/example-src/:name/:scenario`), so without this strip the reader would copy
 * `mountIdPrefix` / `$props.id()` boilerplate that is meaningless in their app.
 * This function removes that plumbing and rewrites the derived id binding sites
 * back to plain static literals.
 *
 * ## The harness idiom (uniform across every scoped example)
 *
 * ```svelte
 * let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
 * const uid = $props.id();
 * let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);
 * ```
 *
 * The displayed literal is the suffix text: `-field` → `"field"`. Binding sites
 * are rewritten — `id={fieldId}` → `id="field"` (same for `name=` / `target=` /
 * `for=` / `aria-labelledby=`), and template interpolation `` `#${mainId}` `` → `"#main"`.
 *
 * ## Fail-closed
 *
 * After stripping, the output is scanned for any surviving harness marker
 * (`mountIdPrefix`, `$props.id()`) or removed identifier. If one survives — an
 * unhandled binding form left a dangling `{fieldId}`, or a non-matching derived
 * declaration left `mountIdPrefix ?? uid` behind — this throws rather than
 * serving broken, uncopyable code. A new binding shape must be handled here, not
 * silently shipped.
 */

/** Matches a JavaScript identifier `name` only when it is not part of a larger one. */
const identifierBoundary = (name: string): string => `(?<![\\w$])${name}(?![\\w$])`;

/** Escapes a string for safe interpolation into a `RegExp` source. */
const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The two fixed harness lines, removed verbatim (modulo surrounding whitespace). */
const MOUNT_ID_PREFIX_PROP_LINE =
  /^[^\n]*let\s*\{\s*mountIdPrefix\s*\}\s*:\s*\{\s*mountIdPrefix\?\s*:\s*string\s*\}\s*=\s*\$props\(\)\s*;?[^\n]*\n/m;
const UID_LINE = /^[^\n]*const\s+uid\s*=\s*\$props\.id\(\)\s*;?[^\n]*\n/m;

/**
 * A derived-id declaration in the canonical suffix form:
 * `<declaration> <var> = $derived(`${mountIdPrefix ?? uid}-<suffix>`);`. The
 * `<suffix>` group is the literal shown to the reader. The matcher also accepts
 * Prettier's multiline `$derived(` shape with a trailing comma after the
 * template. Bare-form (no suffix) declarations are intentionally not matched —
 * every featured example uses the suffix form so the displayed literal is
 * self-describing rather than read from a side table.
 */
const DERIVED_ID_LINE =
  /^[^\n]*(?:let|const)\s+(?<var>[A-Za-z_$][\w$]*)\s*=\s*\$derived\(\s*`\$\{mountIdPrefix\s*\?\?\s*uid\}-(?<suffix>[^`]*)`\s*,?\s*\)\s*;?[^\n]*\n/m;

/** Markers that prove the harness was only partially removed — none may survive. */
const RESIDUAL_HARNESS_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
  ['mountIdPrefix', /mountIdPrefix/],
  ['$props.id()', /\$props\.id\(\)/],
];

/**
 * Removes the mount-isolation harness from `source` and rewrites derived id
 * binding sites to static literals. `scenarioKey` is `componentName/scenario`
 * (e.g. `date-range-field/basic`), used only for diagnostic messages.
 *
 * Returns the original source unchanged when it contains no harness (the common
 * case — most examples never needed id scoping).
 *
 * @throws if a removed identifier still appears in the stripped output, or if any
 *   harness marker survives the strip (an unrecognized declaration shape).
 */
export function stripExampleHarness(source: string, scenarioKey: string): string {
  if (!source.includes('mountIdPrefix')) return source;

  // Collect every `var -> suffix literal` mapping before mutating the source,
  // then delete the declarations.
  //
  // `DERIVED_ID_LINE` is non-global, so `.exec` always restarts from index 0;
  // each iteration removes the line it matched, so the next `.exec` advances to
  // the following declaration. The loop terminates because every iteration
  // shrinks `stripped` by exactly one matched line.
  const literals = new Map<string, string>();
  let stripped = source;

  let match: RegExpExecArray | null;
  while ((match = DERIVED_ID_LINE.exec(stripped)) !== null) {
    const variable = match.groups?.['var'];
    const suffix = match.groups?.['suffix'];
    if (variable === undefined || suffix === undefined) {
      // The named groups are mandatory in the pattern; a miss means the regex
      // was edited into an inconsistent state. Fail loudly rather than serve a
      // half-stripped snippet.
      throw new Error(
        `stripExampleHarness: matched a derived-id line in "${scenarioKey}" with no captured var/suffix — DERIVED_ID_LINE is malformed`,
      );
    }
    literals.set(variable, suffix);
    stripped = stripped.replace(match[0], '');
  }

  // Remove the two fixed harness lines.
  stripped = stripped.replace(MOUNT_ID_PREFIX_PROP_LINE, '').replace(UID_LINE, '');

  // Rewrite every binding site for each removed identifier. Replacements use
  // callbacks so the literal is inserted verbatim — a `$`-bearing suffix can
  // never be reinterpreted as a `String.prototype.replace` substitution token.
  for (const [variable, literal] of literals) {
    const escaped = escapeForRegExp(variable);
    // Template interpolation inside a backtick string: `#${mainId}` → "#main".
    // Handles the skip-link `href={`#${mainId}`}` shape — collapse the whole
    // `{` … backtick-string … `}` attribute value to a plain quoted literal.
    stripped = stripped.replace(
      new RegExp(`=\\{\\s*\`([^\`]*)\\$\\{${escaped}\\}([^\`]*)\`\\s*\\}`, 'g'),
      (_full, before: string, after: string) => `="${before}${literal}${after}"`,
    );
    // Plain attribute binding: `id={fieldId}` → `id="field"` (also name=/target=/for=/
    // aria-labelledby=, e.g. a `<label for={fieldId}>` paired with the field).
    stripped = stripped.replace(
      new RegExp(`(\\b(?:id|name|target|for|aria-labelledby)=)\\{\\s*${escaped}\\s*\\}`, 'g'),
      (_full, attribute: string) => `${attribute}"${literal}"`,
    );
    // Script object-literal values used for explicit-items examples:
    // `{ id: fieldId }` → `{ id: 'field' }`.
    stripped = stripped.replace(
      new RegExp(`(\\bid\\s*:\\s*)${escaped}\\b`, 'g'),
      (_full, prefix: string) => `${prefix}'${literal}'`,
    );
  }

  // Fail closed (1): no harness marker may survive a partial strip. A derived
  // declaration the regex didn't recognize (multiline, `const`, reformatted)
  // would leave `mountIdPrefix ?? uid` behind with its prop/uid lines deleted.
  for (const [label, pattern] of RESIDUAL_HARNESS_MARKERS) {
    if (pattern.test(stripped)) {
      throw new Error(
        `stripExampleHarness: harness marker "${label}" survived the strip in "${scenarioKey}" — an unrecognized declaration shape`,
      );
    }
  }

  // Fail closed (2): no removed identifier may survive in a `{...}` expression
  // position (a binding shape the rewrites above didn't handle). Scoped to brace
  // expressions so an incidental mention in prose/a comment never trips it, and
  // matched with identifier boundaries (not `\b`) so a `$`-prefixed name is found
  // exactly — `data-foo={$fieldId}` cannot slip past a check for `fieldId`.
  for (const variable of literals.keys()) {
    const escaped = escapeForRegExp(variable);
    if (new RegExp(`\\{[^}]*${identifierBoundary(escaped)}[^}]*\\}`).test(stripped)) {
      throw new Error(
        `stripExampleHarness: removed identifier "${variable}" still referenced after strip in "${scenarioKey}" — an unhandled binding shape`,
      );
    }
  }

  // Collapse the blank lines the deletions left behind so the `<script>` block
  // reads cleanly (runs of 3+ newlines → a single blank line).
  return stripped.replace(/\n{3,}/g, '\n\n');
}
