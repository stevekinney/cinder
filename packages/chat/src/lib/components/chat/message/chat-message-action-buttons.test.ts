/**
 * Source-contract regression for the chat message action buttons (Slice 1 of
 * the P7 editors-and-complex residual audit).
 *
 * `ChatMessage` is too heavy to mount usefully in happy-dom for these CSS/touch
 * concerns, so we assert against the component source text. The Playwright
 * slice (`tests/editors-complex-residual.playwright.ts`) covers the rendered
 * computed-style behavior.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dir, 'chat-message.svelte'), 'utf8');

describe('chat message action buttons', () => {
  test('copy action uses CopyButton with both shared base class and copy-specific class', () => {
    // CopyButton receives the classes as a prop; source shows them in the `class` attribute value.
    expect(source).toContain('chat-message-action-button chat-message-copy');
    // The edit button still renders a raw button with the shared base class.
    expect(source).toContain('class="chat-message-action-button chat-message-edit-button"');
  });

  test('exactly one .chat-message-action-button base selector exists outside the touch block', () => {
    const withoutTouchBlock = source.replace(extractTouchMediaBlock(source), '');
    // The selector is wrapped in :global() so Svelte scoping does not prevent it
    // from reaching the CopyButton child component's rendered <button>.
    const baseRuleMatches = withoutTouchBlock.match(
      /(?::global\()?\.chat-message-action-button(?:\))?\s*\{/g,
    );
    expect(baseRuleMatches).not.toBeNull();
    expect(baseRuleMatches).toHaveLength(1);
  });

  test('base rule uses border-box sizing and a transparent reserving border', () => {
    const withoutTouchBlock = source.replace(extractTouchMediaBlock(source), '');
    const baseRule = extractRule(withoutTouchBlock, ':global(.chat-message-action-button) {');
    expect(baseRule).toContain('box-sizing: border-box');
    expect(baseRule).toContain('border: 1px solid transparent');
  });

  test('touch media block gives a resting background and border-color', () => {
    const touchBlock = extractTouchMediaBlock(source);
    expect(touchBlock).toContain('.chat-message-action-button');
    expect(touchBlock).toMatch(
      /(?::global\()?\.chat-message-action-button(?:\))?\s*\{[^}]*background:/,
    );
    expect(touchBlock).toMatch(
      /(?::global\()?\.chat-message-action-button(?:\))?\s*\{[^}]*border-color:/,
    );
  });

  test('narrow-viewport footer reset uses logical inset properties', () => {
    const resetBlock = extractRule(
      source,
      ".chat-message-wrapper[data-role='snapshot'] .chat-message-footer {",
    );
    expect(resetBlock).toContain('inset-inline-start: 0');
    expect(resetBlock).toContain('inset-inline-end: auto');
    expect(resetBlock).not.toMatch(/(^|\s)left:\s*0/);
    expect(resetBlock).not.toMatch(/(^|\s)right:\s*auto/);
  });

  test('below-bubble footer spacing is an in-box hover bridge', () => {
    const footerRule = extractRule(source, '\n  .chat-message-footer {');
    expect(footerRule).toContain('padding-top: var(--cinder-space-1)');
    expect(footerRule).not.toContain('margin-top: var(--cinder-space-1)');

    const desktopRules = source.slice(0, source.indexOf('@media (max-width: 480px)'));
    for (const role of ['developer', 'system', 'snapshot', 'tool-call', 'tool-result']) {
      expect(desktopRules).not.toContain(
        `.chat-message-wrapper[data-role='${role}'] .chat-message-footer {`,
      );
    }

    const toolPairRule = extractRule(
      source,
      '.chat-message-wrapper[data-tool-pair] .chat-message-footer {',
    );
    expect(toolPairRule).not.toMatch(/(?:margin|padding)-top:/);
  });

  test('desktop side footers clear the below-bubble bridge', () => {
    for (const role of ['user', 'assistant']) {
      const rule = extractRule(
        source,
        `.chat-message-wrapper[data-role='${role}'] .chat-message-footer {`,
      );
      expect(rule).toContain('padding-top: 0');
    }
  });

  test('narrow side footers restore the below-bubble hover bridge', () => {
    const resetBlock = extractRule(
      source,
      ".chat-message-wrapper[data-role='snapshot'] .chat-message-footer {",
    );
    expect(resetBlock).toContain('padding-top: var(--cinder-space-1)');
    expect(resetBlock).not.toContain('margin-top: var(--cinder-space-1)');
  });

  // Regression for #777: a `display: none` footer on tool-paired rows can
  // never be resurrected by the shared `:hover`/`:focus-within` rule (which
  // only toggles opacity/pointer-events), making retry/edit/copy and any
  // consumer `messageActions` snippet content permanently unreachable by
  // mouse or keyboard on those rows.
  test('tool-pair footer override hides via opacity, not display: none', () => {
    const rule = extractRule(
      source,
      '.chat-message-wrapper[data-tool-pair] .chat-message-footer {',
    );
    expect(rule).not.toContain('display: none');
    expect(rule).toContain('opacity: 0');
    expect(rule).toContain('pointer-events: none');
  });

  test('the shared hover/focus-within reveal rule applies to every wrapper, including tool-paired rows', () => {
    // No role- or attribute-scoped selector narrows this rule away from
    // `[data-tool-pair]` wrappers — it targets the generic `.chat-message-wrapper`.
    // Whitespace-tolerant (rather than an exact-string match) so a future
    // formatter pass on `chat-message.svelte` can't silently break this
    // assertion.
    expect(source).toMatch(
      /\.chat-message-wrapper:hover\s+\.chat-message-footer\s*,\s*\.chat-message-wrapper:focus-within\s+\.chat-message-footer\s*\{/,
    );
  });

  test('keyboard focus within any message wrapper still reveals its footer', () => {
    expect(source).toMatch(
      /\.chat-message-wrapper:focus-within\s+\.chat-message-footer\s*\{[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;/s,
    );
  });

  test('touch devices reveal the tool-pair footer too, matching its higher specificity', () => {
    // The tool-pair hidden-state override has higher specificity than the
    // bare `.chat-message-footer` touch rule, so it needs its own entry in
    // the touch media block or tool-paired rows stay unreachable on touch.
    const touchBlock = extractTouchMediaBlock(source, '.chat-message-footer');
    expect(touchBlock).toContain('.chat-message-wrapper[data-tool-pair] .chat-message-footer');
  });
});

function extractRule(text: string, opening: string): string {
  const start = text.indexOf(opening);
  if (start === -1) throw new Error(`rule not found: ${opening}`);
  const bodyStart = start + opening.length;
  const end = text.indexOf('}', bodyStart);
  return text.slice(bodyStart, end);
}

function extractTouchMediaBlock(
  text: string,
  contains: string = '.chat-message-action-button',
): string {
  const marker = '@media (hover: none) or (pointer: coarse) {';
  let searchFrom = 0;
  for (;;) {
    const start = text.indexOf(marker, searchFrom);
    if (start === -1) throw new Error(`touch media block containing "${contains}" not found`);
    let depth = 0;
    let i = text.indexOf('{', start);
    const bodyStart = i + 1;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          const body = text.slice(bodyStart, i);
          if (body.includes(contains)) return body;
          searchFrom = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) throw new Error('touch media block not balanced');
  }
}
