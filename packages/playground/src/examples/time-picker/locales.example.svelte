<script lang="ts" module>
  export const title = 'Locale hour cycles';
  export const description = 'Compare how the picker presents the same time across locales.';
</script>

<script lang="ts">
  import { TimePicker } from 'cinder';

  let usValue = $state('13:15');
  let deValue = $state('13:15');
  let jaValue = $state('13:15');
</script>

<div style="display: grid; gap: 1rem; max-width: 20rem;">
  <TimePicker id="locale-us" bind:value={usValue} label="United States" locale="en-US" />
  <TimePicker id="locale-de" bind:value={deValue} label="Germany" locale="de-DE" />
  <TimePicker id="locale-ja" bind:value={jaValue} label="Japan" locale="ja-JP" />
</div>
