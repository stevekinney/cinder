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
  return /(?:__(?:header|row-header|column-header|footer|search|section|body|trigger|cell|stepper)(?![\w-])|[+~])/i.test(
    selector,
  );
}

function resolvesToRaisedSurface(value, customProperties, seen = new Set()) {
  if (/var\(\s*--cinder-surface-raised(?:-(?:hover|pressed))?\s*[,)]/.test(value)) return true;
  for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const token = match[1];
    if (seen.has(token)) continue;
    const replacement = customProperties.get(token);
    if (
      replacement &&
      resolvesToRaisedSurface(replacement, customProperties, new Set([...seen, token]))
    )
      return true;
  }
  return false;
}

function resolvesToBorder(value, token, customProperties, seen = new Set()) {
  const tokenPattern = new RegExp(`var\\(\\s*${token}\\s*(?:[,)]|$)`);
  if (tokenPattern.test(value)) return true;
  return [...value.matchAll(/var\(\s*(--[\w-]+)/g)].some(([, name]) => {
    if (seen.has(name)) return false;
    const replacement = customProperties.get(name);
    return (
      replacement !== undefined &&
      resolvesToBorder(replacement, token, customProperties, new Set([...seen, name]))
    );
  });
}

const plugin = stylelint.createPlugin(ruleName, (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] }))
    return;
  if (!isCinderComponentSource(root)) return;
  const customPropertyDeclarations = [];
  root.walkDecls((decl) => {
    if (!decl.prop.startsWith('--')) return;
    const parentRule = decl.parent?.type === 'rule' ? decl.parent.selector : ':root';
    customPropertyDeclarations.push({ name: decl.prop, value: decl.value, selector: parentRule });
  });
  const customPropertiesForRule = (selector) => {
    const properties = new Map();
    for (const declaration of customPropertyDeclarations) {
      if (
        declaration.selector === ':root' ||
        declaration.selector === selector ||
        selector.includes(declaration.selector)
      ) {
        properties.set(declaration.name, declaration.value);
      }
    }
    return properties;
  };
  root.walkRules((rule) => {
    const customProperties = customPropertiesForRule(rule.selector);
    rule.walkDecls((decl) => {
      if (
        decl.prop === 'border' &&
        decl.value.includes('var(--cinder-border-muted)') &&
        rule.nodes.some(
          (candidate) =>
            candidate.type === 'decl' &&
            (candidate.prop === 'background' || candidate.prop === 'background-color') &&
            resolvesToRaisedSurface(candidate.value, customProperties),
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
      if (resolvesToBorder(decl.value, '--cinder-border', customProperties)) {
        stylelint.utils.report({ ruleName, result, node: decl, message: messages.border() });
      }
    });
  });
});

plugin.ruleName = ruleName;
plugin.messages = messages;
plugin.meta = { url: 'https://github.com/stevekinney/cinder/blob/main/docs/tokens.md' };

export default plugin;
