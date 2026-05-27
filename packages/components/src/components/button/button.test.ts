/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
// If you flip this order the error doesn't mention happy-dom — it surfaces as a cryptic
// "document is not defined" inside testing-library's internals.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Button } = await import('./button.svelte');

const originalConsoleWarn = console.warn;
let captureWarningsForTest = false;

// Without per-test cleanup the rendered tree from a previous test (in this file
// or — when bun-test runs files in shared globals — a previous file) lingers
// in document.body, and getByText/getByRole queries hit unrelated content.
beforeEach(() => {
  if (!captureWarningsForTest) {
    console.warn = () => {};
  }
});

afterEach(() => {
  cleanup();
  console.warn = originalConsoleWarn;
  captureWarningsForTest = false;
});

function readTokenSource(): string {
  return readFileSync(new URL('../../styles/tokens-base.css', import.meta.url), 'utf8');
}

function readButtonSource(): string {
  return readFileSync(new URL('./button.css', import.meta.url), 'utf8');
}

function readRemTokenValue(source: string, name: string): number {
  const literalMatch = new RegExp(`--${name}: (?<value>\\d+(?:\\.\\d+)?)rem;`).exec(source);
  if (literalMatch?.groups?.['value']) return Number.parseFloat(literalMatch.groups['value']);
  const aliasMatch = new RegExp(`--${name}: var\\(--(?<alias>[\\w-]+)\\)`).exec(source);
  const alias = aliasMatch?.groups?.['alias'];
  if (alias) return readRemTokenValue(source, alias);
  throw new Error(`Missing or unresolvable rem-valued token for ${name}`);
}

function readButtonHeightToken(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): number {
  return readRemTokenValue(readTokenSource(), `cinder-button-height-${size}`);
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function readCssRuleBlock(source: string, selector: string): string {
  const match = new RegExp(`${escapeForRegExp(selector)}\\s*\\{(?<block>[^}]*)\\}`).exec(source);
  const block = match?.groups?.['block'];
  if (block === undefined) {
    throw new Error(`Missing CSS selector: ${selector}`);
  }
  return block;
}

function readCssRuleBlocks(source: string, selector: string): string[] {
  return Array.from(
    source.matchAll(new RegExp(`${escapeForRegExp(selector)}\\s*\\{(?<block>[^}]*)\\}`, 'g')),
    (match) => match.groups?.['block'] ?? '',
  );
}

function expectDeclaration(block: string, property: string, value: string): void {
  expect(block).toContain(`${property}: ${value};`);
}

function expectColorMixBackgroundHasFallback(block: string): void {
  const declarations = block
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);
  const colorMixIndex = declarations.findIndex(
    (declaration) => declaration.startsWith('background:') && declaration.includes('color-mix('),
  );
  expect(colorMixIndex).toBeGreaterThan(0);
  const previousDeclaration = declarations[colorMixIndex - 1];
  expect(previousDeclaration).toStartWith('background:');
  expect(previousDeclaration).not.toContain('transparent');
}

