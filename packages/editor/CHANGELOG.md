# @lostgradient/editor

## 0.1.0

### Minor Changes

- [#856](https://github.com/stevekinney/cinder/pull/856) [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish `@lostgradient/editor` (Phase 3 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). `@cinder/commentary` is renamed to `@lostgradient/editor`
  and absorbs the ProseMirror/Milkdown half of the former `@cinder/editor` package. Three components
  move out of `@lostgradient/cinder` and into this new package: `markdown-editor`, `review-editor`,
  and `diff-viewer` — `review-editor` composes the other two, so all three had to move together.

  `@lostgradient/cinder`'s `markdown-editor`, `review-editor`, and `diff-viewer` subpaths (and their
  `/schema`, `/variables`, `/styles`, `/examples` siblings) are **removed** — this is a breaking
  change for any external consumer of those subpaths, hence the minor (not patch) bump on
  `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a minor per semver's own
  pre-1.0 carve-out (the same reasoning `@lostgradient/markdown`'s publish used for the removed
  `./diff` aliases). That is the ONLY subpath removal in this release — Phase 3's scope is those
  three Svelte components, nothing else. Cinder's `./editor`, `./editor/component-runtime`,
  `./editor/test-utilities`, the bare `./commentary` root barrel, and every `./commentary/*` subpath
  (`anchor-decorations`, `anchoring`, `comments`(+`/types`), `export`(+`/types`), `session`
  (+`/types`), `shared/anchor-types`) are unaffected — they now mirror `@lostgradient/editor`'s
  headless runtime instead of `@cinder/commentary`'s, with no change to their public shape.

  We evaluated re-exporting the three Svelte components back through Cinder as generated shims (the
  `derive-upstream-reexports.ts` / `CINDER_KEY_OVERRIDES` pattern used for the headless subpaths
  above), but that mechanism only understands `.ts` value/type re-exports — `generate-exports.ts`'s
  component pipeline requires a component to physically live under
  `packages/components/src/components/`, and cannot re-export a compiled `.svelte` file from a
  sibling package. A hand-authored shim `.svelte` file was rejected too: it is exactly the kind of
  compatibility scaffolding this repo's conventions avoid on a pre-release package, and Phase 5 of
  the package-boundaries plan deletes Cinder's remaining shims outright — so a temporary
  `markdown-editor`/`review-editor`/`diff-viewer` shim here would be written only to be deleted in
  the very next phase. Consumers of these three components should migrate their import specifier
  from `@lostgradient/cinder/<component>` to `@lostgradient/editor/<component>` directly.

  `@lostgradient/editor`'s peers are `@lostgradient/cinder` (`^0.17.0`), `@lostgradient/markdown`
  (`^0.1.0`), `svelte`, and the milkdown/prosemirror stack — all host-supplied singletons. Its only
  regular `dependencies` are `@floating-ui/dom` and `esm-env`, matching `@lostgradient/cinder`'s own
  treatment of those same two vendored utilities (see `package-boundary.test.ts`): small, stateless
  libraries where a duplicate copy across the install graph causes no functional issue, unlike the
  singleton-sensitive peers above.

### Patch Changes

- Updated dependencies [[`ffbbb2f`](https://github.com/stevekinney/cinder/commit/ffbbb2f3b6fc9ac8bbb14c598716e49cff72c517), [`fdecd5e`](https://github.com/stevekinney/cinder/commit/fdecd5e63a0ea2e3ca8e3d997efa3f815d1bd664), [`955adb0`](https://github.com/stevekinney/cinder/commit/955adb0459272b9d08ed8a5eb13b579ce83997a7), [`30feaa5`](https://github.com/stevekinney/cinder/commit/30feaa509548f436e77c47520d9b49193f76c6f4), [`f86e857`](https://github.com/stevekinney/cinder/commit/f86e8577f03cedad95858f5fb60a20f3265a2407), [`204928e`](https://github.com/stevekinney/cinder/commit/204928e8b07e6e1e7ea7f16c994ae3e201933bf9), [`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667), [`0ef0a27`](https://github.com/stevekinney/cinder/commit/0ef0a272568e716e0dac034e60347f5cf3f611d6), [`caa5b36`](https://github.com/stevekinney/cinder/commit/caa5b36ea46511a8e62f514d89e2f4a5726f9fc9), [`23a5ebc`](https://github.com/stevekinney/cinder/commit/23a5ebc161be56d1198829fb269372e67f85d5bb), [`35732d8`](https://github.com/stevekinney/cinder/commit/35732d8d15240082ccb5d7b4be6d6216a05c40ea), [`d7ecfc4`](https://github.com/stevekinney/cinder/commit/d7ecfc4cece464edddef9e027ae5176d40313766), [`fffa0ab`](https://github.com/stevekinney/cinder/commit/fffa0abf2ee41c9cf0a0e100eb5ee99447f5d5f4), [`e9c1146`](https://github.com/stevekinney/cinder/commit/e9c11464ca1ef5af0801439270f4e0e09411ad41), [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c), [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c), [`4376c18`](https://github.com/stevekinney/cinder/commit/4376c18e2f0dd055ec629cd02035447f8f6e13b2), [`2174be0`](https://github.com/stevekinney/cinder/commit/2174be0182d834d8aa3f1dbe82a2b3fe54b153db), [`280ba3e`](https://github.com/stevekinney/cinder/commit/280ba3e9eed6e76d7534bd0f4f78ff8890cf05df), [`7e9d2f6`](https://github.com/stevekinney/cinder/commit/7e9d2f65b1b464762f6858a0e6429c1c6c52d4d1), [`356c5d7`](https://github.com/stevekinney/cinder/commit/356c5d7f7a4d3a7e9306b71e6039ce05382c7aa7), [`282b380`](https://github.com/stevekinney/cinder/commit/282b38060b765340a58f07487c53a0f9710d4033), [`31fd201`](https://github.com/stevekinney/cinder/commit/31fd20103079bc6cebeadab8c0e11390119754f3), [`88d8b17`](https://github.com/stevekinney/cinder/commit/88d8b17d99e74742d0819094b3c6a5740079d6c3), [`09bdd26`](https://github.com/stevekinney/cinder/commit/09bdd2627ef2a36edf502add662ffd08a9b6ae41)]:
  - @lostgradient/cinder@0.17.0
  - @lostgradient/markdown@0.1.0
