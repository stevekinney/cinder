/** Stylelint rule: form controls use the raised surface token. */
import stylelint from 'stylelint';

const ruleName = 'cinder/no-surface-on-form-control';
const messages = stylelint.utils.ruleMessages(ruleName, {
  surface: () =>
    'Form controls must use `--cinder-surface-raised`, not `--cinder-surface`, for their background.',
});
function resolveValue(value, variables, seen = new Set()) {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]+))?\)/g, (_match, name, fallback) => {
    if (seen.has(name)) return fallback?.trim() ?? '';
    if (!variables.has(name) && !fallback) return `var(${name})`;
    const next = variables.get(name) ?? fallback?.trim() ?? `var(${name})`;
    return next ? resolveValue(next, variables, new Set([...seen, name])) : '';
  });
}

function isCinderComponentSource(root) {
  const file = root.source?.input?.file;
  return (
    file === undefined ||
    file.startsWith('<') ||
    /packages[\\/]components[\\/]src[\\/](?:components|styles[\\/]components)[\\/]/.test(file)
  );
}

function isFormControl(selector) {
  return /(?:^|[\s,>+~])(?:input|textarea|select|\.cinder-(?:input|textarea|select)|\.cinder-_input-frame)(?=[.#:[\s]|$)|\[role\s*=\s*["'](?:textbox|combobox|spinbutton)["']\]|(?:__input|__textarea|__select)(?:\b|[-_:])/i.test(
    selector,
  );
}

const plugin = stylelint.createPlugin(ruleName, (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary, possible: [true] }))
    return;
  if (!isCinderComponentSource(root)) return;
  const variables = new Map();
  root.walkDecls((decl) => {
    if (decl.prop.startsWith('--')) variables.set(decl.prop, decl.value.trim());
  });
  root.walkRules((rule) => {
    if (!isFormControl(rule.selector)) return;
    rule.walkDecls((decl) => {
      if (decl.prop !== 'background' && decl.prop !== 'background-color') return;
      if (
        decl.value.trim() === 'var(--cinder-surface)' ||
        resolveValue(decl.value.trim(), variables) === 'var(--cinder-surface)'
      ) {
        stylelint.utils.report({ ruleName, result, node: decl, message: messages.surface() });
      }
    });
  });
});

plugin.ruleName = ruleName;
plugin.messages = messages;
plugin.meta = { url: 'https://github.com/stevekinney/cinder/blob/main/docs/tokens.md' };

export default plugin;
