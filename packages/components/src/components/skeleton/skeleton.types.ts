/** Props for the Skeleton component. */
export type SkeletonProps = {
  /** CSS width value applied as an inline style on the skeleton block (e.g. `'200px'`, `'100%'`). */
  width?: string;
  /** CSS height value applied as an inline style on the skeleton block (e.g. `'1rem'`, `'48px'`). */
  height?: string;
  /** CSS border-radius value applied as an inline style, overriding the default pill shape (e.g. `'4px'`, `'50%'`). */
  radius?: string;
  /** Additional class merged onto the `.cinder-skeleton` root element. */
  class?: string;
};
