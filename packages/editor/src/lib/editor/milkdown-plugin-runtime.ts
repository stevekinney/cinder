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
 * The Ctx primitives `createLazyProsePlugin`/`createLazyInputRule` need to
 * register a timer that gates `EditorState.create()` — see
 * `resolveLazyPluginRuntime` below for why that registration has to happen
 * synchronously, which is the whole reason this cache exists.
 */
type LazyPluginRuntime = {
  createTimer: typeof import('@milkdown/ctx').createTimer;
  SchemaReady: typeof import('@milkdown/kit/core').SchemaReady;
  prosePluginsCtx: typeof import('@milkdown/kit/core').prosePluginsCtx;
  inputRulesCtx: typeof import('@milkdown/kit/core').inputRulesCtx;
  editorStateTimerCtx: typeof import('@milkdown/kit/core').editorStateTimerCtx;
};

let lazyPluginRuntime: LazyPluginRuntime | null = null;
let lazyPluginRuntimePromise: Promise<LazyPluginRuntime> | null = null;

async function resolveLazyPluginRuntime(): Promise<LazyPluginRuntime> {
  if (lazyPluginRuntime) return lazyPluginRuntime;

  lazyPluginRuntimePromise ??= (async () => {
    // `createTimer` lives in `@milkdown/ctx`, a separate package from
    // `@milkdown/kit/core` — both dynamic imports here, matching this
    // module's own no-static-@milkdown/-value-import contract (enforced by
    // ssr-import.test.ts's "keeps Milkdown runtime imports lazy" scan, which
    // checks the `@milkdown/` prefix generally, not just `@milkdown/kit/`).
    const [{ createTimer }, { SchemaReady, prosePluginsCtx, inputRulesCtx, editorStateTimerCtx }] =
      await Promise.all([import('@milkdown/ctx'), import('@milkdown/kit/core')]);
    return { createTimer, SchemaReady, prosePluginsCtx, inputRulesCtx, editorStateTimerCtx };
  })();

  lazyPluginRuntime = await lazyPluginRuntimePromise;
  return lazyPluginRuntime;
}

/**
 * Load `@milkdown/kit/core` and cache the handful of Ctx primitives this
 * module's factories need, before any plugin built by them is `.use()`d.
 *
 * `createEditor()` calls this alongside `preloadCommandRuntime()`, before
 * building the editor — this module never imports `@milkdown/kit/core`
 * itself at module-evaluation time (that's the "without importing Milkdown
 * runtime modules at package import time" this module exists for), so the
 * cache has to be primed by a caller that already pays that import cost.
 */
export async function preloadLazyPluginRuntime(): Promise<void> {
  await resolveLazyPluginRuntime();
}

/** Synchronous accessor: the cache if primed, `null` otherwise. Never blocks. */
function getLazyPluginRuntime(): LazyPluginRuntime | null {
  if (lazyPluginRuntime) return lazyPluginRuntime;
  lazyPluginRuntimePromise ??= resolveLazyPluginRuntime();
  return null;
}

/**
 * Register a ProseMirror plugin without importing Milkdown runtime modules at package import time.
 *
 * cinder#1306: `EditorState.create()` (Milkdown's internal `editorState`
 * plugin) snapshots `ctx.get(prosePluginsCtx)` once, after awaiting a FIXED
 * set of timers recorded in `editorStateTimerCtx` — a plugin registered
 * AFTER that snapshot is silently absent from the editor for its entire
 * life, even though `prosePluginsCtx`'s live value later includes it.
 * Milkdown's own `$proseAsync` avoids this by registering a new timer into
 * `editorStateTimerCtx` — synchronously, in the plugin's OUTER `(ctx) => ...`
 * function, because every plugin's outer function runs during
 * `Editor.create()`'s `#prepare()` phase, before ANY plugin's handler
 * (including the one that eventually reads `editorStateTimerCtx`) executes.
 * That ordering is what makes the registration race-free: presence in the
 * array is settled before anyone starts waiting on it, and only the timer's
 * COMPLETION is genuinely awaited afterward.
 *
 * This function used to do neither: no timer, and the plugin's own
 * registration was gated behind a dynamic `import('@milkdown/kit/core')`
 * inside its ASYNC handler — a further delay stacked on top of an
 * already-unguarded push. `EditorState.create()` could (and did, for
 * `placeholderPlugin` — cinder#1306's repro) run before that import even
 * resolved.
 *
 * Fixed by mirroring `$proseAsync`'s timer registration, using the cache
 * `preloadLazyPluginRuntime()` primes: if primed (as it always is through
 * `createEditor()`), the outer function below registers the timer
 * synchronously and the handler skips its own `@milkdown/kit/core` import
 * entirely, using the cached references instead. If unprimed — unreachable
 * through `createEditor()`, kept only so a hypothetical caller that skips
 * preloading still gets a working (if unordered, pre-fix) plugin rather than
 * a hard failure — falls back to the original dynamic-import behavior.
 */
