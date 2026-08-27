---
'@lostgradient/cinder': minor
---

**Breaking: design token names are normalized, with no compatibility aliases.** Every `--cinder-*` custom property listed below is renamed. Update any stylesheet, component, or theme override that references an old name — the old names are gone, not deprecated.

The pre-1.0 packages use a `minor` bump for breaking changes, per [`.changeset/README.md`](../.changeset/README.md).

### Why

Three rules the corpus broke in places:

- **A bare domain carries no role.** `--cinder-danger` could mean the fill, the text, or the border depending on where you used it.
- **`color.*` classifies by type rather than intent.** Every token is a color or is not; the namespace said nothing about what the token is for.
- **`bg` and `fg` are CSS-derived abbreviations** that describe a usage rather than a meaning.

### Renamed

| Old                              | New                                    |
| -------------------------------- | -------------------------------------- |
| `--cinder-accent`                | `--cinder-accent-solid`                |
| `--cinder-accent-active`         | `--cinder-accent-solid-active`         |
| `--cinder-accent-active-on-fill` | `--cinder-accent-solid-active-on-fill` |
| `--cinder-accent-hover`          | `--cinder-accent-solid-hover`          |
| `--cinder-bg`                    | `--cinder-surface-canvas`              |
| `--cinder-button-bg`             | `--cinder-button-background`           |
| `--cinder-button-fg`             | `--cinder-button-foreground`           |
| `--cinder-color-accent-bg`       | `--cinder-accent-background`           |
| `--cinder-color-accent-border`   | `--cinder-accent-border`               |
| `--cinder-color-checker-base`    | `--cinder-checker-base`                |
| `--cinder-color-checker-tile`    | `--cinder-checker-tile`                |
| `--cinder-color-danger-bg`       | `--cinder-status-danger-background`    |
| `--cinder-color-danger-border`   | `--cinder-status-danger-border`        |
| `--cinder-color-danger-fg`       | `--cinder-status-danger-text`          |
| `--cinder-color-danger-muted`    | `--cinder-status-danger-muted`         |
| `--cinder-color-danger-subtle`   | `--cinder-status-danger-subtle`        |
| `--cinder-color-info-bg`         | `--cinder-status-info-background`      |
| `--cinder-color-info-border`     | `--cinder-status-info-border`          |
| `--cinder-color-info-fg`         | `--cinder-status-info-text`            |
| `--cinder-color-info-muted`      | `--cinder-status-info-muted`           |
| `--cinder-color-info-subtle`     | `--cinder-status-info-subtle`          |
| `--cinder-color-neutral-bg`      | `--cinder-status-neutral-background`   |
| `--cinder-color-neutral-border`  | `--cinder-status-neutral-border`       |
| `--cinder-color-neutral-fg`      | `--cinder-status-neutral-text`         |
| `--cinder-color-success-bg`      | `--cinder-status-success-background`   |
| `--cinder-color-success-border`  | `--cinder-status-success-border`       |
| `--cinder-color-success-fg`      | `--cinder-status-success-text`         |
| `--cinder-color-success-muted`   | `--cinder-status-success-muted`        |
| `--cinder-color-success-subtle`  | `--cinder-status-success-subtle`       |
| `--cinder-color-warning-bg`      | `--cinder-status-warning-background`   |
| `--cinder-color-warning-border`  | `--cinder-status-warning-border`       |
| `--cinder-color-warning-fg`      | `--cinder-status-warning-text`         |
| `--cinder-color-warning-muted`   | `--cinder-status-warning-muted`        |
| `--cinder-color-warning-subtle`  | `--cinder-status-warning-subtle`       |
| `--cinder-danger`                | `--cinder-status-danger-solid`         |
| `--cinder-danger-active`         | `--cinder-status-danger-solid-active`  |
| `--cinder-danger-contrast`       | `--cinder-status-danger-contrast`      |
| `--cinder-danger-hover`          | `--cinder-status-danger-solid-hover`   |
| `--cinder-duration`              | `--cinder-duration-base`               |
| `--cinder-info`                  | `--cinder-status-info-solid`           |
| `--cinder-info-active`           | `--cinder-status-info-solid-active`    |
| `--cinder-info-contrast`         | `--cinder-status-info-contrast`        |
| `--cinder-info-hover`            | `--cinder-status-info-solid-hover`     |
| `--cinder-success`               | `--cinder-status-success-solid`        |
| `--cinder-success-active`        | `--cinder-status-success-solid-active` |
| `--cinder-success-contrast`      | `--cinder-status-success-contrast`     |
| `--cinder-success-hover`         | `--cinder-status-success-solid-hover`  |
| `--cinder-text`                  | `--cinder-text-default`                |
| `--cinder-warning`               | `--cinder-status-warning-solid`        |
| `--cinder-warning-active`        | `--cinder-status-warning-solid-active` |
| `--cinder-warning-contrast`      | `--cinder-status-warning-contrast`     |
| `--cinder-warning-hover`         | `--cinder-status-warning-solid-hover`  |

