/** Stylelint rule: form controls use the raised surface token. */
import stylelint from 'stylelint';

const ruleName = 'cinder/no-surface-on-form-control';
const messages = stylelint.utils.ruleMessages(ruleName, {
  surface: () =>
    'Form controls must use `--cinder-surface-raised`, not `--cinder-surface`, for their background.',
});
function variableFunctions(value) {
  const functions = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!value.startsWith('var(', index)) continue;
    let depth = 1;
    let end = index + 4;
    for (; end < value.length && depth > 0; end += 1) {
      if (value[end] === '(') depth += 1;
      if (value[end] === ')') depth -= 1;
    }
    if (depth !== 0) continue;
    const body = value.slice(index + 4, end - 1);
    const comma = body.indexOf(',');
    functions.push({
      name: (comma < 0 ? body : body.slice(0, comma)).trim(),
      fallback: comma < 0 ? '' : body.slice(comma + 1).trim(),
    });
    index = end - 1;
  }
  return functions;
}

function resolvesToSurface(value, variables, seen = new Set()) {
  if (value.includes('var(--cinder-surface)')) return true;
  return variableFunctions(value).some(({ name, fallback }) => {
    if (seen.has(name)) return false;
    const replacement = variables.get(name) ?? fallback;
    return (
      replacement !== '' && resolvesToSurface(replacement, variables, new Set([...seen, name]))
    );
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
  return /(?:^|[\s,>+~])(?:input|textarea|select|\.cinder-(?:input|textarea|select|checkbox|radio)|\.cinder-_input-frame|\.cinder-pin-input__segment)(?=[.#:[\s]|$)|\[role\s*=\s*["'](?:textbox|combobox|spinbutton)["']\]|(?:__input|__textarea|__select)(?:\b|[-_:])/i.test(
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
        resolvesToSurface(decl.value.trim(), variables)
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
