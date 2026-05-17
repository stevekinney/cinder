# Recipes

Short, copy-paste-ready patterns that compose existing Cinder primitives but do not warrant a dedicated component. Each recipe documents an accessibility or integration pattern, the underlying primitives it uses, and the pitfalls that catch teams off-guard the first time.

The list will grow as the component set matures. Today:

- [Skip link](./skip-link.md): the "Skip to main content" pattern built on `<VisuallyHidden focusable>` and the `.cinder-sr-only-focusable` utility class.
