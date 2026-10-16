---
'@lostgradient/cinder': minor
---

Cinder's icons now come from `@lucide/svelte`, which replaces Lucide's deprecated Svelte package as a dependency.

`@lucide/svelte` icons are Svelte 5 function components, so `IconComponent` is now `Component<IconProps>` instead of the legacy class-component `ComponentType`, and `IconProps` is `@lucide/svelte`'s `LucideProps`: the size, color, stroke width, and SVG attributes every icon accepts. Every icon keeps its export name. `MoreHorizontal` and `Trash2` render Lucide's renamed `ellipsis` and `trash` icons, whose artwork is unchanged. Lucide redrew three icons Cinder renders: `circle-check` (in `Badge` and `ToastRegion`), `calendar-days` (in `DatePicker` and `DateRangeField`), and the exported `CircleDot`. Every icon now also carries a `lucide-icon` class and sets `aria-hidden="true"` unless it is given an `aria-*` attribute, a `role`, a `title`, or children.
