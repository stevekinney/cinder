# Changesets

This directory tracks pending releases for `cinder`. Run `bun x changeset` to add a new changeset describing your change. The release workflow (`.github/workflows/release.yaml`) consumes accumulated changesets to open a "Version Packages" pull request and publishes to npm with provenance when that PR is merged.

Only the `cinder` package (in `packages/components/`) is published. All `@cinder/*` workspaces are private and listed under `ignore` in `config.json`.

See [`config.json`](./config.json) for the full configuration. The [official Changesets docs](https://github.com/changesets/changesets) cover the workflow in depth.
