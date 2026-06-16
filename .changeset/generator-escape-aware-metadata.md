---
'@lostgradient/cinder': patch
---

Fix the component-example generator's metadata extraction so escaped delimiters
and line continuations inside an example's `title`/`description` string literal
no longer truncate the value or leak the `<script module>` block into the
published `code` field (#420). The extraction grammar is now escape-aware and
the parsed value is decoded to its true string. No existing example artifact
changes — this only affects future examples whose metadata contains an escape
sequence.
