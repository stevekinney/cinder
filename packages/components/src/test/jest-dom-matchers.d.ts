// Ambient module augmentation for `@testing-library/jest-dom` matchers on
// Bun's `expect`. `@testing-library/jest-dom` ships an equivalent
// `types/bun.d.ts`, but it is not exposed through the package's `exports`
// map (only `.`, `./jest-globals`, `./matchers`, and `./vitest` are), so it
// cannot be referenced by specifier. Declare the same augmentation here,
// sourcing `TestingLibraryMatchers` from the `./matchers` subpath that IS
// exported, so `expect(...).toHaveAttribute(...)` etc. typecheck wherever a
// test file calls `expect.extend(matchers)` from `@testing-library/jest-dom/matchers`.
import { type TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import { type expect } from 'bun:test';

declare module 'bun:test' {
  interface Matchers<T = unknown> extends TestingLibraryMatchers<
    ReturnType<typeof expect.stringContaining>,
    T
  > {}
}
