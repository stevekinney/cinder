<script lang="ts" module>
  export const title = 'Input types';
  export const description = 'Text, email, password, search, date, tel, and url types.';
</script>

<script lang="ts">
  import { Input } from '@lostgradient/cinder/input';
  let text = $state('');
  let email = $state('');
  let password = $state('');
  let search = $state('');
  let date = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <Input id="t-text" type="text" bind:value={text} label="Text" placeholder="Plain text" />
  <Input id="t-email" type="email" bind:value={email} label="Email" placeholder="you@example.com" />
  <Input id="t-password" type="password" bind:value={password} label="Password" />
  <Input id="t-search" type="search" bind:value={search} label="Search" placeholder="Search…" />
  <Input id="t-date" type="date" bind:value={date} label="Date" />
</div>
