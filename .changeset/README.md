# Changesets

This directory tracks pending releases for `cinder`. Run `bun x changeset` to add a new changeset describing your change. The release workflow (`.github/workflows/release.yaml`) consumes accumulated changesets to open a "Version Packages" pull request and publishes to npm with provenance when that PR is merged.

Only the `cinder` package (in `packages/components/`) is published to npm. The other workspaces (`@cinder/commentary`, `@cinder/diff`, `@cinder/editor`, `@cinder/markdown`, `@cinder/testing`, `@cinder/playground`) are private. Because `cinder` declares some of them as `workspace:*` dependencies, Changesets cannot have them in `ignore` — it would refuse to version a published package that depends on skipped packages. Instead, `privatePackages.version: true` lets Changesets bump their internal versions as a side-effect of bumping `cinder`. They never publish (npm honors their `"private": true` flag). `@cinder/playground` has no dependents and is listed under `ignore` so changes there don't drag a `cinder` version bump along.

See [`config.json`](./config.json) for the full configuration. The [official Changesets docs](https://github.com/changesets/changesets) cover the workflow in depth.
