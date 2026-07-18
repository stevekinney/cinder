import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import { parse, type AtRule, type Node, type Rule } from 'postcss';

function load(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

function loadSvelteStyle(relativePath: string): string {
  const source = load(relativePath);
  const match = source.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!match) throw new Error(`No <style> block found in ${relativePath}`);
  return match[1]!;
}

function findRules(css: string, selector: string): Rule[] {
  const matches: Rule[] = [];
  parse(css).walkRules((rule) => {
    if (rule.selectors.includes(selector)) matches.push(rule);
  });
  return matches;
}

function declarationValue(rule: Rule, property: string): string | undefined {
  let value: string | undefined;
  rule.walkDecls(property, (declaration) => {
    value = declaration.value;
  });
  return value;
}

function isUnderForcedColors(node: Node): boolean {
  let current = node.parent;
  while (current) {
    const atRule = current.type === 'atrule' ? (current as AtRule) : undefined;
    if (
      atRule !== undefined &&
      atRule.name.toLowerCase() === 'media' &&
      atRule.params
        .split(',')
        .every((branch) => /\(\s*forced-colors\s*:\s*active\s*\)/i.test(branch))
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

const TRANSPARENT_OUTLINE = 'var(--cinder-ring-width) solid transparent';
const SHARED_BOX_SHADOW = 'var(--_cinder-focus-ring-shadow)';

function assertInsetRecipe(css: string, selector: string): void {
  const base = findRules(css, selector).find((rule) => !isUnderForcedColors(rule));
  expect(base).toBeDefined();
  expect(declarationValue(base!, 'outline')).toBe(TRANSPARENT_OUTLINE);
  expect(declarationValue(base!, 'box-shadow')).toContain('inset');
  expect(declarationValue(base!, 'box-shadow')).toContain('var(--cinder-ring-color)');
  expect(declarationValue(base!, 'box-shadow')).not.toContain(SHARED_BOX_SHADOW);

  const fallback = findRules(css, selector).find((rule) => isUnderForcedColors(rule));
  expect(fallback).toBeDefined();
  expect(declarationValue(fallback!, 'outline')).toBe('var(--cinder-ring-width) solid ButtonText');
  expect(declarationValue(fallback!, 'outline-offset')).toBe('calc(var(--cinder-ring-width) * -1)');
}

function assertOuterRecipe(css: string, selector: string): void {
  const base = findRules(css, selector).find((rule) => !isUnderForcedColors(rule));
  expect(base).toBeDefined();
  expect(declarationValue(base!, 'outline')).toBe(TRANSPARENT_OUTLINE);
  expect(declarationValue(base!, 'box-shadow')).toContain(SHARED_BOX_SHADOW);

  const fallback = findRules(css, selector).find((rule) => isUnderForcedColors(rule));
  expect(fallback).toBeDefined();
  expect(declarationValue(fallback!, 'outline')).not.toContain('transparent');
}

const styles = {
  artifactPanel: loadSvelteStyle('../components/chat/artifact/artifact-panel.svelte'),
  chat: loadSvelteStyle('../components/chat/container/chat.svelte'),
  exportActions: loadSvelteStyle('../components/chat/export/conversation-export-actions.svelte'),
  input: loadSvelteStyle('../components/chat/input/chat-input.svelte'),
  jumpControls: loadSvelteStyle('../components/chat/container/chat-jump-controls.svelte'),
  lightbox: loadSvelteStyle('../components/chat/message/image-lightbox.svelte'),
  message: loadSvelteStyle('../components/chat/message/chat-message.svelte'),
  messageAttachments: loadSvelteStyle('../components/chat/message/message-attachments.svelte'),
  searchBar: loadSvelteStyle('../components/chat/container/chat-search-bar.svelte'),
  toolCallGroup: loadSvelteStyle('../components/chat/message/tool-call-group.svelte'),
};

describe('Chat focus-ring recipes', () => {
  const insetCases = [
    ['artifact-panel close', styles.artifactPanel, '.artifact-panel-close:focus-visible'],
    ['chat timeline', styles.chat, '.chat-timeline:focus-visible'],
    [
      'message attachment button',
      styles.messageAttachments,
      '.message-attachment-button:focus-visible',
    ],
    ['tool-call header', styles.toolCallGroup, '.tool-call-header:focus-visible'],
  ] as const;

  for (const [name, style, selector] of insetCases) {
    test(`${name} uses the inset recipe`, () => assertInsetRecipe(style, selector));
  }

  const outerCases = [
    [
      'chat export trigger',
      styles.exportActions,
      '.conversation-export-actions :global(.export-trigger:focus-visible)',
    ],
    ['chat empty prompt', styles.chat, '.chat-empty-prompt:focus-visible'],
    ['chat search navigation', styles.searchBar, '.chat-search-nav-button:focus-visible'],
    ['chat jump button', styles.jumpControls, '.chat-jump-button:focus-visible'],
    ['chat new indicator', styles.jumpControls, '.chat-new-indicator:focus-visible'],
    ['chat send button', styles.input, '.chat-input-send:focus-visible'],
    ['chat message row', styles.message, '.chat-message:focus-visible'],
    ['chat message expand', styles.message, '.chat-message-expand:focus-visible'],
    ['chat message retry', styles.message, '.chat-message-retry:focus-visible'],
    ['chat message action', styles.message, ':global(.chat-message-action-button:focus-visible)'],
    ['chat message edit save', styles.message, '.chat-message-edit-save:focus-visible'],
    ['chat message edit cancel', styles.message, '.chat-message-edit-cancel:focus-visible'],
  ] as const;

  for (const [name, style, selector] of outerCases) {
    test(`${name} uses the outer recipe`, () => assertOuterRecipe(style, selector));
  }

  test('message edit textarea uses the outer recipe and Highlight fallback', () => {
    const selector = '.chat-message-edit-textarea:focus';
    assertOuterRecipe(styles.message, selector);
    const fallback = findRules(styles.message, selector).find((rule) => isUnderForcedColors(rule));
    expect(declarationValue(fallback!, 'outline')).toBe('var(--cinder-ring-width) solid Highlight');
    expect(declarationValue(fallback!, 'outline-offset')).toBe('1px');
  });

  test('stop state does not override the shared send-button focus ring', () => {
    expect(findRules(styles.input, '.chat-input-send[data-stop]:focus-visible')).toEqual([]);
  });

  test('attachment removal paints its inset ring on the visible chip', () => {
    const selector = '.chat-input-attachment-remove:focus-visible::before';
    const base = findRules(styles.input, selector).find((rule) => !isUnderForcedColors(rule));
    expect(declarationValue(base!, 'box-shadow')).toContain('inset');
    expect(declarationValue(base!, 'box-shadow')).toContain('var(--cinder-ring-color)');
    expect(declarationValue(base!, 'box-shadow')).not.toContain(SHARED_BOX_SHADOW);

    const fallback = findRules(styles.input, selector).find((rule) => isUnderForcedColors(rule));
    expect(declarationValue(fallback!, 'box-shadow')).toBe('none');
    expect(declarationValue(fallback!, 'outline')).toBe(
      'var(--cinder-ring-width) solid ButtonText',
    );
    expect(declarationValue(fallback!, 'outline-offset')).toBe('var(--cinder-ring-offset)');
  });

  for (const selector of ['.lightbox-close:focus-visible', '.lightbox-nav:focus-visible']) {
    test(`${selector} preserves the white-over-photo exception`, () => {
      const rule = findRules(styles.lightbox, selector).find(
        (entry) => !isUnderForcedColors(entry),
      );
      expect(declarationValue(rule!, 'outline')).toBe('2px solid white');
    });
  }

  test('both lightbox exceptions carry the Stylelint allowlist comment', () => {
    expect(
      styles.lightbox.match(/stylelint-disable-next-line cinder\/no-focus-visible-colored-outline/g)
        ?.length,
    ).toBe(2);
  });

  test('conversation-list button repaints its forced-colors outline', () => {
    const css = load('../components/chat-conversation-list/chat-conversation-list.css');
    const selector =
      '.cinder-chat-conversation-list__button[data-cinder-conversation-interactive]:focus-visible';
    const base = findRules(css, selector).find((rule) => !isUnderForcedColors(rule));
    expect(declarationValue(base!, 'outline')).toContain('transparent');
    expect(declarationValue(base!, 'box-shadow')).toBeDefined();

    const fallback = findRules(css, selector).find((rule) => isUnderForcedColors(rule));
    expect(declarationValue(fallback!, 'outline')).toBe(
      'var(--cinder-ring-width) solid ButtonText',
    );
    expect(declarationValue(fallback!, 'outline-offset')).toBe('3px');
    expect(declarationValue(fallback!, 'box-shadow')).toBe('none');
  });
});
