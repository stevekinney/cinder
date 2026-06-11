<!--
  PROBE CHILD FIXTURE (#17): an UNCONDITIONALLY-rendered child component with its
  own $effect. This is the "components with unconditional child-effects" case the
  task is named for — renderThenHydrate can't server-compile this child (only the
  top-level component), but checkBuildFlagHydrationSafety bundles the whole import
  graph via Bun.build, so the child renders natively on the server.
-->
<script lang="ts">
  let mounted = $state(false);
  $effect(() => {
    mounted = true;
  });
</script>

<span data-testid="child" data-mounted={mounted}>child content</span>
