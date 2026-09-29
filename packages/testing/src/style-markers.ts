/** A CSS fragment and the source stylesheet it proves was included. */
export type StyleMarker = { marker: string; source: string };

/** Returns every marker that no stylesheet contains. */
export function findMissingStyleMarkers(
  stylesheets: ReadonlyMap<string, string>,
  markers: readonly StyleMarker[],
): StyleMarker[] {
  const contents = [...stylesheets.values()];
  return markers.filter(({ marker }) => !contents.some((css) => css.includes(marker)));
}