export function createLazyProsePlugin(
  createProseMirrorPlugin: (context: Ctx) => Plugin | Promise<Plugin>,
) {
  let prosePlugin: Plugin | undefined;

  const milkdownPlugin: MilkdownPlugin = (context) => {
    const runtime = getLazyPluginRuntime();

    if (runtime) {
      const timer = runtime.createTimer('lazyProsePlugin');
      context.record(timer);
      context.update(runtime.editorStateTimerCtx, (timers) => [...timers, timer]);

      return async () => {
        try {
          await context.wait(runtime.SchemaReady);
          const registeredPlugin = await createProseMirrorPlugin(context);
          prosePlugin = registeredPlugin;
          context.update(runtime.prosePluginsCtx, (plugins) => [...plugins, registeredPlugin]);
        } finally {
          // Always mark the timer done, even on failure: an uncaught error
          // here would otherwise stall EditorState.create() for the timer's
          // full timeout (Milkdown's default 3s) rather than surfacing the
          // real error immediately — the error itself still propagates,
          // rejecting this handler's promise as normal.
          context.done(timer);
        }

        return () => {
          context.update(runtime.prosePluginsCtx, (plugins) =>
            plugins.filter((plugin) => plugin !== prosePlugin),
          );
          context.update(runtime.editorStateTimerCtx, (timers) =>
            timers.filter((t) => t !== timer),
          );
          context.clearTimer(timer);
        };
      };
    }

    return async () => {
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
 *
 * Shares `createLazyProsePlugin`'s cinder#1306 fix: `EditorState.create()`
 * snapshots `ctx.get(inputRulesCtx)` the same way and at the same moment it
 * snapshots `prosePluginsCtx` (Milkdown's `editorState` internal plugin reads
 * both back to back), so an input rule registered here raced
 * `EditorState.create()` identically. See `createLazyProsePlugin`'s doc
 * comment for the full mechanism.
 */
export function createLazyInputRule(
  createInputRule: (context: Ctx) => InputRule | Promise<InputRule>,
) {
  const milkdownPlugin: MilkdownPlugin = (context) => {
    const runtime = getLazyPluginRuntime();

    if (runtime) {
      const timer = runtime.createTimer('lazyInputRule');
      context.record(timer);
      context.update(runtime.editorStateTimerCtx, (timers) => [...timers, timer]);

      return async () => {
        let inputRule: InputRule | undefined;
        try {
          await context.wait(runtime.SchemaReady);
          inputRule = await createInputRule(context);
          context.update(runtime.inputRulesCtx, (inputRules) => [...inputRules, inputRule!]);
          lazyPlugin.inputRule = inputRule;
        } finally {
          context.done(timer);
        }

        return () => {
          context.update(runtime.inputRulesCtx, (inputRules) =>
            inputRules.filter((registeredInputRule) => registeredInputRule !== inputRule),
          );
          context.update(runtime.editorStateTimerCtx, (timers) =>
            timers.filter((t) => t !== timer),
          );
          context.clearTimer(timer);
        };
      };
    }

    return async () => {
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
  };

  const lazyPlugin: LazyInputRulePlugin = milkdownPlugin;
  return lazyPlugin;
}
