<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Context provider that identifies the desktop host platform while defaulting to inert web behavior.
   * @tag desktop
   * @tag provider
   * @useWhen A desktop shell needs platform-aware window chrome behavior in descendant components.
   * @avoidWhen The application is web-only and does not render desktop window chrome.
   * @related modal
   */
  export type { HostPlatform, HostProviderProps } from './host-provider.types.ts';
</script>

<script lang="ts">
  import { setHostContext } from '../../_internal/host-context.ts';
  import type { HostProviderProps } from './host-provider.types.ts';

  let {
    platform = 'web',
    safeHeaderLeft = '0px',
    safeHeaderRight = '0px',
    children,
  }: HostProviderProps = $props();

  setHostContext({
    get platform() {
      return platform;
    },
    get isDesktop() {
      return platform !== 'web';
    },
  });
</script>

<div
  class="cinder-host-provider"
  data-cinder-host-platform={platform}
  style:--spacing-token-safe-header-left={safeHeaderLeft}
  style:--spacing-token-safe-header-right={safeHeaderRight}
>
  {@render children?.()}
</div>
