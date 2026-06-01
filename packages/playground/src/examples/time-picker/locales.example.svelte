<script lang="ts" module>
  export const title = 'Locale hour cycles';
  export const description =
    'The Cinder scroll-list picker uses the locale hour cycle consistently across browsers. Click any clock icon to open the picker.';
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
