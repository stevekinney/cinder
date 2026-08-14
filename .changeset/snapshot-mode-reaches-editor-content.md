---
'@lostgradient/editor': patch
---

Make `snapshotMode` actually suppress the selection in the editor content, which it never did in any engine.

The rule was authored as `[data-snapshot-mode] *`, and inside a Svelte `<style>` a bare `*` compiles to `:where(.svelte-…)` — so the descendant half could only match elements the component itself rendered. `.milkdown` and `.ProseMirror` are created at runtime by Milkdown with no scope class, so it never applied to them. Chromium looked correct only because Blink inherits `user-select`, which css-ui-4 defines as non-inherited and Gecko implements as such; Firefox reporting `auto` there is the spec-correct value, and is what surfaced this.

`:global(*)` alone is not the whole fix. A real drag inside a snapshot-mode editor selected and repainted in **both** Chromium and Firefox even where `user-select` computed to `none`, because ProseMirror's contenteditable stays selectable regardless. A transparent `::selection` is what makes the surface pixel-stable, which is what the prop documents.

Fixes #1298.
