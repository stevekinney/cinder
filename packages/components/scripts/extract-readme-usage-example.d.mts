export declare function extractUsageFence(
  readmeText: string,
): { code: string } | { error: 'no-heading' | 'no-fence' };

export declare function matchesComponentTag(code: string, pascalName: string): boolean;
