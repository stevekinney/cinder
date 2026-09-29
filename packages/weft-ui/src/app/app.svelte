<script lang="ts">
  /**
   * App shell entry point (plan §13 T1.6, design `Weft UI.dc.html`).
   * Owns the boot sequence — read runtime config, construct the initial
   * `HttpClient`, resolve the principal, and either mount `<ApiKeyEntry>`
   * (reject-mode, no/invalid credential) or the real `<Shell>` (sidebar,
   * topbar, notification center, route outlet) once both are final.
   *
   * `<Shell>` is the component that actually calls `provideClient()` /
   * `providePrincipalStore()` — see its module doc for why the rebuild-on
   * -API-key-entry flow has to stay one level above it.
   */
  import type { HttpClient } from '@lostgradient/weft';

  import { Skeleton } from '@lostgradient/cinder';
  import { QueryClientProvider } from '@tanstack/svelte-query';

  import { createClient, setApiKey } from '../lib/client.ts';
  import { readRuntimeConfig, type WeftUiRuntimeConfig } from '../lib/config.ts';
  import { createQueryClient } from '../lib/query.ts';
  import { resolvePrincipal, type Principal } from '../lib/scopes.svelte.ts';
  import ApiKeyEntry from './auth/api-key-entry.svelte';
  import Shell from './shell/shell.svelte';
  import ToastHost from './toast-host.svelte';

  const queryClient = createQueryClient();
  const config: WeftUiRuntimeConfig = readRuntimeConfig();

  type BootPhase =
    | { readonly status: 'resolving' }
    | { readonly status: 'needs-api-key' }
    | { readonly status: 'ready'; readonly client: HttpClient; readonly principal: Principal };

  let phase = $state<BootPhase>({ status: 'resolving' });

  $effect(() => {
    let cancelled = false;
    const initialClient = createClient(config);

    void resolvePrincipal(initialClient).then(
      (principal) => {
        if (cancelled) return undefined;
        phase =
          principal === null
            ? { status: 'needs-api-key' }
            : { status: 'ready', client: initialClient, principal };
        return undefined;
      },
      () => {
        // A non-auth failure (network error, 500) from the boot probe isn't
        // one of the two documented boot states — fail open into the
        // unauthenticated-mode path so the shell still mounts and the real
        // surfaces (backed by <FaultBoundary>/query error handling) report
        // the underlying problem instead of the boot sequence hanging.
        if (cancelled) return undefined;
        phase = {
          status: 'ready',
          client: initialClient,
          principal: { scopes: [], unauthenticatedAccess: null },
        };
        return undefined;
      },
    );

    return () => {
      cancelled = true;
    };
  });

  async function onApiKeySubmit(apiKey: string): Promise<void> {
    const client = setApiKey(config, apiKey);
    const principal = await resolvePrincipal(client);
    if (principal === null) {
      throw new Error('This API key was not accepted.');
    }
    phase = { status: 'ready', client, principal };
  }

  function onAuthExpired(expiredClient: HttpClient): void {
    if (phase.status !== 'ready' || phase.client !== expiredClient) return;
    queryClient.clear();
    phase = { status: 'needs-api-key' };
  }
</script>

<QueryClientProvider client={queryClient}>
  {#if phase.status === 'ready'}
    <Shell client={phase.client} initialPrincipal={phase.principal} {onAuthExpired} />
  {:else if phase.status === 'needs-api-key'}
    <ApiKeyEntry onSubmit={onApiKeySubmit} />
  {:else}
    <div
      class="weft-shell-boot-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading Weft UI"
    >
      <Skeleton height="100vh" radius="0" />
    </div>
  {/if}
  <ToastHost />
</QueryClientProvider>
