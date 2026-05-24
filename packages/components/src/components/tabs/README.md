# Tabs

A Tabs component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`Tabs` is a compound component. Import the parent once and compose its
leaves via the namespace API: `Tabs.List`, `Tabs.Trigger`, and `Tabs.Panel`.

```svelte
<script lang="ts">
  import { Tabs } from 'cinder/tabs';

  let active = $state('overview');
</script>

<Tabs bind:value={active}>
  <Tabs.List label="Project sections">
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Panel value="overview">Project overview.</Tabs.Panel>
  <Tabs.Panel value="activity">Recent activity.</Tabs.Panel>
  <Tabs.Panel value="settings">Project settings.</Tabs.Panel>
</Tabs>
```

The leaves remain importable individually for à-la-carte builds — see
`cinder/tab`, `cinder/tab-list`, and `cinder/tab-panel`.

## Props

<!-- generated:props:start -->

| Prop              | Type                           | Required | Default | Description                                                                                                                                                                                                   |
| ----------------- | ------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activateOnFocus` | `boolean`                      | no       | —       | When true (default for horizontal), focusing a tab also activates it (the panel updates immediately). Vertical defaults to manual activation — the user moves focus with arrows, then presses Enter or Space. |
| `class`           | `string`                       | no       | —       | Additional class names merged with `.cinder-tabs`.                                                                                                                                                            |
| `orientation`     | `"horizontal"` \| `"vertical"` | no       | —       | Layout orientation. Affects which arrow keys move between tabs.                                                                                                                                               |
| `value`           | `string`                       | no       | —       | Bound active tab value.                                                                                                                                                                                       |
| `children`        | `(opaque)`                     | —        | —       | function-or-snippet                                                                                                                                                                                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Tabs.List` — the tablist container; see [`tab-list`](../tab-list/README.md).
- `Tabs.Trigger` — an individual tab; see [`tab`](../tab/README.md).
- `Tabs.Panel` — a panel rendered when the matching trigger is active; see
  [`tab-panel`](../tab-panel/README.md).

<!-- generated:subcomponents:end -->
