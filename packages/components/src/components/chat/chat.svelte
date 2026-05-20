<script lang="ts" module>
  export type { ChatProps } from './chat.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import ChatImplementation from './container/chat.svelte';
  import type { ChatProps } from './chat.types.ts';

  let { class: className, ...rest }: ChatProps = $props();

  const mergedClassName = $derived(classNames(className));
</script>

<ChatImplementation class={mergedClassName} {...rest} />
