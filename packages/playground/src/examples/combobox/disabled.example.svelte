<script lang="ts" module>
  export const title = 'Disabled combobox';
  export const description = 'Disabled combobox cannot be focused or edited.';
</script>

<script lang="ts">
  import { Combobox } from 'cinder/combobox';
  const options = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'enterprise', label: 'Enterprise', disabled: true },
  ];
</script>

<Combobox
  id="combobox-disabled"
  label="Plan"
  placeholder="Locked plan selection"
  {options}
  value="pro"
  disabled
/>
