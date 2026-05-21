/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, waitFor } = await import('@testing-library/svelte');
const { default: CinderProvider } = await import('./cinder-provider.svelte');
const { default: CodeBlock } = await import('../code-block/code-block.svelte');

type Highlighter = (code: string, lang: string) => string | Promise<string>;

function highlighterReturning(marker: string): Highlighter {
  return async (code) =>
    `<pre class="shiki"><code><span class="${marker}">${code}</span></code></pre>`;
}

describe('CinderProvider', () => {
  test('renders its children', () => {
    const { container } = render(CinderProvider, {
      props: {
        children: createRawSnippet(() => ({
          render: () => `<p class="probe">hello</p>`,
          setup: () => {},
        })),
      },
    });
    expect(container.querySelector('.probe')?.textContent).toBe('hello');
  });

  test('descendant CodeBlock picks up the provider highlighter', async () => {
    const { container } = render(CinderProvider, {
      props: {
        highlighter: highlighterReturning('provider-token'),
        children: createRawSnippet(() => ({
          render: () => `<div class="code-block-mount"></div>`,
          setup: (node: Element) => {
            const instance = mount(CodeBlock, {
              target: node,
              props: { code: 'const x = 1;', language: 'js' },
            });
            return () => {
              unmount(instance);
            };
          },
        })),
      },
    });

    await waitFor(() => {
      const token = container.querySelector('.provider-token');
      expect(token).not.toBeNull();
      expect(token?.textContent).toBe('const x = 1;');
    });
  });

  test('reactively re-renders descendant CodeBlocks when highlighter prop changes', async () => {
    // Reactive-context regression: Svelte 5 closures over `$props()` aren't
    // automatically reactive across `setContext` boundaries. The provider
    // bridges that with a getter property; swapping the prop after mount
    // must invalidate the descendant CodeBlock's `$effect` and re-render
    // with the new function's output.
    //
    // We mount a CodeBlock once into a stable target node and update the
    // provider's `highlighter` prop. The CodeBlock stays mounted across
    // rerenders so we can observe the highlighter swap in place.
    const target = document.createElement('div');
    document.body.appendChild(target);

    const codeBlockInstance = mount(CodeBlock, {
      target,
      props: { code: 'const x = 1;', language: 'js' },
      // The CinderProvider rendered below will publish to the same global
      // Svelte context tree because we mount everything into document.body.
      // (In real apps the provider wraps the subtree directly; the test
      // harness uses a flatter shape to keep the reactivity assertion
      // honest.)
    });

    try {
      const stableChildren = createRawSnippet(() => ({
        render: () => `<span class="provider-children-marker"></span>`,
        setup: () => {},
      }));

      const { rerender } = render(CinderProvider, {
        props: {
          highlighter: highlighterReturning('first-token'),
          children: stableChildren,
        },
      });

      // The CodeBlock was mounted OUTSIDE the provider's subtree, so the
      // assertion is structural: the reactivity test below covers the
      // in-tree case via the rerender API + a stable snippet reference.
      void rerender;

      // In-tree reactivity assertion: mount a fresh CodeBlock INSIDE a
      // CinderProvider whose `highlighter` we then swap.
      const inTreeTarget = document.createElement('div');
      document.body.appendChild(inTreeTarget);
      const inTreeChildren = createRawSnippet(() => ({
        render: () => `<div class="in-tree-mount"></div>`,
        setup: (node: Element) => {
          const instance = mount(CodeBlock, {
            target: node,
            props: { code: 'const y = 2;', language: 'js' },
          });
          return () => {
            unmount(instance);
          };
        },
      }));

      const inTree = render(CinderProvider, {
        props: {
          highlighter: highlighterReturning('first-token'),
          children: inTreeChildren,
        },
      });

      await waitFor(() => {
        expect(inTree.container.querySelector('.first-token')).not.toBeNull();
      });

      await inTree.rerender({
        highlighter: highlighterReturning('second-token'),
        children: inTreeChildren,
      });

      await waitFor(() => {
        const allTokens = inTree.container.querySelectorAll('.second-token');
        expect(allTokens.length).toBeGreaterThan(0);
      });

      // The in-place swap must replace, not duplicate. Exactly one rendered
      // token tree should remain inside the provider container.
      const firstAfter = inTree.container.querySelectorAll('.first-token');
      const secondAfter = inTree.container.querySelectorAll('.second-token');
      expect(firstAfter.length + secondAfter.length).toBe(1);
      expect(secondAfter.length).toBe(1);
    } finally {
      unmount(codeBlockInstance);
      target.remove();
    }
  });

  test('clearing the highlighter prop reverts descendants to the unhighlighted fallback', async () => {
    const stableChildren = createRawSnippet(() => ({
      render: () => `<div class="clear-mount"></div>`,
      setup: (node: Element) => {
        const instance = mount(CodeBlock, {
          target: node,
          props: { code: 'const x = 1;', language: 'js' },
        });
        return () => {
          unmount(instance);
        };
      },
    }));

    const { container, rerender } = render(CinderProvider, {
      props: {
        highlighter: highlighterReturning('initial-token'),
        children: stableChildren,
      },
    });

    await waitFor(() => {
      expect(container.querySelector('.initial-token')).not.toBeNull();
    });

    // Pass `highlighter: undefined` explicitly so the rerender drops the
    // prop rather than leaving the previous value in place. The runtime
    // accepts this as the documented "no highlighter" state.
    await rerender({
      children: stableChildren,
      highlighter: undefined,
    });

    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__pre')).not.toBeNull();
    });
    // Final state: exactly one of (highlighted token, unhighlighted pre)
    // should remain.
    expect(container.querySelectorAll('.initial-token').length).toBe(0);
  });

  test('nested provider wins over an outer provider for its subtree', async () => {
    // The "global provider hides per-example wiring bugs" guard. A second
    // <CinderProvider> deeper in the tree must override the outer one for
    // its subtree, otherwise overrides silently fail and consumers can't
    // scope a different highlighter to a region.
    const { container } = render(CinderProvider, {
      props: {
        highlighter: highlighterReturning('outer-token'),
        children: createRawSnippet(() => ({
          render: () => `<div class="outer-mount"></div>`,
          setup: (node: Element) => {
            const instance = mount(CinderProvider, {
              target: node,
              props: {
                highlighter: highlighterReturning('inner-token'),
                children: createRawSnippet(() => ({
                  render: () => `<div class="inner-mount"></div>`,
                  setup: (innerNode: Element) => {
                    const blockInstance = mount(CodeBlock, {
                      target: innerNode,
                      props: { code: 'const x = 1;', language: 'js' },
                    });
                    return () => {
                      unmount(blockInstance);
                    };
                  },
                })),
              },
            });
            return () => {
              unmount(instance);
            };
          },
        })),
      },
    });

    await waitFor(() => {
      expect(container.querySelector('.inner-token')).not.toBeNull();
      // The outer provider's highlighter MUST NOT render anywhere inside
      // the inner provider's subtree — that would mean the nested override
      // was ignored.
      expect(container.querySelector('.outer-token')).toBeNull();
    });
  });
});
