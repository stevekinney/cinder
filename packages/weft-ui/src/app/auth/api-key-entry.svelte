<script lang="ts">
  /**
   * API-key entry surface for `unauthenticatedAccess: 'reject'` deployments
   * (plan §6, T1.1). The shell mounts this in place of the routed app when
   * boot-time principal resolution 401s with no credential configured — see
   * `src/lib/scopes.svelte.ts`'s `PrincipalStore`/`resolvePrincipal()`
   * (T1.2) and `src/lib/client.ts`'s `setApiKey()` (T1.1).
   *
   * Deliberately callback-driven rather than reaching into `client.ts`/
   * `scopes.svelte.ts` itself: the shell owns rebuilding the client,
   * re-resolving the principal, and re-providing context, all of which need
   * to happen together. This component only ever holds the entered key in
   * local component state — never `localStorage`, never a cookie — and hands
   * it to the caller on submit.
   */
  import { Button, Card, Input } from '@lostgradient/cinder';

  interface ApiKeyEntryProps {
    /**
     * Called with the trimmed, non-empty entered key on submit. Resolve to
     * accept (the shell rebuilds the client and re-resolves the principal);
     * reject/throw with a message to show it as an inline error.
     */
    onSubmit: (apiKey: string) => Promise<void>;
  }

  let { onSubmit }: ApiKeyEntryProps = $props();

  let apiKey = $state('');
  let submitting = $state(false);
  let error = $state<string | undefined>(undefined);

  const trimmedApiKey = $derived(apiKey.trim());

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (trimmedApiKey === '' || submitting) return;

    submitting = true;
    error = undefined;
    try {
      await onSubmit(trimmedApiKey);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Could not verify this API key.';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="weft-ui-api-key-entry">
  <Card
    class="weft-ui-api-key-entry__card"
    title="Authentication required"
    description="This server requires an API key. Enter one with access to the operations you need."
  >
    <form onsubmit={handleSubmit}>
      <Input
        id="weft-ui-api-key"
        type="password"
        label="API key"
        bind:value={apiKey}
        required
        autocomplete="off"
        disabled={submitting}
        {...error !== undefined ? { error } : {}}
      />
      <Button
        type="submit"
        variant="primary"
        fullWidth
        label={submitting ? 'Connecting…' : 'Continue'}
        loading={submitting}
        disabled={trimmedApiKey === ''}
      />
    </form>
  </Card>
</div>
