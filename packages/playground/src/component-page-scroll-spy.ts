/**
 * Pure scroll-spy helpers for the component documentation page.
 *
 * The active-section calculation is split out from the Svelte component so it
 * can be unit-tested without a real layout: feed it section offsets and the
 * scroll position, assert which section id is active. The component only wires
 * the listener and supplies `getBoundingClientRect`-derived numbers.
 */

/** A section's id paired with its top offset from the top of the document. */
export type SectionOffset = {
  id: string;
  /** Distance from the document top to the section's top edge, in pixels. */
  top: number;
};

/**
 * Determine which section is "active" given the current scroll position.
 *
 * A section is active when its top has scrolled above an activation line
 * (`scrollY + activationLine`). The last section whose top is at or above that
 * line wins. When the viewport has reached the bottom of the document, the
 * final section is forced active so the last (often short) section can light up
 * even if its top never crosses the line.
 *
 * @param sections - Section offsets in document order. Must be non-empty.
 * @param scrollY - Current vertical scroll position (`window.scrollY`).
 * @param viewportHeight - Visible viewport height (`window.innerHeight`).
 * @param documentHeight - Full scrollable document height (`body.scrollHeight`).
 * @param activationLine - Offset below the viewport top where activation occurs
 *   (typically the sticky top bar height plus a little breathing room).
 * @returns The id of the active section, or `null` when `sections` is empty.
 */
export function computeActiveSection(
  sections: SectionOffset[],
  scrollY: number,
  viewportHeight: number,
  documentHeight: number,
  activationLine: number,
): string | null {
  if (sections.length === 0) return null;

  // Bottom of the page: the last section wins regardless of its top.
  if (scrollY + viewportHeight >= documentHeight - 4) {
    return sections[sections.length - 1]!.id;
  }

  const line = scrollY + activationLine;
  let active = sections[0]!.id;
  for (const section of sections) {
    if (section.top <= line) active = section.id;
  }
  return active;
}
