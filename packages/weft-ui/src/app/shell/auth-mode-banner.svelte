<script lang="ts">
  /**
   * Unauthenticated-mode banner (plan §6, §10; design `Weft UI.dc.html`
   * "auth-mode banner"): `warn`/`allow` variants from the scopes module's
   * `PrincipalStore.bannerMode`. `auth-required`/`none` render nothing here
   * — `auth-required` is handled by mounting `<ApiKeyEntry>` in place of the
   * shell (`../app.svelte`), and `none` (a normally authenticated principal)
   * has nothing to announce.
   */
  import { TriangleAlert, X } from 'lucide-svelte';

  import type { BannerMode } from '../../lib/scopes.svelte.ts';

  interface AuthModeBannerProps {
    mode: BannerMode;
  }

  let { mode }: AuthModeBannerProps = $props();

  let dismissed = $state(false);

  // Copy corrected against the actual per-request behavior (`scopes.svelte.ts`
  // module doc): the server issues an anonymous principal with ZERO scopes
  // regardless of `warn` vs `allow` — only `access: 'public'` operations
  // (mostly workflow reads and single-item actions) actually succeed
  // uncredentialed; scoped/authenticated operations still 401/403. The
  // previous "all operations are accessible" wording overclaimed access this
  // banner's own page can visibly contradict (e.g. a "authentication
  // required" schedule/worker/review card next to it).
  const COPY: Readonly<Record<'unauthenticated-warn' | 'unauthenticated-allow', string>> = {
    'unauthenticated-warn':
      "Running without authentication. Public workflow reads are open; other operations require scopes this session doesn't have.",
    'unauthenticated-allow':
      "Running without authentication by deployment choice. Public workflow reads are open; other operations require scopes this session doesn't have.",
  };

  $effect(() => {
    // A mode change (e.g. re-resolving the principal after an API-key
    // entry) should re-show the banner rather than keep a stale dismissal.
    void mode;
    dismissed = false;
  });
</script>

{#if !dismissed && (mode === 'unauthenticated-warn' || mode === 'unauthenticated-allow')}
  <div
    class="weft-shell-auth-banner"
    data-variant={mode === 'unauthenticated-warn' ? 'warn' : 'allow'}
  >
    <TriangleAlert aria-hidden="true" size={15} class="weft-shell-auth-banner__icon" />
    <span>{COPY[mode]}</span>
    <button
      type="button"
      class="weft-shell-icon-button weft-shell-auth-banner__dismiss"
      aria-label="Dismiss"
      onclick={() => (dismissed = true)}
    >
      <X aria-hidden="true" size={14} />
    </button>
  </div>
{/if}
