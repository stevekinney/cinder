<script lang="ts">
  import type { TerminalOutputProps } from './terminal-output.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { parseTerminalOutput } from './terminal-output-parser.ts';
  let { class: className, value = '', children, ...rest }: TerminalOutputProps = $props();
  const lines = $derived(parseTerminalOutput(value));
</script>

<div
  {...rest}
  class={classNames('cinder-terminal-output', className)}
  role="log"
  aria-live="polite"
>
  {#each lines as line, i}<div class="cinder-terminal-output__line" data-line={i}>
      {#each line as run}<span data-foreground={run.foreground} data-bold={run.bold || undefined}
          >{run.text}</span
        >{/each}
    </div>{/each}{#if !value && children}{@render children()}{/if}
</div>
