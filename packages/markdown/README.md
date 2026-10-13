# @lostgradient/markdown

`@lostgradient/markdown` is a headless Markdown pipeline: CommonMark + GFM parsing and
deterministic serialization, sanitized HTML rendering (with math and syntax highlighting),
word-level diffing, and placeholder templating. It has no Svelte dependency — use it from a
server, a build script, or any other non-component context.

## Install

```bash
bun add @lostgradient/markdown
```

This package has no peer dependencies. Its runtime dependencies (remark, rehype, unified,
remark-math, rehype-katex, Shiki and `@shikijs/*`, diff-match-patch, js-yaml, comlink) are
installed automatically. See [The package root is not lean](#the-package-root-is-not-lean) before
importing from `.` in a size- or startup-sensitive context.

## Usage

````ts
import { parse, serialize } from '@lostgradient/markdown/pipeline';
import { renderMarkdown } from '@lostgradient/markdown/rendering';
import { computeLineDiff } from '@lostgradient/markdown/diff/line-diff';
import { renderTemplate } from '@lostgradient/markdown/templates/template-render';

const parsed = parse('# Hello *world*');
if (parsed.success) serialize(parsed.ast);

const { html } = renderMarkdown('# Hi\n\n```ts\nconst x = 1;\n```');
const diff = computeLineDiff('a\nb', 'a\nc');
const filled = renderTemplate(
  'Hello {{name}}',
  { name: 'World' },
  { definitions: { candidates: [{ path: 'name', types: ['string'] }] } },
); // '<p>Hello World</p>'
````

## Subpaths

- `.` / `./pipeline` — parse, serialize, and AST utilities.
- `./diff`, `./diff/line-diff`, `./diff/types` — word- and line-level diffing.
- `./rendering`, `./rendering/types`, `./rendering/highlighter`, `./rendering/mermaid-cache` —
  Markdown-to-sanitized-HTML rendering, syntax highlighting, and Mermaid diagram caching.
- `./templates/types`, `./templates/placeholder-security`, `./templates/sanitize-html`,
  `./templates/template-placeholders`, `./templates/template-render` — placeholder catalogs,
  resolution, diagnostics, and template rendering (DOM-free; see
  [Template placeholders](#template-placeholders)).
- `./utilities/safe-url`, `./utilities/sort-keys` — small standalone helpers.

## Template placeholders

Placeholders are `{{path}}` tokens in a Markdown template. Resolving, rendering, completing and
filling placeholders requires **definitions**, which are the only allowlist of paths that may be
completed or filled. Pass exactly one of `schema` (a JSON Schema object, the recommended path) or
`candidates` (explicit `{ path, types?, title?, description? }` entries).

The lower-level utilities take their own inputs instead of definitions: `parsePlaceholderTokens`
and `parseMarkdownPlaceholderTokens` take only source text, `validatePlaceholderTokens` takes
tokens and candidates, and `buildPlaceholderCandidatesFromJsonSchema` takes a schema.

```ts
import {
  normalizePlaceholderDefinitions,
  PlaceholderTemplateError,
  resolveTemplatePlaceholders,
} from '@lostgradient/markdown/templates/template-placeholders';
import { renderTemplate } from '@lostgradient/markdown/templates/template-render';

const definitions = {
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Display name' },
      user: { type: 'object', properties: { name: { type: 'string' } } },
    },
  },
};

const catalog = normalizePlaceholderDefinitions(definitions);
// catalog.enabled === true; catalog.candidates paths: name, user, user.name

const { text, issues } = resolveTemplatePlaceholders(
  'Hello **{{user.name}}**, `{{user.name}}` stays literal. {{missing}}',
  { user: { name: 'Ada <3' } },
  { definitions },
);
// text: 'Hello **Ada&#32;&#60;3**, `{{user.name}}` stays literal. {{missing}}'
// issues: [{ code: 'unknown_placeholder', path: 'missing', … }]

const html = renderTemplate('Hello {{name}}', { name: 'World' }, { definitions });
// '<p>Hello World</p>'

try {
  resolveTemplatePlaceholders('{{missing}}', {}, { definitions, unresolved: 'error' });
} catch (error) {
  if (error instanceof PlaceholderTemplateError) console.log(error.issues);
}
```

- **Catalogs.** `normalizePlaceholderDefinitions(definitions)` returns sorted `candidates`,
  ordered `issues`, and `enabled`. Any issue disables completion and fill until the definitions
  are fixed. `buildPlaceholderCandidatesFromJsonSchema(schema)` returns `{ candidates, issues }`.
  Schema extraction reads a root object schema's recursively declared `properties`; it does not
  validate instances, never follows or fetches `$ref`, and reports `$ref`, `allOf`, `anyOf`,
  `oneOf`, `if`/`then`/`else`, `patternProperties`, and schema-valued `additionalProperties` as
  `unsupported_schema`. Property names must be non-reserved ASCII identifiers.
- **Resolution.** `resolveTemplatePlaceholders(template, values, options)` returns
  `{ text, issues }`. `options.definitions` is required; `valueMode` (`'text'` or `'markdown'`,
  default `'text'`) and `unresolved` (`'preserve'` or `'error'`, default `'preserve'`) are
  optional. Only declared paths are filled, from own data properties of plain objects.
  `renderTemplate(template, values, options)` takes the same options and returns sanitized HTML.
- **Literal text by default.** In `'text'` mode every replacement is encoded with character
  references, so a value such as `**bold**` renders literally. `valueMode: 'markdown'` inserts
  string values raw. Arrays and objects become compact JSON (objects with recursively sorted
  keys); `null` is written as `null`.
- **Diagnostics.** Each token gets at most one issue: `malformed_token`, `invalid_path_format`,
  `blocked_path`, `unknown_placeholder`, `missing_value`, `invalid_value`, or `type_mismatch`.
  Invalid `values` (`invalid_values`), an invalid option (`invalid_option`), or any definitions
  issue disables fill and returns the template unchanged. In `'preserve'` mode unresolved tokens
  keep their original text; in `'error'` mode any issue throws `PlaceholderTemplateError` with
  the same ordered `issues`. Diagnostics never contain supplied values.
- **Where tokens are active.** Tokens are scanned by Markdown structure: front matter, code,
  raw HTML, math, link and image destinations, and autolinks stay literal, and no token spans a
  line ending or a formatting boundary. `parsePlaceholderTokens(text)` scans one plain text run;
  `parseMarkdownPlaceholderTokens(source)` scans a whole Markdown template.
- **Security boundary.** Reserved segments (such as `__proto__` and `constructor`) are blocked
  everywhere by `isBlockedSegment`. Replacement text is never scanned for placeholders again.
  `resolveTemplatePlaceholders` returns Markdown source, not safe HTML; render it with
  `renderTemplate` or `renderMarkdown`, which pass every value through the same sanitizer and URL
  rules as any other Markdown.

## The package root is not lean

The package root (`.`) re-exports rendering, asynchronous worker rendering, and templates, so
importing it reaches Shiki and `@shikijs/*`, `remark-math`, and `rehype-katex`. That is
deliberate: the root is the full pipeline. If you only need placeholder utilities, import a
subpath instead, and choose it by what it reaches:

| Subpath                                                                              | Reaches                                                                 |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `./templates/types`, `./templates/placeholder-security`, `./templates/sanitize-html` | No Shiki, `remark-math`, or KaTeX. These are the lean imports.          |
| `./templates/template-placeholders` (parsing, catalogs, resolution, diagnostics)     | `remark-math` (to keep math literal), and through it KaTeX (see below). |
| `./templates/template-render`, `./rendering`, `.`                                    | The full rendering pipeline, including Shiki and `rehype-katex`.        |

`remark-math@6` depends on `micromark-extension-math`, whose entry statically re-exports an HTML
extension that imports `katex`. `remark-math` and `micromark-extension-math` declare
`sideEffects: false`, so a bundler that honors it can drop KaTeX from
`./templates/template-placeholders`. An unbundled runtime (for example, Bun or Node importing the
package directly) still evaluates the `katex` module even though the placeholder parser never
calls it; under a DOM shim such as happy-dom that prints KaTeX's "doesn't work in quirks mode"
warning.

## Breaking changes in 0.6.0

Version 0.6.0 replaced the placeholder API. Update callers as follows:

- `buildPlaceholderCandidatesFromJsonSchema(schema)` returned `PlaceholderCandidate[]`, silently
  skipping unsupported keywords and unaddressable property names. It now returns
  `{ candidates, issues }`, where `issues` holds `PlaceholderDiagnostic` entries located by JSON
  Pointers starting at `/schema`, and unsupported keywords, unaddressable or reserved names,
  malformed types and cycles are reported.
- `PlaceholderCandidate` changed from `{ path; description: string | undefined; valueKind }` to
  `{ path; types?: readonly PlaceholderSchemaType[]; title?: string; description?: string }`.
  `PlaceholderValueKind` and `valueKind` are removed; `integer` is no longer collapsed into
  `number`, type unions are kept, and an omitted `types` means unknown.
- `resolveTemplatePlaceholders(template, values, candidatePaths?)` substituted every closed token
  and reported `unknown_placeholder` only when `candidatePaths` was given. It is now
  `resolveTemplatePlaceholders(template, values, options)` with required `options.definitions`
  and optional `valueMode` and `unresolved`, returns
  `{ text, issues: readonly PlaceholderDiagnostic[] }`, and fills only declared paths.
- Array, null and missing values changed. Arrays were comma-joined (`['a', 'b', 3]` became
  `a, b, 3`), `null`, `undefined` and missing or unknown paths became `''`. Now arrays are compact
  JSON in order (`[1,"x"]`), `null` becomes `null`, a missing own property is a `missing_value`
  issue and the token stays in the output (or throws in `'error'` mode), unknown, reserved and
  malformed tokens stay visible with an issue, and `undefined`, bigint, functions, symbols,
  non-finite numbers, sparse arrays, accessors, cycles and non-plain objects are `invalid_value`
  issues. Objects use recursively sorted keys.
- Default output is literal text. Replacement strings used to be inserted raw, so `**bold**`
  rendered as Markdown. Every replacement is now encoded with character references unless
  `valueMode: 'markdown'` is passed.
- `renderTemplate(template, values)` is now `renderTemplate(template, values, options)` with the
  same required options, and throws `PlaceholderTemplateError` in `'error'` mode. Calling it
  without definitions leaves every token unfilled.
- `PlaceholderToken.closed: boolean` is replaced by `kind: 'placeholder' | 'malformed'`. Triple
  braces and nested openers are one malformed token, unclosed tokens stop at the line end,
  backslash-escaped openers are literal, and no token spans a line ending.
  `parseMarkdownPlaceholderTokens` is the new Markdown-aware scanner the resolver uses.
- `validatePlaceholderTokens(tokens, candidates)` returned `{ validTokens, invalidTokens, issues }`.
  It now returns `readonly PlaceholderDiagnostic[]` whose `code` replaces `reason` and whose
  `location` (`{ kind: 'token', startOffset, endOffset }`) replaces `token`; it also reports
  `blocked_path`. `PlaceholderValidationIssue` and `PlaceholderValidationResult` are removed.
- `isBlockedSegment` moved from `./templates/template-placeholders` to
  `./templates/placeholder-security`. The package root still exports it.

## Provenance

This package absorbed the former workspace-private `@cinder/diff` package (word/line diffing)
and the headless half of `@cinder/editor` (templating) — see
[`docs/decisions/package-boundaries.md`](https://github.com/stevekinney/cinder/blob/main/docs/decisions/package-boundaries.md)
for the extraction history.
