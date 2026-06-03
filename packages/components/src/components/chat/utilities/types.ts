/**
 * Chat data model types built on top of the vendored conversation model.
 *
 * Core types live in `../conversation-model.ts`; this module provides only
 * project-specific extensions.
 */

import type { ToMarkdownOptions } from '../conversation-model.ts';

/**
 * Delivery status for messages in the UI.
 * This is transient state stored in message metadata with a `_` prefix
 * (e.g., `_deliveryStatus`) so it's automatically stripped on export.
 */
export type DeliveryStatus = 'draft' | 'sending' | 'sent' | 'failed';

/**
 * Options for exporting a chat transcript. Equivalent to the vendored
 * {@link ToMarkdownOptions} (which already carries `includeHidden`,
 * `redactHiddenContent`, and the redaction controls); exposed under a
 * chat-specific name for the public `cinder/chat` surface.
 */
export type ChatExportOptions = ToMarkdownOptions;
