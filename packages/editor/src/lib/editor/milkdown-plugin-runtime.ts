import type { Ctx, MilkdownPlugin } from '@milkdown/ctx';
import type { InputRule } from '@milkdown/kit/prose/inputrules';
import type { Plugin, PluginKey } from '@milkdown/kit/prose/state';

/** Milkdown plugin wrapper that exposes the registered ProseMirror plugin lazily. */
export type LazyProsePlugin = MilkdownPlugin & {
  plugin: () => Plugin;
  key: () => PluginKey | undefined;
};

/** Milkdown plugin wrapper that records the registered input rule after initialization. */
export type LazyInputRulePlugin = MilkdownPlugin & {
  inputRule?: InputRule;
};

/**
 * Register a ProseMirror plugin without importing Milkdown runtime modules at package import time.
 */
export function createLazyProsePlugin(
  createProseMirrorPlugin: (context: Ctx) => Plugin | Promise<Plugin>,
) {
  let prosePlugin: Plugin | undefined;

  const milkdownPlugin: MilkdownPlugin = (context) => async () => {
    const { SchemaReady, prosePluginsCtx } = await import('@milkdown/kit/core');

    await context.wait(SchemaReady);
    const registeredPlugin = await createProseMirrorPlugin(context);
    prosePlugin = registeredPlugin;
    context.update(prosePluginsCtx, (plugins) => [...plugins, registeredPlugin]);

    return () => {
      context.update(prosePluginsCtx, (plugins) =>
        plugins.filter((plugin) => plugin !== registeredPlugin),
      );
    };
  };

  const lazyPlugin: LazyProsePlugin = Object.assign(milkdownPlugin, {
    plugin: (): Plugin => {
      if (!prosePlugin) {
        throw new Error('ProseMirror plugin has not been registered yet.');
      }

      return prosePlugin;
    },
    key: (): PluginKey | undefined => prosePlugin?.spec.key,
  });

  return lazyPlugin;
}

/**
 * Register a ProseMirror input rule without importing Milkdown runtime modules at package import time.
 */
export function createLazyInputRule(
  createInputRule: (context: Ctx) => InputRule | Promise<InputRule>,
) {
  const milkdownPlugin: MilkdownPlugin = (context) => async () => {
    const { SchemaReady, inputRulesCtx } = await import('@milkdown/kit/core');

    await context.wait(SchemaReady);
    const inputRule = await createInputRule(context);
    context.update(inputRulesCtx, (inputRules) => [...inputRules, inputRule]);
    lazyPlugin.inputRule = inputRule;

    return () => {
      context.update(inputRulesCtx, (inputRules) =>
        inputRules.filter((registeredInputRule) => registeredInputRule !== inputRule),
      );
    };
  };

  const lazyPlugin: LazyInputRulePlugin = milkdownPlugin;
  return lazyPlugin;
}
