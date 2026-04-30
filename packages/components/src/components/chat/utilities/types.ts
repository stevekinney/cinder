/**
 * Chat data model types built on top of conversationalist.
 *
 * Most types are now provided by conversationalist.
 * This module provides only project-specific extensions.
 */

import type { ToMarkdownOptions } from 'conversationalist';

/**
 * Delivery status for messages in the UI.
 * This is transient state stored in message metadata with a `_` prefix
 * (e.g., `_deliveryStatus`) so it's automatically stripped on export.
 */
export type DeliveryStatus = 'draft' | 'sending' | 'sent' | 'failed';

/**
 * Project-specific export options extending conversationalist's ToMarkdownOptions.
 *
 * Adds `includeHidden` for controlling hidden message handling, which is
 * not part of the base library.
 */
export interface ChatExportOptions extends ToMarkdownOptions {
  /**
   * Whether to include hidden messages in the export.
   * When true, hidden messages are included but their content is replaced with '[REDACTED]'.
   * @default false
   */
  includeHidden?: boolean;
}
