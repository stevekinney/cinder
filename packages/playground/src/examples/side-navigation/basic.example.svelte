<script lang="ts" module>
  export const title = 'Basic side navigation';
  export const description =
    'A grouped sidebar nav. Uses the SideNavigation namespace API: SideNavigation.Group wraps a collapsible section and SideNavigation.Item renders each link.';
</script>

<script lang="ts">
  import { SideNavigation } from 'cinder/side-navigation';
</script>

<SideNavigation ariaLabel="Workspace">
  <SideNavigation.Item href="/dashboard">Dashboard</SideNavigation.Item>
  <SideNavigation.Group label="Projects">
    <SideNavigation.Item href="/projects/phoenix" active>Phoenix</SideNavigation.Item>
    <SideNavigation.Item href="/projects/atlas">Atlas</SideNavigation.Item>
    <SideNavigation.Item href="/projects/beacon">Beacon</SideNavigation.Item>
  </SideNavigation.Group>
  <SideNavigation.Group label="Settings">
    <SideNavigation.Item href="/settings/team">Team</SideNavigation.Item>
    <SideNavigation.Item href="/settings/billing">Billing</SideNavigation.Item>
  </SideNavigation.Group>
</SideNavigation>
