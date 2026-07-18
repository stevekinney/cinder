# Changesets

This directory tracks pending releases for `@lostgradient/cinder` and `@lostgradient/chat`. Run `bun x changeset` to add a new changeset describing your change. The release workflow (`.github/workflows/release.yaml`) consumes accumulated changesets to open a "Version Packages" pull request and publishes both public packages to npm through Trusted Publishing when that pull request is merged.

The public packages are `@lostgradient/cinder` (`packages/components/`) and `@lostgradient/chat` (`packages/chat/`). The `@cinder/*` workspaces remain private. Because Cinder declares several of them as `workspace:*` development dependencies and bundles their output, Changesets cannot ignore those connected workspaces. Instead, `privatePackages.version: true` lets Changesets update their internal versions without publishing them. `@cinder/playground` has no published artifact and remains the only ignored workspace.

Both public packages are pre-1.0, so breaking changes use a `minor` changeset rather than `major`. Chat peers on Cinder rather than publishing a workspace dependency; keep that peer range aligned with the Cinder version released alongside it. `bumpVersionsWithWorkspaceProtocolOnly: true` is intentional: actual internal workspace links use `workspace:*`, while Chat's non-workspace Cinder peer is an explicitly managed publish contract. Without that setting, Changesets promotes Chat to a `major` release whenever Cinder's pre-1.0 minor leaves the peer range.

See [`config.json`](./config.json) for the full configuration. The [official Changesets docs](https://github.com/changesets/changesets) cover the workflow in depth.
