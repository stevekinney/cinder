export function resolveNpmPublishCommand(input: {
  nodeExecutable: string;
  npmCliPath: string | undefined;
  publishArguments: string[];
}): {
  command: string;
  arguments: string[];
};
