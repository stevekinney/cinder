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
the recycled rows, and never unmounts while the chat is alive; a `focusout`
backstop reclaims focus if a row is unmounted from under it. Home had the same
defect and the same fix.
