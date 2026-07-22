export const MCP_OPTIONAL_DEPENDENCIES_MESSAGE =
  'bun add zod @modelcontextprotocol/sdk to use the cinder MCP server.';

/** Distinguish an absent optional package from failures inside that package. */
export function isModuleNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') return true;
  return /Cannot find (module|package)/.test(error.message);
}

export async function importOptionalMcpDependency<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isModuleNotFoundError(error)) {
      throw new Error(MCP_OPTIONAL_DEPENDENCIES_MESSAGE, { cause: error });
    }
    throw error;
  }
}
