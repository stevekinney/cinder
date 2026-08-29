# HostProvider

Supplies a desktop host platform to descendant Cinder surfaces. It defaults to `web`, where desktop-only window chrome behavior is inert.

`safeHeaderLeft` and `safeHeaderRight` publish the host-provided titlebar insets for Cinder's internal drag-region handshake. Both default to `0px`; desktop hosts should set them from the actual native window controls rather than copying OS-specific spacing into application CSS.

HostProvider is the shared coordination boundary for desktop-aware Cinder surfaces. It renders a `display: contents` provider node, so it does not create a layout box.
