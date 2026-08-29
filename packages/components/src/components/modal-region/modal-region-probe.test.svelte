<script lang="ts">
  import type { ModalApi } from '../../_internal/modal-context.ts';
  import { useModal } from '../../utilities/use-modal.ts';

  let { onReady }: { onReady: (api: ModalApi) => void } = $props();
  const api = useModal();

  $effect(() => {
    onReady(api);
  });
</script>
