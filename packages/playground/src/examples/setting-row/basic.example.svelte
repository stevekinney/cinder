<script lang="ts" module>
  export const title = 'Settings row';
  export const description = 'Compose a labelled setting control with guidance.';
</script>

<script lang="ts">
  import { Input } from '@lostgradient/cinder/input';
  import { SettingRow } from '@lostgradient/cinder/setting-row';
</script>

<SettingRow id="display-name" label="Display name" description="Shown to collaborators.">
  {#snippet control()}
    <Input id="display-name" value="" placeholder="Ada Lovelace">
      {#snippet leading()}{/snippet}
      {#snippet trailing()}{/snippet}
    </Input>
  {/snippet}
</SettingRow>
