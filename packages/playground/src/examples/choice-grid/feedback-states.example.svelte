<script lang="ts" module>
  export const title = 'Feedback states';
  export const description =
    'Correct, incorrect, and pending states for quiz and assessment surfaces. Cell dimensions stay stable across states.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { ChoiceGrid } from '@lostgradient/cinder/choice-grid';
  import type { ChoiceGridItemState } from '@lostgradient/cinder/choice-grid';

  let selected = $state<string | null>(null);
  let revealed = $state(false);

  const correctAnswer = 'paris';

  function getState(value: string): ChoiceGridItemState {
    if (!revealed || selected === null) return 'neutral';
    if (value === correctAnswer) return 'correct';
    if (value === selected && value !== correctAnswer) return 'incorrect';
    return 'neutral';
  }
</script>

<ChoiceGrid ariaLabel="What is the capital of France?" bind:value={selected}>
  <ChoiceGrid.Item value="london" state={getState('london')}>London</ChoiceGrid.Item>
  <ChoiceGrid.Item value="berlin" state={getState('berlin')}>Berlin</ChoiceGrid.Item>
  <ChoiceGrid.Item value="paris" state={getState('paris')}>Paris</ChoiceGrid.Item>
  <ChoiceGrid.Item value="madrid" state={getState('madrid')}>Madrid</ChoiceGrid.Item>
</ChoiceGrid>

<div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
  <Button variant="secondary" onclick={() => (revealed = !revealed)}>
    {revealed ? 'Hide feedback' : 'Reveal answer'}
  </Button>
  <Button
    variant="ghost"
    onclick={() => {
      selected = null;
      revealed = false;
    }}
  >
    Reset
  </Button>
</div>
