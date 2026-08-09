---
'@lostgradient/chat': patch
---

Fix the history-prepend anchoring race when older messages are requested while a guarded programmatic scroll (most commonly a smooth scroll-to-top glide — the top is where the load-earlier trigger lives) is still animating (#1237).

The capture used to snapshot a still-moving viewport, and the glide's smooth-scroll animation — with its absolute target of `scrollTop: 0`, where browsers also suppress native scroll anchoring — then raced Chat's instant restore corrections. Whichever landed last won: the restore could strand the viewport mid-transcript, or the glide could finish at 0 so the visible transcript shifted down by exactly the prepended block's height (with a #911-style overshoot as the third possible interleaving).

`useChatScrollState` guarded scrolls now record their destination, and a new `finishUserScrollGuard()` completes an in-flight guarded scroll instantly at that destination (aborting the browser's animation) — `handleLoadHistory` calls it before capturing, so the capture always snapshots a parked viewport and the restore has nothing left to race. Loading earlier history mid-glide now deterministically parks the viewport at the old top with the previously visible content exactly where it was, the prepended block above it.