### Renamed token paths

These are the keys of the published token artifacts — `@lostgradient/cinder/tokens/resolved/*`, the unresolved corpus documents, and `TOKEN_REGISTRY` — so code that reads a token by its DTCG path needs updating too, not just CSS that references a custom property.

| Old path                   | New path                      |
| -------------------------- | ----------------------------- |
| `accent`                   | `accent.solid`                |
| `accent.active`            | `accent.solid.active`         |
| `accent.active.on-fill`    | `accent.solid.active.on-fill` |
| `accent.hover`             | `accent.solid.hover`          |
| `background`               | `surface.canvas`              |
| `color.accent.background`  | `accent.background`           |
| `color.accent.border`      | `accent.border`               |
| `color.checker.base`       | `checker.base`                |
| `color.checker.tile`       | `checker.tile`                |
| `color.danger.background`  | `status.danger.background`    |
| `color.danger.border`      | `status.danger.border`        |
| `color.danger.foreground`  | `status.danger.text`          |
| `color.danger.muted`       | `status.danger.muted`         |
| `color.danger.subtle`      | `status.danger.subtle`        |
| `color.info.background`    | `status.info.background`      |
| `color.info.border`        | `status.info.border`          |
| `color.info.foreground`    | `status.info.text`            |
| `color.info.muted`         | `status.info.muted`           |
| `color.info.subtle`        | `status.info.subtle`          |
| `color.neutral.background` | `status.neutral.background`   |
| `color.neutral.border`     | `status.neutral.border`       |
| `color.neutral.foreground` | `status.neutral.text`         |
| `color.success.background` | `status.success.background`   |
| `color.success.border`     | `status.success.border`       |
| `color.success.foreground` | `status.success.text`         |
| `color.success.muted`      | `status.success.muted`        |
| `color.success.subtle`     | `status.success.subtle`       |
| `color.warning.background` | `status.warning.background`   |
| `color.warning.border`     | `status.warning.border`       |
| `color.warning.foreground` | `status.warning.text`         |
| `color.warning.muted`      | `status.warning.muted`        |
| `color.warning.subtle`     | `status.warning.subtle`       |
| `danger`                   | `status.danger.solid`         |
| `danger.active`            | `status.danger.solid.active`  |
| `danger.contrast`          | `status.danger.contrast`      |
| `danger.hover`             | `status.danger.solid.hover`   |
| `info`                     | `status.info.solid`           |
| `info.active`              | `status.info.solid.active`    |
| `info.contrast`            | `status.info.contrast`        |
| `info.hover`               | `status.info.solid.hover`     |
| `motion`                   | `motion.base`                 |
| `success`                  | `status.success.solid`        |
| `success.active`           | `status.success.solid.active` |
| `success.contrast`         | `status.success.contrast`     |
| `success.hover`            | `status.success.solid.hover`  |
| `text`                     | `text.default`                |
| `warning`                  | `status.warning.solid`        |
| `warning.active`           | `status.warning.solid.active` |
| `warning.contrast`         | `status.warning.contrast`     |
| `warning.hover`            | `status.warning.solid.hover`  |

### Merged

| Removed                    | Use instead            |
| -------------------------- | ---------------------- |
| `--cinder-color-accent-fg` | `--cinder-accent-text` |

The same merge removes a DTCG path:

| Removed path              | Use instead   |
| ------------------------- | ------------- |
| `color.accent.foreground` | `accent.text` |

`--cinder-color-accent-fg` was a pure alias of `--cinder-accent-text` in the base set and in both theme documents, with no context overriding it independently, so it folds into the token it aliased rather than being renamed.

### Not changed

The solid and soft status families both survive. `--cinder-status-danger-solid` is the opaque fill that carries a contrast label; `--cinder-status-danger-background` is the soft tinted surface. They serve different purposes, so neither replaces the other — they simply now share one `status.danger.*` domain.
