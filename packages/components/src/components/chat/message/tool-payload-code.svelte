<script lang="ts" module>
  export type ToolPayloadCodeProps = {
    /** Structured payload text to render. */
    code: string;
    /** Additional CSS class. */
    class?: string;
  };
</script>

<script lang="ts">
  import CodeBlock from '../../code-block/code-block.svelte';
  import { classNames } from '../../../utilities/class-names.ts';

  let { code, class: className }: ToolPayloadCodeProps = $props();
</script>

<div class={classNames('tool-payload-code', className)}>
  <CodeBlock {code} language="json" />
</div>

<style>
  .tool-payload-code {
    inline-size: max-content;
    min-inline-size: min(18rem, 100%);
    max-inline-size: 100%;
  }

  .tool-payload-code :global(.cinder-code-block) {
    inline-size: 100%;
  }

  /* Cap tall payloads so a large arguments/result blob scrolls in place instead
   * of dominating the transcript. The viewport already owns overflow-x and is
   * focusable (tabindex=0), so adding a block-axis cap here keeps it keyboard-
   * scrollable on both axes without nesting scroll containers. Matches the
   * reasoning block's scroll region cap. */
  .tool-payload-code :global(.cinder-code-block__viewport) {
    max-block-size: 16rem;
    overflow-y: auto;
  }
</style>
