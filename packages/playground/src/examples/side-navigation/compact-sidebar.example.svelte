<script lang="ts" module>
  export const title = 'Compact sidebar spacing';
  export const description =
    'Dense sidebars can tune the SideNavigation list gap through a public CSS variable.';
</script>

<script lang="ts">
  import { SideNavigation } from '@lostgradient/cinder/side-navigation';
</script>

<div style="max-inline-size: 18rem;">
  <SideNavigation ariaLabel="Inspector sections" style="--cinder-side-navigation-list-gap: 0;">
    <SideNavigation.Item href="#overview" active>Overview</SideNavigation.Item>
    <SideNavigation.Item href="#timeline">Timeline</SideNavigation.Item>
    <SideNavigation.Item href="#payload">Payload</SideNavigation.Item>
    <SideNavigation.Group label="Artifacts">
      <SideNavigation.Item href="#source">Source</SideNavigation.Item>
      <SideNavigation.Item href="#snapshot">Snapshot</SideNavigation.Item>
    </SideNavigation.Group>
  </SideNavigation>
</div>
