---
'@lostgradient/chat': patch
---

Keep keyboard shortcuts alive after jumping to the latest message in a
virtualized transcript.

Jump-to-latest focused a message row one tick after scrolling. In a virtualized
transcript that row is a recycled window slot: the virtualizer's next pass
unmounts it, and removing the focused node drops focus to `<body>`. Because the
keydown handler is bound on the container, that killed every shortcut — End,
Home, PageUp/PageDown, arrow navigation, and Ctrl+F search — on the configuration
recommended for long histories.

The selector was independently wrong: `.chat-message-wrapper:last-of-type` matched
every wrapper, since each is the only child of its virtual row, so it focused the
row at the TOP of the window rather than the last message.

Focus now goes to the `.chat-timeline` viewport, which is focusable, sits above
the recycled rows, and never unmounts while the chat is alive. A backstop
re-checks the focused row's connectivity on each scroll-state recompute and
pulls focus back to the timeline if the row was unmounted from under it —
checked on scroll rather than on `focusout`, because a browser removing the
focused node moves focus to `<body>` without reliably dispatching a focus event
from the detached element.

Home had the same defect, but only when virtualized: there the viewport is the
stable target for the same reason. In a plain transcript the rows do not recycle,
so Home still focuses the first message, which scrolls it into view and gives
arrow navigation a starting point.

ArrowUp/ArrowDown now also enter message navigation from the focused viewport,
not only from an already-focused message. Without that, the virtualized Home
above would have been a dead end — it focuses the viewport, and the next arrow
key would have done nothing, leaving no keyboard route into the transcript.
ArrowDown enters at the first rendered message and ArrowUp at the last; arrows
pressed inside a control within a message (approval buttons, suggestion chips)
still belong to that control.
