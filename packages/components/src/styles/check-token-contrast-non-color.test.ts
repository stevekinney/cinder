import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const tokenDocumentationPath = join(import.meta.dirname, '..', '..', 'documentation', 'tokens.md');
const sourcePath = (...candidates: string[]) => {
  const path = candidates.map((candidate) => join(repositoryRoot, candidate)).find(existsSync);
  if (path === undefined)
    throw new Error(`Expected one of these repository paths: ${candidates.join(', ')}`);
  return path;
};

describe('non-color component tokens', () => {
  it('documents the Chat typography control and keeps it out of the color contract', () => {
    const chatCss = readFileSync(
      sourcePath(
        'components/chat/src/lib/components/chat/chat.css',
        'packages/chat/src/lib/components/chat/chat.css',
      ),
      'utf8',
    );
    const tokenDocumentation = readFileSync(tokenDocumentationPath, 'utf8');

    expect(chatCss).toContain('--cinder-chat-font-size: 1rem');
    expect(chatCss).toContain('--_cinder-chat-text-base: clamp(');
    expect(tokenDocumentation).toContain('`--cinder-chat-font-size`');
  });

  // Publishing a token through `chat.variables.*` and the generated README
  // makes it supported customization API, which carries a documentation
  // obligation. This pins that obligation so the two cannot drift: a default
  // changed in CSS without the docs following, or the token removed from one
  // side only, fails here.
  it('documents the Chat transcript measure and keeps it out of the color contract', () => {
    const chatCss = readFileSync(
      sourcePath(
        'components/chat/src/lib/components/chat/chat.css',
        'packages/chat/src/lib/components/chat/chat.css',
      ),
      'utf8',
    );
    const chatVariables = readFileSync(
      sourcePath(
        'components/chat/src/lib/components/chat/chat.variables.json',
        'packages/chat/src/lib/components/chat/chat.variables.json',
      ),
      'utf8',
    );
    const tokenDocumentation = readFileSync(tokenDocumentationPath, 'utf8');
    const tokenBaseCss = readFileSync(
      sourcePath(
        'components/cinder/src/styles/tokens-base.css',
        'packages/components/src/styles/tokens-base.css',
      ),
      'utf8',
    );

    // Registered with `@property` (so ancestor overrides inherit) rather than
    // declared on the component root, where a value would beat inheritance.
    expect(chatCss).toMatch(
      /@property --cinder-chat-message-max-width \{\s*syntax: '\*';\s*inherits: true;\s*initial-value: 48rem;\s*\}/,
    );
    expect(chatCss).not.toMatch(/--cinder-chat-message-max-width:\s*[^;]+;/);
    // Registered in the CSS sidecar rather than a scoped <style>, which is what
    // makes it reachable by the artifact generator at all.
    expect(chatVariables).toContain('--cinder-chat-message-max-width');
    expect(tokenDocumentation).toContain('`--cinder-chat-message-max-width`');
    expect(tokenDocumentation).toContain('48rem');
    // A layout measure has no contrast to gate. It belongs to Chat's sidecar,
    // not to the color contract this file audits, so its absence from
    // `tokens-base.css` is part of what is being pinned.
    expect(tokenBaseCss).not.toContain('--cinder-chat-message-max-width');
  });
});
