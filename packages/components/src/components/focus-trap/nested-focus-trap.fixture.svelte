<script lang="ts">
  import { FocusTrap } from './index.ts';

  let innerActive = $state(false);
</script>

<div class="nested-focus-trap-fixture">
  <button type="button" data-testid="toggle-inner" onclick={() => (innerActive = !innerActive)}>
    Toggle inner trap
  </button>

  <FocusTrap>
    <button type="button" data-testid="outer-first">Outer first</button>
    <button type="button" data-testid="outer-last">Outer last</button>

    <FocusTrap active={innerActive}>
      <button type="button" data-testid="inner-first">Inner first</button>
      <button type="button" data-testid="inner-last">Inner last</button>
    </FocusTrap>
  </FocusTrap>
</div>
