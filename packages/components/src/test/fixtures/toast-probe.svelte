<script lang="ts" module>
  import type { ToastApi } from '../../_internal/toast-context.ts';

  /**
   * Test-only child component: reads useToast() from its own context (which is
   * a descendant of ToastRegion's setContext call) and hands the API to the
   * test via onReady. Snippets capture lexical scope, so this has to be a
   * real component — not a snippet — to inherit the right context.
   */
  export type ToastProbeProps = {
    onReady: (api: ToastApi) => void;
  };
</script>

<script lang="ts">
  import { useToast } from '../../utilities/use-toast.ts';

  let { onReady }: ToastProbeProps = $props();

  // useToast() must run during this component's setup, when getContext walks
  // the parent chain and finds ToastRegion's context.
  const api = useToast();
  // Hand the api to the test once mounted.
  $effect(() => {
    onReady(api);
  });
</script>
