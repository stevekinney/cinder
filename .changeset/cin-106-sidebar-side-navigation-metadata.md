---
'@lostgradient/cinder': patch
---

Add reciprocal `@avoidWhen` metadata to `Sidebar` and `SideNavigation` pointing at each other, and link both READMEs to the `docs/decisions/side-navigation-vs-sidebar.md` decision now that it is Accepted. Both components remain public and unchanged in behavior; this only clarifies the boundary between the responsive shell (`Sidebar`) and the accessibility-focused nav landmark (`SideNavigation`) in generated component metadata.
