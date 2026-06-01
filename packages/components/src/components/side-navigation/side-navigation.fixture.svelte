<script lang="ts">
  import { SideNavigation } from './index.ts';

  type FixtureProps = {
    active?: string;
    projectsExpanded?: boolean;
  };

  let { active = 'phoenix', projectsExpanded = true }: FixtureProps = $props();
</script>

<div class="side-navigation-fixture">
  <SideNavigation ariaLabel="Workspace">
    <SideNavigation.Item href="/dashboard" active={active === 'dashboard'}>
      Dashboard
    </SideNavigation.Item>
    <SideNavigation.Group label="Projects" expanded={projectsExpanded}>
      <SideNavigation.Item href="/projects/phoenix" active={active === 'phoenix'}>
        Phoenix
      </SideNavigation.Item>
      <SideNavigation.Item href="/projects/atlas" active={active === 'atlas'}>
        Atlas
      </SideNavigation.Item>
      <SideNavigation.Item href="/projects/beacon" active={active === 'beacon'}>
        Beacon
      </SideNavigation.Item>
    </SideNavigation.Group>
    <SideNavigation.Group label="Settings">
      <SideNavigation.Item href="/settings/team">Team</SideNavigation.Item>
      <SideNavigation.Item href="/settings/billing">Billing</SideNavigation.Item>
    </SideNavigation.Group>
  </SideNavigation>
</div>

<style>
  .side-navigation-fixture {
    inline-size: 18rem;
  }
</style>
