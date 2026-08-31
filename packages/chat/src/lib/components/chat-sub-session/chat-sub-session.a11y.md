# ChatSubSession design and accessibility review

## Design review

The nearest neighbours are a full `Chat` surface and a tool-call disclosure. The component exists for inline child-session transcripts that need real message semantics without the parent Chat's composer, navigation, or full-height layout. Review outcome: approved as a reduced, bounded transcript shell that delegates row semantics to `ChatMessage` and keeps custom rendering available through the `row` snippet.

## Accessibility review

The child transcript is a labelled `role="log"`; live announcements are opt-in through `live` and otherwise disabled. Default rows retain their message-role labelling and receive per-instance identifiers so simultaneous or parent/child transcripts cannot collide. The viewport remains keyboard-scrollable through native overflow behavior, contains no new focus-management trap, and honors reduced-motion preferences for the optional live-state animation.
