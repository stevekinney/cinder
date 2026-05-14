<script lang="ts">
  import { getSidebarContext } from '../../_internal/sidebar-context.ts';

  const context = getSidebarContext();
</script>

<!--
  Reads the SidebarContext published by a parent <Sidebar> and surfaces the
  current `collapsed` value plus a `data-context` marker so tests can confirm
  the context exists even when collapsed is false.
-->
<div
  data-sidebar-probe
  data-context={context ? 'present' : 'absent'}
  data-collapsed={context?.collapsed ? 'true' : 'false'}
></div>
