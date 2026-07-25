/** Stylelint rule: interior component dividers use the muted border token. */
import stylelint from 'stylelint';

const ruleName = 'cinder/interior-border-weight';
const messages = stylelint.utils.ruleMessages(ruleName, {
  border: () =>
    'Interior dividers must use `--cinder-border-muted`; reserve `--cinder-border` for a component outer edge.',
});

function isCinderComponentSource(root) {
  const file = root.source?.input?.file;
  return (
    file === undefined ||
    file.startsWith('<') ||
    /packages[\\/]components[\\/]src[\\/]components[\\/]/.test(file)
  );
}

function isInterior(selector) {
  return /(?:__header|__footer|__row|__search|__section|__body|__trigger|__item|[>+~])/i.test(
    selector,
  );
}

const plugin = stylelint.createPlugin(ruleName, (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] }))
    return;
  if (!isCinderComponentSource(root)) return;
  root.walkRules((rule) => {
    if (!isInterior(rule.selector)) return;
    rule.walkDecls((decl) => {
      if (!/^border(?:-(?:block|inline)-(?:start|end)|-(?:top|bottom))?$/.test(decl.prop)) return;
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
