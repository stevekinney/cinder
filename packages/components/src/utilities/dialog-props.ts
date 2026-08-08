/**
 * Shared cancel vocabulary for the two label-driven dialogs (AlertDialog,
 * ConfirmDialog). One declaration, one wording — the dialogs keep their own
 * RENDERING semantics (AlertDialog renders no cancel button when the label is
 * omitted; ConfirmDialog always renders one, defaulting to "Cancel"), which
 * each documents on its own Props type.
 *
 * Label props stay strings deliberately: a modal dialog's two buttons
 * genuinely are text, and the component owns focus order and destructive
 * styling. Lives in utilities/ (like the `html-element-types.ts` shared
 * vocabulary) because the contract is owned by neither dialog.
 */
export type DialogCancelProps = {
  /**
   * Label for the cancel button. Each dialog `Omit`s this member and
   * re-declares it with its own rendering and default semantics so the
   * generated schema and README carry the dialog-specific documentation;
   * the declaration here exists only to keep the shared vocabulary
   * (name + type) in one place.
   */
  cancelLabel?: string;
  /** Called when the user cancels (cancel button, Escape, or backdrop per the dialog's policy). */
  onCancel?: () => void;
};