describe('Button rendering', () => {
  test('renders a <button> when no href is provided', () => {
    const { container } = render(Button, { props: { label: 'click me' } });
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  test('renders an <a> when href is provided', () => {
    const { container } = render(Button, { props: { href: '/target', label: 'go' } });
    expect(container.querySelector('a')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  test('button applies variant + size as data attributes', () => {
    const { container } = render(Button, {
      props: { label: 'tag', variant: 'danger', size: 'lg' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-cinder-variant')).toBe('danger');
    expect(button?.getAttribute('data-cinder-size')).toBe('lg');
  });

  test('supports the ghost-danger variant', () => {
    const { container } = render(Button, {
      props: { label: 'Remove', variant: 'ghost-danger' },
    });

    expect(container.querySelector('button')?.getAttribute('data-cinder-variant')).toBe(
      'ghost-danger',
    );
  });

  test('loading button has disabled + aria-busy + aria-disabled', () => {
    const { container } = render(Button, { props: { label: 'sending', loading: true } });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(button?.getAttribute('data-cinder-loading')).toBe('');
  });

  test('loading link removes href and is un-tab-reachable', () => {
    const { container } = render(Button, {
      props: { href: '/target', label: 'go', loading: true },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('href')).toBe(false);
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    expect(anchor?.getAttribute('aria-busy')).toBe('true');
  });

  test('loading link does NOT invoke consumer onclick', () => {
    let invocationCount = 0;
    const { container } = render(Button, {
      props: {
        href: '/target',
        label: 'go',
        loading: true,
        onclick: () => {
          invocationCount += 1;
        },
      },
    });
    const anchor = container.querySelector('a');
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(invocationCount).toBe(0);
  });

  test('non-loading link DOES invoke consumer onclick', () => {
    let invocationCount = 0;
    const { container } = render(Button, {
      props: {
        href: '/target',
        label: 'go',
        onclick: () => {
          invocationCount += 1;
        },
      },
    });
    const anchor = container.querySelector('a');
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(invocationCount).toBe(1);
  });

  test('consumer-provided aria-disabled survives when not loading', () => {
    const { container } = render(Button, {
      props: { label: 'x', 'aria-disabled': 'true' },
    });
    const button = container.querySelector('button');
    // Consumer set aria-disabled='true' manually; not loading, so we preserve it.
    expect(button?.getAttribute('aria-disabled')).toBe('true');
  });

  test('consumer class name merges with .cinder-button', () => {
    const { container } = render(Button, {
      props: { label: 'x', class: 'my-extra-class' },
    });
    const classAttr = container.querySelector('button')?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-button');
    expect(classAttr).toContain('my-extra-class');
  });

  test('rest attributes forward to rendered <button> elements', () => {
    const { container } = render(Button, {
      props: { label: 'Save', 'data-testid': 'button-rest-target' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-testid')).toBe('button-rest-target');
  });

  test('rest attributes forward to rendered <a> elements', () => {
    const { container } = render(Button, {
      props: { href: '/target', label: 'Open', 'data-testid': 'link-rest-target' },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('data-testid')).toBe('link-rest-target');
  });
});

describe('Button variants — new additions', () => {
  test('soft variant applies data-cinder-variant="soft"', () => {
    const { container } = render(Button, { props: { label: 'Soft', variant: 'soft' } });
    expect(container.querySelector('button')?.getAttribute('data-cinder-variant')).toBe('soft');
  });

  test('soft-danger variant applies data-cinder-variant="soft-danger"', () => {
    const { container } = render(Button, {
      props: { label: 'Delete', variant: 'soft-danger' },
    });
    expect(container.querySelector('button')?.getAttribute('data-cinder-variant')).toBe(
      'soft-danger',
    );
  });
});

describe('Button sizes — xl', () => {
  test('xl size applies data-cinder-size="xl"', () => {
    const { container } = render(Button, { props: { label: 'Big', size: 'xl' } });
    expect(container.querySelector('button')?.getAttribute('data-cinder-size')).toBe('xl');
  });

  test('sizes use the compact 24/28/32/36/40px height ladder', () => {
    expect(readButtonHeightToken('xs')).toBe(1.5);
    expect(readButtonHeightToken('sm')).toBe(1.75);
    expect(readButtonHeightToken('md')).toBe(2);
    expect(readButtonHeightToken('lg')).toBe(2.25);
    expect(readButtonHeightToken('xl')).toBe(2.5);
  });

  test('xl font size matches the shared button text size', () => {
    expect(readTokenSource()).toContain('--cinder-button-font-size-xl: var(--cinder-text-sm);');
  });
});

// NOTE: leadingIcon/trailingIcon snippet rendering (DOM order, aria-hidden wrapper) cannot be
// tested with @testing-library/svelte in happy-dom because the test harness cannot pass Svelte
// snippet props. Those paths are covered by manual playground inspection and tracked for a
// future Playwright test once the playground has browser test coverage.

describe('Button iconOnly', () => {
  test('iconOnly=true applies data-cinder-icon-only=""', () => {
    const { container } = render(Button, {
      props: { iconOnly: true, 'aria-label': 'Close', label: 'Close' } as any,
    });
    expect(container.querySelector('button')?.getAttribute('data-cinder-icon-only')).toBe('');
  });

  test('iconOnly=false does not apply data-cinder-icon-only', () => {
    const { container } = render(Button, { props: { label: 'Save', iconOnly: false } });
    expect(container.querySelector('button')?.hasAttribute('data-cinder-icon-only')).toBe(false);
  });
});

describe('Button loading state', () => {
  test('loading + label: label text remains in DOM', () => {
    const { getByText } = render(Button, { props: { label: 'Saving', loading: true } });
    // Label must remain in the DOM as the accessible name throughout loading.
    expect(getByText('Saving')).not.toBeNull();
  });

  test('loading + label: no DOM spinner node (spinner is a CSS pseudo-element)', () => {
    const { container } = render(Button, { props: { label: 'Saving', loading: true } });
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('.cinder-spinner')).toBeNull();
  });
});

describe('Button iconOnly sr-only label', () => {
  test('iconOnly=true with label renders label text in a sr-only span (no aria-label override)', () => {
    const { container, getByText } = render(Button, {
      props: { iconOnly: true, label: 'Close' } as any,
    });
    // Label text must be queryable — it's in a visually-hidden span.
    const labelNode = getByText('Close');
    expect(labelNode).not.toBeNull();
    expect(labelNode.className).toContain('cinder-sr-only');
    // The button should NOT have a synthesized aria-label attribute from label.
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBeNull();
  });

  test('iconOnly=true with aria-label does NOT render a sr-only span for label', () => {
    const { container } = render(Button, {
      props: { iconOnly: true, 'aria-label': 'Close dialog', label: 'Close' } as any,
    });
    // When aria-label is set it is the accessible name; sr-only label span should not appear.
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Close dialog');
    // label text should NOT be rendered as sr-only span when aria-label supplies the name
    const srOnlySpan = container.querySelector('.cinder-sr-only');
    expect(srOnlySpan).toBeNull();
  });

  test('iconOnly=true with whitespace aria-label falls back to sr-only label', () => {
    const { container } = render(Button, {
      props: { iconOnly: true, 'aria-label': '   ', label: 'Close' } as any,
    });

    const srOnlySpan = container.querySelector('.cinder-sr-only');
    expect(srOnlySpan).not.toBeNull();
    expect(srOnlySpan?.textContent).toBe('Close');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBeNull();
  });

  test('iconOnly=true with whitespace aria-labelledby falls back to sr-only label', () => {
    const { container } = render(Button, {
      props: { iconOnly: true, 'aria-labelledby': '   ', label: 'Close' } as any,
    });

    const srOnlySpan = container.querySelector('.cinder-sr-only');
    expect(srOnlySpan).not.toBeNull();
    expect(srOnlySpan?.textContent).toBe('Close');
    expect(container.querySelector('button')?.getAttribute('aria-labelledby')).toBeNull();
  });
});

describe('Button accessible name precedence', () => {
  test('aria-label takes precedence over label as the accessible name', () => {
    const { container } = render(Button, {
      props: { label: 'Close', 'aria-label': 'Close dialog' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Close dialog');
  });

  test('aria-labelledby is passed through to the element', () => {
    const { container } = render(Button, {
      props: { label: 'Close', 'aria-labelledby': 'dialog-title' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-labelledby')).toBe('dialog-title');
  });
});

describe('Button ghost-danger disabled state', () => {
  test('ghost-danger disabled button preserves data attributes', () => {
    const { container } = render(Button, {
      props: { label: 'Delete', variant: 'ghost-danger', 'aria-disabled': 'true' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-cinder-variant')).toBe('ghost-danger');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Button icon-only ghost CSS contract', () => {
  test('non-icon ghost variants remain transparent at rest', () => {
    const source = readButtonSource();

    const ghostBlock = readCssRuleBlock(source, ".cinder-button[data-cinder-variant='ghost']");
    expectDeclaration(ghostBlock, 'background', 'transparent');
    expectDeclaration(ghostBlock, 'border-color', 'transparent');

    const ghostDangerBlock = readCssRuleBlock(
      source,
      ".cinder-button[data-cinder-variant='ghost-danger']",
    );
    expectDeclaration(ghostDangerBlock, 'background', 'transparent');
    expectDeclaration(ghostDangerBlock, 'border-color', 'transparent');
  });

  test('icon-only ghost variants declare resting chrome', () => {
    const source = readButtonSource();

    const ghostBlock = readCssRuleBlock(
      source,
      ".cinder-button[data-cinder-icon-only][data-cinder-variant='ghost']",
    );
    expectDeclaration(ghostBlock, 'background', 'var(--cinder-surface)');
    expectDeclaration(ghostBlock, 'border-color', 'var(--cinder-border-muted)');
    expectColorMixBackgroundHasFallback(ghostBlock);

    const ghostDangerBlock = readCssRuleBlock(
      source,
      ".cinder-button[data-cinder-icon-only][data-cinder-variant='ghost-danger']",
    );
    expectDeclaration(ghostDangerBlock, 'background', 'var(--cinder-color-danger-bg)');
    expectDeclaration(ghostDangerBlock, 'border-color', 'var(--cinder-color-danger-border)');
    expectColorMixBackgroundHasFallback(ghostDangerBlock);
  });

  test('loading icon-only ghost-danger preserves resting chrome', () => {
    const source = readButtonSource();

    const transparentLoadingBlock = readCssRuleBlock(
      source,
      ".cinder-button[data-cinder-variant='ghost-danger'][data-cinder-loading]",
    );
    expectDeclaration(transparentLoadingBlock, 'background', 'transparent');
    expectDeclaration(transparentLoadingBlock, 'border-color', 'transparent');

    const iconOnlyLoadingBlock = readCssRuleBlock(
      source,
      ".cinder-button[data-cinder-icon-only][data-cinder-variant='ghost-danger'][data-cinder-loading]",
    );
    expectDeclaration(iconOnlyLoadingBlock, 'background', 'var(--cinder-color-danger-bg)');
    expectDeclaration(iconOnlyLoadingBlock, 'border-color', 'var(--cinder-color-danger-border)');
    expectColorMixBackgroundHasFallback(iconOnlyLoadingBlock);

    expect(source.indexOf(iconOnlyLoadingBlock)).toBeGreaterThan(
      source.indexOf(transparentLoadingBlock),
    );
  });

  test('forced-colors icon-only ghost variants use system button colors', () => {
    const source = readButtonSource();

    const ghostBlock = readCssRuleBlocks(
      source,
      ".cinder-button[data-cinder-icon-only][data-cinder-variant='ghost']",
    ).find((block) => block.includes('ButtonFace'));
    if (ghostBlock === undefined) throw new Error('Missing forced-colors icon-only ghost rule.');
    expectDeclaration(ghostBlock, 'background', 'ButtonFace');
    expectDeclaration(ghostBlock, 'border-color', 'ButtonBorder');
    expectDeclaration(ghostBlock, 'color', 'ButtonText');

    const ghostDangerBlock = readCssRuleBlocks(
      source,
      ".cinder-button[data-cinder-icon-only][data-cinder-variant='ghost-danger']",
    ).find((block) => block.includes('ButtonFace'));
    if (ghostDangerBlock === undefined) {
      throw new Error('Missing forced-colors icon-only ghost-danger rule.');
    }
    expectDeclaration(ghostDangerBlock, 'background', 'ButtonFace');
    expectDeclaration(ghostDangerBlock, 'border-color', 'ButtonBorder');
    expectDeclaration(ghostDangerBlock, 'color', 'ButtonText');
  });
});

describe('Button dev warnings', () => {
  let warnMessages: string[] = [];

  beforeEach(() => {
    warnMessages = [];
    captureWarningsForTest = true;
    console.warn = (...args: unknown[]) => {
      warnMessages.push(args.join(' '));
    };
  });

  test('iconOnly=true with aria-label: no iconOnly name warning', () => {
    render(Button, { props: { iconOnly: true, 'aria-label': 'Close' } as any });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings).toHaveLength(0);
  });

  test('iconOnly=true with label: no iconOnly name warning', () => {
    render(Button, { props: { iconOnly: true, label: 'Close' } as any });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings).toHaveLength(0);
  });

  test('iconOnly=true with neither label nor aria-label: iconOnly name warning IS emitted', () => {
    render(Button, { props: { iconOnly: true } as any });
    const iconOnlyWarnings = warnMessages.filter((m) =>
      m.includes('iconOnly=true requires aria-label'),
    );
    expect(iconOnlyWarnings.length).toBeGreaterThan(0);
  });

  test('iconOnly=true + aria-label + no visual icon: visible-icon warning IS emitted', () => {
    render(Button, { props: { iconOnly: true, 'aria-label': 'Close' } as any });
    const visualWarnings = warnMessages.filter((m) => m.includes('requires a visible icon'));
    expect(visualWarnings.length).toBeGreaterThan(0);
  });

  test('baseline guard: aria-label alone satisfies name requirement, no baseline warning', () => {
    render(Button, { props: { 'aria-label': 'Close' } as any });
    const baselineWarnings = warnMessages.filter((m) =>
      m.includes('rendered without an accessible name'),
    );
    expect(baselineWarnings).toHaveLength(0);
  });
});
