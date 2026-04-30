<script lang="ts" module>
  import type { ChatProps as ChatImplementationProps } from './chat/container/chat.svelte';

  export type ChatProps = ChatImplementationProps;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';
  import ChatImplementation from './chat/container/chat.svelte';

  let { class: className, ...rest }: ChatProps = $props();

  const mergedClassName = $derived(classNames(className));
</script>

<ChatImplementation class={mergedClassName} {...rest} />
