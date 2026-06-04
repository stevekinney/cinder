<script lang="ts" module>
  export const title = 'Responsive grid';
  export const description =
    'Container-query-driven layout. Resize the outer container to see the grid respond. ' +
    'Below 40rem: 1 column. At 40rem: 2 columns (for columns≥2). At 60rem: 3 (for columns≥3). At 80rem: 4.';
</script>

<script lang="ts">
  import { FormField } from '@lostgradient/cinder/form-field';
  import { FormSection } from '@lostgradient/cinder/form-section';
  import { Input } from '@lostgradient/cinder/input';
  let firstName = $state('');
  let lastName = $state('');
  let email = $state('');
  let phone = $state('');
</script>

<!--
  Resize this example in the playground to observe container-query breakpoints.
  columns=4 means up to four columns; actual count is determined by the container width.
-->
<div
  style="resize: horizontal; overflow: hidden; min-width: 18rem; padding: 0.5rem; border: 1px dashed var(--cinder-border);"
>
  <FormSection heading="Contact information" columns={4}>
    <FormField id="first-name" label="First name">
      <Input id="first-name" bind:value={firstName} placeholder="Jane" />
    </FormField>
    <FormField id="last-name" label="Last name">
      <Input id="last-name" bind:value={lastName} placeholder="Smith" />
    </FormField>
    <FormField id="email-address" label="Email">
      <Input id="email-address" bind:value={email} type="email" placeholder="you@example.com" />
    </FormField>
    <FormField id="phone" label="Phone">
      <Input id="phone" bind:value={phone} type="tel" placeholder="+1 555 000 0000" />
    </FormField>
  </FormSection>
</div>
