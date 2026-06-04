import Radio from '../_radio/radio.svelte';
import './radio-group.css';
import RadioGroupRoot from './radio-group.svelte';

/**
 * `RadioGroup` is the parent compound component and a namespace exposing
 * `RadioGroup.Option` — a single radio choice. Option reads RadioGroup's
 * context and throws if rendered outside a group, so it is namespace-only:
 * there is no standalone `@lostgradient/cinder/radio` import, because a lone radio is
 * semantically meaningless and would throw at runtime. (Checkbox, by contrast,
 * is a legitimate standalone control and keeps its own export.)
 */
const RadioGroup = Object.assign(RadioGroupRoot, {
  Option: Radio,
});

export default RadioGroup;
export type { RadioGroupContext, RadioGroupProps } from './radio-group.types.ts';
// RadioGroup.Option is namespace-only; re-export its prop type so consumers can
// type an Option wrapper without reaching into the internal _radio directory.
export type { RadioProps } from '../_radio/radio.types.ts';
export { RadioGroup };
