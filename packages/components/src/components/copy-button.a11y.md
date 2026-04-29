# CopyButton · accessibility

## Pattern

A native `<button>` whose accessible name reflects the current state ("Copy to clipboard" / "Copied"). After a successful copy, the button updates `aria-live` so screen readers announce the confirmation, then reverts after `confirmDuration` (default 1500 ms).

## Roles, names, states

- The element is a real `<button type="button">` — focusable, click- and Space/Enter-activated by the platform.
- `aria-label` defaults to "Copy to clipboard" in idle state and "Copied" in confirmation state, OR uses the consumer-supplied `label` if provided.
- `aria-live="polite"` ensures the visible label change is announced without interrupting other content.

## Clipboard fallback

The button calls `copyToClipboard` which prefers `navigator.clipboard.writeText` and falls back to a hidden `<textarea>` plus `document.execCommand('copy')` for older browsers and insecure contexts. If both paths fail, the button does not enter the confirmation state — consumers can rely on this to wire their own error feedback (toast, etc.) by wrapping `copyToClipboard` directly.

## Children

By default the button renders "Copy" / "Copied". Consumers can supply `children` and `confirmation` snippets to substitute icons, alternate text, or composed content. Whatever you render in `children` should still be readable as a button label.
