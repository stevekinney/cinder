# ChatNavigationRail design and accessibility review

## Design review

The nearest neighbours are `Chat`'s jump-to-latest control and document outline navigation. The rail exists because long transcripts need direct navigation between user-authored turns plus continuous pointer scrubbing; neither neighbour supplies that interaction. Review outcome: approved as a narrow companion surface with bounded overflow, CSS-only proximity falloff, and no duplicate transcript content.

## Accessibility review

Focus remains on the rail button activated by keyboard; navigation scrolls the transcript without moving focus. Tab and Shift+Tab traverse each user-turn button, Enter and Space activate the focused button, and pointer down/move/up scrub without creating an additional keyboard mode. Exactly one visible user turn receives `aria-current`, each button is described by its per-instance preview, and the navigation landmark has a consumer-overridable accessible label. The component does not add a live region because repeated scrub announcements would be disruptive; the current-state and preview relationships provide the assistive-technology announcement contract.
