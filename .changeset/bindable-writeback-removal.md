---
'@lostgradient/cinder': minor
---

Remove write-back $effects from rating, pin-input, chat, and image-lightbox; fix schema-form schema-change reset.

**No-write-back contract for rating and pin-input.** The `value` bindable in `Rating` and `PinInput` is no longer mutated back to the normalized/filtered value. The displayed and submitted value is derived internally via `$derived`, but the bound prop reflects exactly what the consumer set. Consumers relying on the binding being silently normalized should read from `onchange` instead.

**Chat scroll/unread bindables now update via explicit callbacks.** The `isAtBottom`, `unreadCount`, and `hasNewMessageIndicator` bindables are maintained through the existing `onscrollstatechange`, `onunreadindicatorchange`, and `onReachBottom` callback paths — no $effect write-back. The `handleSubmit` path now also writes `isAtBottom = true` after `scrollState.setIsAtBottom(true)` so the binding stays current after the user sends a message.

**SchemaForm schema-change now genuinely resets form state.** The internal form body has been extracted into a child component (`schema-form-body.svelte`). The outer component renders `{#key schema}<SchemaFormBody />` so that changing `schema` destroys and recreates the child — causing genuine `$state` recreation (formValue, errors, rawDrafts, arrayKeys, serializedValue) rather than only DOM reconciliation. Changing `value` with the same schema does NOT reset the form (seed-only contract, documented on the prop).

**image-lightbox index reset.** The `previousOpen $state + $effect` write-back is replaced by a `navigationIndex` (null = no navigation yet) with `effectiveIndex = $derived(navigationIndex ?? clampedInitialIndex)`. Calling `close()` resets `navigationIndex` to null so the next open starts at `initialIndex` without any $effect.
