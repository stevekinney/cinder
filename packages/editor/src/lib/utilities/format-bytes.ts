/**
 * Format bytes to a human-readable size string.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB", "512 B")
 *
 * @example
 * formatBytes(512) // "512 B"
 * formatBytes(1536) // "1.5 KB"
 * formatBytes(2621440) // "2.5 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
