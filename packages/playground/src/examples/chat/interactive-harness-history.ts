export function createHistoryMessageTimestamp(historyPage: number, index: number): string {
  return new Date(Date.UTC(2026, 4, 30 - historyPage, 12, index)).toISOString();
}
