<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Explains why a setting is policy-managed, identifies its source, and exposes the policy scope as a badge.
   * @tag form
   * @tag policy
   * @useWhen A control is unavailable because an administrator or policy source owns its value.
   * @avoidWhen A control is unavailable for a temporary or non-policy reason.
   * @related setting-row, badge, tooltip
   */
  export type { PolicyLockProps } from './policy-lock.types.ts';
</script>

<script lang="ts">
  import { Lock } from 'lucide-svelte';
  import Badge from '../badge/badge.svelte';
  import Tooltip from '../tooltip/tooltip.svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import type { PolicyLockProps } from './policy-lock.types.ts';
  let { id, reason, source, scope, class: className, ...rest }: PolicyLockProps = $props();
  const description = $derived(source ? `${reason} Source: ${source}.` : reason);
</script>

<span {...rest} class={classNames('cinder-policy-lock', className)}>
  <Tooltip text={description}>
    <span aria-hidden="true"><Lock size={14} /></span>
  </Tooltip>
  <span {id} class="cinder-sr-only">{description}</span>
  {#if scope}<Badge variant="neutral" size="xs">{scope}</Badge>{/if}
</span>
