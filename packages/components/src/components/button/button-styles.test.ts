import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
setupHappyDom();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Button } = await import('./button.svelte');
afterEach(cleanup);

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

  test('font-size ladder: lg=md-token, xl=lg-token, md stays sm', () => {
    const source = readTokenSource();
    expect(source).toContain('--cinder-button-font-size-md: var(--cinder-text-sm);');
    expect(source).toContain('--cinder-button-font-size-lg: var(--cinder-text-md);');
    expect(source).toContain('--cinder-button-font-size-xl: var(--cinder-text-lg);');
  });

  test('text scale defines the md step at 15px', () => {
    expect(readTokenSource()).toContain('--cinder-text-md: 0.9375rem;');
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
    expectDeclaration(ghostDangerBlock, 'background', 'var(--cinder-status-danger-background)');
    expectDeclaration(ghostDangerBlock, 'border-color', 'var(--cinder-status-danger-border)');
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
    expectDeclaration(iconOnlyLoadingBlock, 'background', 'var(--cinder-status-danger-background)');
    expectDeclaration(iconOnlyLoadingBlock, 'border-color', 'var(--cinder-status-danger-border)');
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

describe('Button secondary surface states', () => {
  test('uses the public component variables for its resting surface', () => {
    const block = readCssRuleBlock(
      readButtonSource(),
      ".cinder-button[data-cinder-variant='secondary']",
    );
    expectDeclaration(block, 'background', 'var(--cinder-button-background)');
    expectDeclaration(block, 'color', 'var(--cinder-button-foreground)');
    expectDeclaration(block, 'border-color', 'var(--cinder-button-border)');
  });

  test('derives hover and pressed feedback from the raised resting fill', () => {
    const source = readButtonSource();
    expect(source).toMatch(
      /data-cinder-variant='secondary'\]:hover[\s\S]*?background:\s*var\(--cinder-surface-raised-hover\)/,
    );
    expect(source).toMatch(
      /data-cinder-variant='secondary'\]:active[\s\S]*?background:\s*var\(--cinder-surface-raised-pressed\)/,
    );
  });
});
