---
'@lostgradient/markdown': patch
---

Keep filled template values out of the render cache: `renderTemplate` now renders through an uncached path, so placeholder values no longer stay in `renderMarkdown`'s module-level result cache after a call returns.

Document the placeholder API that shipped in 0.6.0 on the npm README: definitions, `resolveTemplatePlaceholders` options (`valueMode`, `unresolved`), diagnostics, the literal-text default and the security boundary. The README's `renderTemplate` example now passes the required `{ definitions }`; without them, 0.6.0 and later fill nothing.

Restating the 0.6.0 breaking changes, which its release notes omitted: `buildPlaceholderCandidatesFromJsonSchema` returns `{ candidates, issues }`; `PlaceholderCandidate` drops `valueKind` (and `PlaceholderValueKind` is removed) for `types`, `title` and `description`; `resolveTemplatePlaceholders(template, values, options)` and `renderTemplate(template, values, options)` require `options.definitions` and fill only declared paths; arrays become compact JSON, `null` is written as `null`, and missing values stay visible with a `missing_value` issue; replacements are literal text unless `valueMode: 'markdown'`; `PlaceholderToken.closed` is replaced by `kind`; `validatePlaceholderTokens` returns `PlaceholderDiagnostic[]` and `PlaceholderValidationIssue`/`PlaceholderValidationResult` are removed; `isBlockedSegment` moved to `./templates/placeholder-security`.

The package root is not lean: it reaches Shiki, `@shikijs/*`, `remark-math` and `rehype-katex`, and `remark-math`'s `micromark-extension-math` statically imports `katex`, which unbundled runtimes evaluate even from `./templates/template-placeholders`. For lean placeholder imports use `./templates/types`, `./templates/placeholder-security` and `./templates/sanitize-html`.
