<script lang="ts">
  import AccessGate from '../../components/access-gate/access-gate.svelte';

  let granted = $state(false);
  let descriptionId = $state('initial-hint');
  let childDisabled = $state(true);
  let linkHref = $state('/runs/123/cancel');
  let linkDescriptionId = $state('link-initial-hint');
  let customAriaDisabled = $state(false);
  let customTabindex = $state(0);
  let customDescriptionId = $state('custom-initial-hint');

  function updateChildState(): void {
    descriptionId = 'updated-hint';
    childDisabled = false;
    linkHref = '/runs/123/review';
    linkDescriptionId = 'link-updated-hint';
    customAriaDisabled = false;
    customTabindex = 2;
    customDescriptionId = 'custom-updated-hint';
  }
</script>

<button type="button" onclick={updateChildState}>Update child state</button>
<button type="button" onclick={() => (granted = true)}>Grant scope</button>

<span id="initial-hint">Initial hint</span>
<span id="updated-hint">Updated hint</span>
<span id="link-initial-hint">Initial link hint</span>
<span id="link-updated-hint">Updated link hint</span>
<span id="custom-initial-hint">Initial custom hint</span>
<span id="custom-updated-hint">Updated custom hint</span>

<AccessGate {granted} reason="Requires scope: workflows:cancel">
  <button type="button" disabled={childDisabled} aria-describedby={descriptionId}>
    Stateful cancel
  </button>
  <a href={linkHref} aria-describedby={linkDescriptionId}>Stateful link cancel</a>
  <span
    role="button"
    tabindex={customTabindex}
    aria-disabled={customAriaDisabled}
    aria-describedby={customDescriptionId}
  >
    Stateful custom cancel
  </span>
</AccessGate>
