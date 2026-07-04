<script lang="ts" module>
  export const title = 'Fill pane tabs';
  export const description =
    'Tabs can fill a bounded flex pane so the active panel takes the remaining height.';
</script>

<script lang="ts">
  import { Tabs } from '@lostgradient/cinder/tabs';

  let active = $state('timeline');
</script>

<div
  style="display: flex; flex-direction: column; block-size: 20rem; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-md); padding: var(--cinder-space-3);"
>
  <Tabs bind:value={active} fill>
    <Tabs.List label="Run inspector">
      <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
      <Tabs.Trigger value="logs">Logs</Tabs.Trigger>
      <Tabs.Trigger value="metadata">Metadata</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Panel value="timeline">
      <div
        style="block-size: 100%; overflow: auto; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); padding: var(--cinder-space-3);"
      >
        <p>Queued</p>
        <p>Provisioned runner</p>
        <p>Installed dependencies</p>
        <p>Built artifacts</p>
        <p>Ran browser checks</p>
        <p>Uploaded report</p>
      </div>
    </Tabs.Panel>

    <Tabs.Panel value="logs">
      <div
        style="block-size: 100%; overflow: auto; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); padding: var(--cinder-space-3);"
      >
        <p>10:01:22 Starting worker</p>
        <p>10:01:25 Restoring cache</p>
        <p>10:01:31 Running validation</p>
        <p>10:02:04 Validation complete</p>
      </div>
    </Tabs.Panel>

    <Tabs.Panel value="metadata">
      <div
        style="block-size: 100%; overflow: auto; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); padding: var(--cinder-space-3);"
      >
        <p>The panel body fills the same bounded pane.</p>
        <p>Scrollable content can stay inside the active panel.</p>
        <p>The Tabs root owns the flex behavior through the fill prop.</p>
      </div>
    </Tabs.Panel>
  </Tabs>
</div>
