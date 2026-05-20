/**
 * Fixture: HTML attributes accessed through TypeScript utility types.
 *
 * `Pick<>` and `Partial<>` produce mapped types whose properties retain
 * a reference to the original declaration site. The filter must still
 * recognise them as inherited from svelte/elements.
 */
import type { HTMLButtonAttributes } from 'svelte/elements';

export type MappedUtilityProps = Pick<HTMLButtonAttributes, 'id' | 'name'> &
  Partial<Pick<HTMLButtonAttributes, 'disabled'>> & {
    /** Cinder-specific prop. */
    tone?: 'neutral' | 'accent';
  };
