import type { Attachment } from 'svelte/attachments';

/** Preserve the live shared value across native form reset and whole-field copy. */
export function createShareCardField(getValue: () => string) {
  // The value field is a read-only DISPLAY of `value`, not editable form
  // state — it has no `name`, so it was already excluded from submission,
  // but a native form RESET still reverts any descendant control's value to
  // whatever was rendered at mount, regardless of `name`. That would
  // silently blank or stale the field the next time some unrelated form
  // elsewhere on the page (e.g. a "Reset filters" button) resets.
  //
  // Fix: use `Input`'s `inputAttachment` escape hatch to reach the real
  // `<input>` DOM node, find its owning `<form>` (if any) — by `element.form`, which
  // also covers a form the input is associated with by `form="<id>"` rather than
  // nested inside — and
  // re-assert the CURRENT `value` prop back onto it on every native 'reset'.
  // This mirrors `color-picker.svelte`'s established `hiddenInput` +
  // `form.addEventListener('reset', ...)` pattern for the same class of
  // problem (a JS-controlled value that must survive an ambient form reset).
  // The supplied getter reads the live prop at reset-time, so this stays correct
  // even if the value changed since the field last mounted.
  // The rendered value field, captured by the attachment below.
  //
  // `handleFieldCopy` needs the element to inspect the current selection, and takes it
  // from here rather than from `event.target`/`event.currentTarget`: the attachment
  // already owns this element for the form-reset listener, so this adds no new
  // lifecycle, and it does not depend on how a given environment populates a copy
  // event's target (happy-dom, for one, leaves it unset for a synthetic dispatch,
  // which would make the selection guard untestable).
  let valueFieldElement: HTMLInputElement | null = null;

  const valueFieldAttachment: Attachment<HTMLInputElement> = (element) => {
    valueFieldElement = element;
    // `element.form`, not `closest('form')`: an <input> can be associated with a form it
    // is not nested inside, via the `form="<id>"` attribute. `closest()` misses exactly
    // that case, and the reset it misses is the one a consumer had to opt into
    // deliberately.
    const form = element.form;
    if (!form) {
      // Still release the reference on teardown: a field with no ambient form has no
      // reset listener to remove, but it is just as capable of being unmounted.
      return () => {
        if (valueFieldElement === element) valueFieldElement = null;
      };
    }
    function restoreValueAfterReset() {
      // The `reset` event fires BEFORE the controls are cleared — resetting IS its
      // default action — so assigning synchronously here would just be overwritten a
      // moment later. Restore on the microtask after dispatch, once the native reset
      // has actually run.
      queueMicrotask(() => {
        element.value = getValue();
      });
    }
    form.addEventListener('reset', restoreValueAfterReset);
    return () => {
      form.removeEventListener('reset', restoreValueAfterReset);
      if (valueFieldElement === element) valueFieldElement = null;
    };
  };

  // The value field is a single-line `<input>` (via `Input`). A single-line
  // text control SANITIZES line breaks out of what it renders — and, absent
  // this handler, out of what a native browser selection-copy would capture
  // too, since that copy reads the sanitized DOM value, not our JS string.
  // Intercept the field's own `copy` event and always write the exact,
  // unmodified `value` to the clipboard, so selecting the field and pressing
  // Ctrl/Cmd-C is never lossy for a multi-line `value` — it matches what the
  // copy/share action buttons already send (they read `value`/`copyValue`
  // from JS state, never from the DOM, so they were never affected).
  function handleFieldCopy(event: ClipboardEvent) {
    // Only take the copy over when the replacement can actually be written. Calling
    // preventDefault() unconditionally would cancel the native copy even in an
    // environment that exposes no clipboardData, leaving the clipboard untouched —
    // strictly worse than the collapsed line breaks this exists to avoid.
    const { clipboardData } = event;
    if (!clipboardData) return;

    // And only when the WHOLE field is selected. This handler exists because a
    // single-line <input> renders a multi-line `value` with its breaks collapsed, so
    // copying the displayed text would silently lose them. That reasoning covers a
    // select-all; it does not cover a user who highlighted one path segment and expects
    // exactly that segment. Substituting the full value there is a surprise, and the
    // handler is attached for single-line values too, where it has nothing to fix.
    const field = valueFieldElement;
    if (!field) return;
    if (field.selectionStart !== 0 || field.selectionEnd !== field.value.length) return;

    event.preventDefault();
    clipboardData.setData('text/plain', getValue());
  }

  return { attachment: valueFieldAttachment, oncopy: handleFieldCopy };
}
