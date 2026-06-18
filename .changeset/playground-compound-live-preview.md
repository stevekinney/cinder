---
'@cinder/playground': patch
---

Fix the Playground live preview for compound components (Accordion, Tabs, …).

The Playground synthesizes a plain-text `children` control seeded with the component's display name, which renders a real labelled instance for text-content components (Badge, Button). For compound components whose `children` must be structured sub-components (`<Accordion.Item>`), that text seed rendered a semantically broken preview — the literal word "Accordion" floating in an empty `.cinder-accordion` shell with no items.

The analyzer now flags compound components (`isCompound`, detected from the sibling `index.ts` `Object.assign(Root, { … })` namespace assembly). For those components the Playground no longer synthesizes a text `children` control and no longer mounts the bare component (which would throw on the required, unsynthesizable `children` snippet). It falls back to the featured-example mount instead — a real composed instance — while the remaining real controls (e.g. Accordion's `multiple`) still drive the copyable snippet. Plain-text components are unaffected.
