<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Standalone label primitive that associates text with a custom control via for and matches the visual treatment of built-in inputs.
   * @tag form
   * @tag primitive
   * @useWhen Building a hand-rolled field that wraps multiple inputs needing one shared label.
   * @useWhen Matching the disabled or required visual treatment of cinder inputs on a custom control.
   * @avoidWhen Labelling a built-in input that already renders its own label prop — pass label instead.
   * @related form-field, input, checkbox, radio-group
   */
  export type { LabelProps } from './label.types.ts';
</script>

<script lang="ts">
  import type { LabelProps } from './label.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    for: forId,
    required = false,
    disabled = false,
    class: className,
    children,
    ...rest
  }: LabelProps = $props();
</script>

<label
  for={forId}
  class={classNames('cinder-label', className)}
  data-disabled={disabled || undefined}
  {...rest}
>
  {@render children()}
  {#if required}
    <!-- Visible asterisk conveys "required" by shape, not color alone (WCAG
         1.4.1). aria-hidden so the accessible name stays clean — the field's
         own `required`/`aria-required` attribute is the single AT signal. -->
    <span class="cinder-_required-marker" aria-hidden="true">*</span>
  {/if}
</label>
