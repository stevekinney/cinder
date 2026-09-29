# TerminalOutput

Read-only ANSI process output. It supports SGR 16-color foregrounds, bold/reset, carriage-return rewrites, and erase-line control sequences. It does not own a PTY or accept terminal input. While `followLatest` is true (the default), appended output stays anchored to the latest line; scrolling away pauses following until the viewport reaches the end again.

## Usage

```svelte
<script lang="ts">
  import { TerminalOutput } from '@lostgradient/cinder';
</script>

<TerminalOutput aria-label="Build output" value={'\u001b[32mready\u001b[0m\n'} />
```

`followLatest` defaults to `true`: appended lines keep the viewport at the end until the reader scrolls away, then following pauses. There is no persistent host-controlled mode—`followLatest={false}` only sets the initial or current value, and the component's own scroll handler always flips it back to `true` (as local state, whether or not a parent binds it) the moment the reader scrolls back to the bottom. The component understands the supported SGR foreground, bold, reset, carriage-return, and erase-line sequences; it does not create a PTY, accept input, or reconnect a process. Use [`TerminalFrame`](../terminal-frame/README.md) for that surrounding connection and recovery state.

The root uses `role="log"` and `aria-live="polite"`; supply an accessible name so readers know which process is producing updates. Preserve already-rendered output when a process fails and expose reconnect or retry controls beside it; clearing the transcript makes the failure harder to diagnose.

## Props

<!-- generated:props:start -->

| Prop           | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`   | no       | —       | Additional class merged with the component's root class.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `followLatest` | `boolean`  | no       | `true`  | Keeps the viewport anchored to the latest line while appending. Bindable, but this component has no persistent host-controlled mode, bound or not: its own scroll handler always reassigns this (as local component state, independent of whether a parent binds it) to `true` the moment the user scrolls back to the bottom, which resumes automatic scrolling on the next append. Setting `false` only affects the initial or current value—there is currently no way for a host to durably keep this component from following once the user reaches the bottom again. Defaults to `true`. |
| `value`        | `string`   | no       | `""`    | ANSI output text. Supports SGR 16-color foregrounds, bold/reset, carriage-return rewrites, and erase-line sequences. Defaults to `''`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `children`     | `(opaque)` | no       | —       | Rendered in place of the ANSI output when `value` is empty, e.g. an empty state. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->
