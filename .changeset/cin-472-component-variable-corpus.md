---
'@lostgradient/cinder': minor
---

Model 22 more components' public custom-property surface in the DTCG token corpus, alongside the existing `Button` and `Toggle` entries: `AccordionItem`, `ActionRow`, `Alert`, `AvatarGroup`, `Card`, `Carousel`, `CodeBlock`, `DataTable`, `FeedEvent`, `FileUpload`, `KanbanBoard`, `Marquee`, `Modal`, `SelectableRow`, `SideNavigation`, `Spinner`, `Statistic`, `StatisticGroup`, `StatusDot`, `TableOfContents`, `Tree`, and `VirtualList`.

Every corpus token added here already existed as a component-owned CSS custom property (documented in each component's `README.md` and `*.variables.json`) — this change adds `$description`, `category`, and a `component` extension for each in `registry.generated.json`, emits its default value as a `:root` declaration in `tokens-base.css` (matching the existing `Button`/`Toggle` pattern, not a documentation-only shadow of the hand-authored component CSS), and documents it in a new "Component tokens" section of `docs/tokens.md`. No existing custom property's default value changes.

`--cinder-marquee-play-state` is deliberately excluded: it is `Marquee`'s own hover/focus/manual-pause/ready state channel (a CSS custom property used as lightweight internal state wiring, not a theming knob), so its four declarations in `marquee.css` are now marked `@runtime-state` and it no longer appears in `marquee.variables.json`.

`check:component-variable-registry` (CIN-32) is tightened from reporting components the corpus does not yet model to failing on them by default (`--report-only` restores the old warning-only behavior for local iteration) — every component that ships a non-empty `*.variables.json` manifest now has a matching corpus entry.
