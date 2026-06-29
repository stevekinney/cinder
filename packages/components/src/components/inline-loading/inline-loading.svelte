<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status alpha
   * @purpose Inline async-action status indicator that transitions from loading to success or error with accessible announcements.
   * @tag async
   * @tag feedback
   * @tag loading
   * @tag status
   * @useWhen Showing a compact Submit -> loading -> success/error lifecycle beside a button or form row.
   * @useWhen Communicating short-lived async state transitions without reserving large layout space.
   * @avoidWhen Showing indeterminate work without success/error transitions — use spinner.
   * @avoidWhen Reporting static non-loading status in dense lists — use status-dot.
   * @related spinner, status-dot
   */
  export type { InlineLoadingProps, InlineLoadingStatus } from './inline-loading.types.ts';
</script>

<script lang="ts">
  import Check from 'lucide-svelte/icons/check';
  import X from 'lucide-svelte/icons/x';
  import { classNames } from '../../utilities/class-names.ts';
  import Spinner from '../spinner/spinner.svelte';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';
  import type { InlineLoadingProps, InlineLoadingStatus } from './inline-loading.types.ts';

  const fallbackStatusLabel: Record<Exclude<InlineLoadingStatus, 'inactive'>, string> = {
    active: 'Loading',
    finished: 'Success',
    error: 'Error',
  };

  let {
    status = 'inactive',
    description,
    iconDescription,
    successDelay = 1500,
    class: className,
    ...rest
  }: InlineLoadingProps = $props();

  let visualStatus = $state<InlineLoadingStatus>(status);
  let successTimer: ReturnType<typeof setTimeout> | null = null;

  const normalizedDescription = $derived(description?.trim() ? description.trim() : undefined);
  const normalizedIconDescription = $derived(
    iconDescription?.trim() ? iconDescription.trim() : undefined,
  );
  const fallbackText = $derived(
    visualStatus === 'inactive' ? '' : fallbackStatusLabel[visualStatus],
  );
  const visibleDescription = $derived(
    visualStatus === 'inactive' ? '' : (normalizedDescription ?? fallbackText),
  );
  const spokenDescription = $derived(
    visualStatus === 'inactive'
      ? ''
      : (normalizedDescription ?? normalizedIconDescription ?? fallbackText),
  );
  const announcementMessage = $derived(
    visualStatus === 'inactive'
      ? ''
      : spokenDescription === fallbackText
        ? spokenDescription
        : `${fallbackText}. ${spokenDescription}`,
  );

  function clearSuccessTimer(): void {
    if (successTimer !== null) {
      clearTimeout(successTimer);
      successTimer = null;
    }
  }

  $effect(() => {
    return () => {
      clearSuccessTimer();
    };
  });

  $effect(() => {
    clearSuccessTimer();

    if (status !== 'finished') {
      visualStatus = status;
      return;
    }

    if (!Number.isFinite(successDelay) || successDelay <= 0) {
      visualStatus = 'inactive';
      return;
    }

    visualStatus = 'finished';
    successTimer = setTimeout(() => {
      visualStatus = 'inactive';
      successTimer = null;
    }, successDelay);
  });
</script>

<span
  {...rest}
  class={classNames('cinder-inline-loading', className)}
  data-cinder-status={visualStatus}
  aria-hidden={visualStatus === 'inactive' ? 'true' : undefined}
>
  {#if visualStatus !== 'inactive'}
    <span class="cinder-inline-loading__indicator" aria-hidden="true">
      {#if visualStatus === 'active'}
        <Spinner size="sm" label={spokenDescription} />
      {:else if visualStatus === 'finished'}
        <Check size={14} strokeWidth={2.25} />
      {:else}
        <X size={14} strokeWidth={2.25} />
      {/if}
    </span>
    <span class="cinder-inline-loading__label">{visibleDescription}</span>
  {/if}
</span>

<VisuallyHiddenLiveRegion message={announcementMessage} />
