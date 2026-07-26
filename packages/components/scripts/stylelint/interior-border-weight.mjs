/** Stylelint rule: interior component dividers use the muted border token. */
import stylelint from 'stylelint';

const ruleName = 'cinder/interior-border-weight';
const messages = stylelint.utils.ruleMessages(ruleName, {
  border: () =>
    'Interior dividers must use `--cinder-border-muted`; reserve `--cinder-border` for a component outer edge.',
  raisedOuterBorder: () =>
    'Raised surfaces with a full outer border must use `--cinder-border`, not the muted interior-divider token.',
});

function isCinderComponentSource(root) {
  const file = root.source?.input?.file;
  return (
    file === undefined ||
    file.startsWith('<') ||
    /packages[\\/]components[\\/]src[\\/]components[\\/]/.test(file)
  );
}

function isInteriorDivider(selector, property) {
  if (property === 'border') return false;
  return /(?:__(?:header|footer|search|section|body|trigger|cell|stepper)(?![\w-])|[+~])/i.test(
    selector,
  );
}

const plugin = stylelint.createPlugin(ruleName, (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] }))
    return;
  if (!isCinderComponentSource(root)) return;
  const customProperties = new Map();
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) customProperties.set(decl.prop, decl.value);
  });
  const resolvesToRaisedSurface = (value, seen = new Set()) => {
    if (value.includes('var(--cinder-surface-raised)')) return true;
    for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
      const token = match[1];
      if (seen.has(token)) continue;
      const replacement = customProperties.get(token);
      if (replacement && resolvesToRaisedSurface(replacement, new Set([...seen, token])))
        return true;
    }
    return false;
  };
  root.walkRules((rule) => {
    rule.walkDecls((decl) => {
      if (
        decl.prop === 'border' &&
        decl.value.includes('var(--cinder-border-muted)') &&
        rule.nodes.some(
          (candidate) =>
            candidate.type === 'decl' &&
            (candidate.prop === 'background' || candidate.prop === 'background-color') &&
            resolvesToRaisedSurface(candidate.value),
        )
      ) {
        stylelint.utils.report({
          ruleName,
          result,
          node: decl,
          message: messages.raisedOuterBorder(),
        });
        return;
      }
      if (!/^border(?:-(?:block|inline)-(?:start|end)|-(?:top|bottom))?$/.test(decl.prop)) return;
      if (!isInteriorDivider(rule.selector, decl.prop)) return;
      if (decl.value.includes('var(--cinder-border)')) {
        stylelint.utils.report({ ruleName, result, node: decl, message: messages.border() });
      }
    });
  });
});

plugin.ruleName = ruleName;
plugin.messages = messages;
plugin.meta = { url: 'https://github.com/stevekinney/cinder/blob/main/docs/tokens.md' };

export default plugin;
