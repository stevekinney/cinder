<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status alpha
   * @purpose Render a read-only terminal stream with a bounded subset of ANSI SGR color and line-rewrite behavior.
   * @tag terminal
   * @tag ansi
   * @tag output
   * @useWhen Showing command output or logs that include basic ANSI styling and carriage-return progress updates.
   * @avoidWhen Hosting an interactive real PTY — use terminal-frame.
   * @related terminal-frame, code-block
   */
  export type {
    TerminalForeground,
    TerminalLine,
    TerminalOutputProps,
    TerminalTextRun,
  } from './terminal-output.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { TerminalOutputProps } from './terminal-output.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { TerminalOutputParser } from './terminal-output-parser.ts';
  let {
    class: className,
    value = '',
    followLatest = $bindable(true),
    'aria-label': ariaLabel = 'Terminal output',
    children,
    ...rest
  }: TerminalOutputProps = $props();
  const parser = new TerminalOutputParser();
  let parsedPrefix = '';
  const lines = $derived.by(() => {
    if (!value.startsWith(parsedPrefix)) {
      parser.reset();
      parsedPrefix = '';
    }
    parser.append(value.slice(parsedPrefix.length));
    parsedPrefix = value;
    return parser.lines();
  });

  let viewport: HTMLDivElement;
  let content: HTMLDivElement;
  let programmaticScroll = false;

  function isAtBottom(element: HTMLElement) {
    return element.scrollHeight - element.scrollTop - element.clientHeight < 2;
  }

  function scrollToLatest() {
    if (!viewport || isAtBottom(viewport)) return;
    programmaticScroll = true;
    viewport.scrollTop = viewport.scrollHeight;
    void tick().then(() => {
      programmaticScroll = false;
    });
  }

  function handleScroll(event: Event) {
    if (programmaticScroll) return;
    const target = event.currentTarget as HTMLElement;
    followLatest = isAtBottom(target);
  }

  // Observe both the rendered output and viewport. This preserves the user's
  // reading position while still anchoring an actively-followed stream when
  // lines append or the available viewport height changes.
  $effect(() => {
    const output = content;
    const scrollViewport = viewport;
    if (!output || !scrollViewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (followLatest) scrollToLatest();
    });
    observer.observe(output);
    observer.observe(scrollViewport);
    return () => observer.disconnect();
  });

  let wasFollowing = followLatest;
  $effect(() => {
    const isFollowing = followLatest;
    if (isFollowing && !wasFollowing) scrollToLatest();
    wasFollowing = isFollowing;
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  {...rest}
  class={classNames('cinder-terminal-output', className)}
  role="log"
  aria-label={ariaLabel}
  aria-live="polite"
  tabindex="0"
  onscroll={handleScroll}
  bind:this={viewport}
>
  <div class="cinder-terminal-output__content" bind:this={content}>
    {#if value}
      {#each lines as line, i}<div class="cinder-terminal-output__line" data-line={i}>
          {#each line as run}<span
              data-cinder-foreground={run.foreground}
              data-cinder-bold={run.bold || undefined}>{run.text}</span
            >{/each}
        </div>{/each}
    {:else if children}{@render children()}{/if}
  </div>
</div>
