<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Compact chip that identifies a source file and optional line and column.
   * @tag code-location
   * @useWhen Showing a source location beside an error, review comment, or code reference.
   * @avoidWhen Displaying editable source code.
   * @rationale Nearest alternative: Chip — CodeLocation owns canonical file/line formatting.
   */
  export type { CodeLocationProps } from './code-location.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { CodeLocationProps } from './code-location.types.ts';

  let {
    file,
    line,
    column,
    class: customClassName,
    children,
    ...rest
  }: CodeLocationProps = $props();
  const location = $derived(
    `${file}${line === undefined ? '' : `:${line}${column === undefined ? '' : `:${column}`}`}`,
  );
</script>

<span class={classNames('cinder-code-location', customClassName)} {...rest}
  ><code>{location}</code>{#if children}{@render children()}{/if}</span
>
