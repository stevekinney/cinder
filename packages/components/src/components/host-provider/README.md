# HostProvider

Supplies a desktop host platform to descendant Cinder surfaces. It defaults to `web`, where desktop-only window chrome behavior is inert.

`safeHeaderLeft` and `safeHeaderRight` publish the host-provided titlebar insets for Cinder's internal drag-region handshake. Both default to `0px`; desktop hosts should set them from the actual native window controls rather than copying OS-specific spacing into application CSS.

HostProvider is the shared coordination boundary for desktop-aware Cinder surfaces. It renders a `display: contents` provider node, so it does not create a layout box.

## Usage

```svelte
<script lang="ts">
  import { HostProvider } from '@lostgradient/cinder';
</script>

<HostProvider platform="macos" safeHeaderLeft="4rem" safeHeaderRight="1rem">
  <p>Desktop-aware application surface</p>
</HostProvider>
```

## Props

<!-- generated:props:start -->

| Prop              | Type                                             | Required | Default | Description                                                                                                |
| ----------------- | ------------------------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `platform`        | `"web"` \| `"macos"` \| `"windows"` \| `"linux"` | no       | `"web"` | Host platform. Defaults to `web`, where desktop chrome behavior is inert.                                  |
| `safeHeaderLeft`  | `string`                                         | no       | `"0px"` | Inline-start titlebar inset supplied by the desktop host. Defaults to `0px`.                               |
| `safeHeaderRight` | `string`                                         | no       | `"0px"` | Inline-end titlebar inset supplied by the desktop host. Defaults to `0px`.                                 |
| `children`        | `(opaque)`                                       | no       | —       | Descendant application surface. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.
<!-- generated:variables:end -->
