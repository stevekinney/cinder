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
  import { cn } from '../../utilities/class-names.ts';

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
  class={cn('cinder-label', className)}
  data-disabled={disabled || undefined}
  {...rest}
>
  {@render children()}
  {#if required}
    <!-- Decorative — accessible name comes from the field's `required` attribute. -->
    <span class="cinder-label__required" aria-hidden="true"></span>
  {/if}
</label>
