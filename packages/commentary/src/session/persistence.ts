/**
 * Session persistence helpers for review sessions.
 *
 * All functions are SSR-safe (check `browser` before accessing storage).
 * Sessions are stored in sessionStorage with document-scoped keys.
 *
 * @module
 */

import type { PersistedReviewSession, ReviewSession } from './types.js';
import { fromPersistedSession, toPersistedSession } from './updates.js';

/** SSR guard — evaluated lazily so tests can stub `window` after module load. */
const isBrowser = () => typeof window !== 'undefined';

// ============================================================================
// Constants
// ============================================================================

/**
 * Storage key prefix for review sessions.
 * Full key format: `review-session-{documentId}`
 */
export const STORAGE_KEY_PREFIX = 'review-session-';

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate that a value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validate that a value is a string.
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Validate that a value is an array.
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Validate persisted session schema.
 *
 * Returns true if the data has all required fields with correct types.
 * Does not deeply validate nested structures (anchor details, etc.)
 * to allow for forward compatibility with schema changes.
 *
 * @param data - Unknown data to validate
 * @returns True if data matches PersistedReviewSession shape
 */
export function validateSessionSchema(data: unknown): data is PersistedReviewSession {
  if (!isObject(data)) return false;

  const id = data['id'];
  const status = data['status'];
  const startedAt = data['startedAt'];
  const updatedAt = data['updatedAt'];
  const outcome = data['outcome'];
  const draftComments = data['draftComments'];
  const submittedAt = data['submittedAt'];

  // Required string fields
  if (!isString(id)) return false;
  if (!isString(status)) return false;
  if (!isString(startedAt)) return false;
  if (!isString(updatedAt)) return false;

  // Status must be valid
  if (status !== 'drafting' && status !== 'submitted') return false;

  // Optional outcome must be a valid string if present (reject null)
  if (outcome !== undefined) {
    if (typeof outcome !== 'string') return false;
    if (outcome !== 'approve' && outcome !== 'request_changes' && outcome !== 'comment') {
      return false;
    }
  }

  // Required arrays
  if (!isArray(draftComments)) return false;

  // Note: draftSuggestions was removed from the schema. Old persisted
  // sessions may still have this field - we allow it for backward
  // compatibility but don't require it.

  // Optional submittedAt must be string if present
  if (submittedAt !== undefined && !isString(submittedAt)) return false;

  return true;
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Build the full storage key for a document.
 *
 * @param key - Document identifier (usually documentId)
 * @returns Full storage key
 */
export function getStorageKey(key: string): string {
  return `${STORAGE_KEY_PREFIX}${key}`;
}

/**
 * Save a review session to sessionStorage.
 *
 * SSR-safe: Returns false immediately when not in browser.
 *
 * @param key - Document identifier for storage key
 * @param session - The session to persist
 * @returns True if save succeeded, false otherwise
 */
export function saveSession(key: string, session: ReviewSession): boolean {
  if (!isBrowser()) return false;

  try {
    const persisted = toPersistedSession(session);
    const storageKey = getStorageKey(key);
    sessionStorage.setItem(storageKey, JSON.stringify(persisted));
    return true;
  } catch (error) {
    console.warn('Failed to persist review session:', error);
    return false;
  }
}

/**
 * Load a review session from sessionStorage.
 *
 * SSR-safe: Returns null immediately when not in browser.
 *
 * Returns null if:
 * - Not in browser
 * - Key doesn't exist
 * - JSON parse fails
 * - Schema validation fails (corrupted data is cleared)
 * - Session status is 'submitted' (stale sessions are cleared)
 *
 * @param key - Document identifier for storage key
 * @returns The restored session, or null if not found/invalid
 */
export function loadSession(key: string): ReviewSession | null {
  if (!isBrowser()) return null;

  const storageKey = getStorageKey(key);

  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const data: unknown = JSON.parse(raw);

    // Validate schema
    if (!validateSessionSchema(data)) {
      console.warn('Review session schema validation failed, clearing corrupted data');
      clearPersistedSession(key);
      return null;
    }

    // Clear stale submitted sessions
    if (data.status === 'submitted') {
      console.info('Clearing stale submitted review session');
      clearPersistedSession(key);
      return null;
    }

    return fromPersistedSession(data);
  } catch (error) {
    console.warn('Failed to load review session:', error);
    // Clear potentially corrupted data
    clearPersistedSession(key);
    return null;
  }
}

/**
 * Clear a persisted session from sessionStorage.
 *
 * SSR-safe: No-op when not in browser.
 *
 * @param key - Document identifier for storage key
 */
export function clearPersistedSession(key: string): void {
  if (!isBrowser()) return;

  try {
    const storageKey = getStorageKey(key);
    sessionStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('Failed to clear review session:', error);
  }
}

/**
 * Check if a session exists in sessionStorage.
 *
 * SSR-safe: Returns false when not in browser.
 * Does not validate schema, just checks if key exists.
 *
 * @param key - Document identifier for storage key
 * @returns True if session exists
 */
export function hasPersistedSession(key: string): boolean {
  if (!isBrowser()) return false;

  try {
    const storageKey = getStorageKey(key);
    return sessionStorage.getItem(storageKey) !== null;
  } catch {
    return false;
  }
}

/**
 * List all review session keys in sessionStorage.
 *
 * SSR-safe: Returns empty array when not in browser.
 * Returns document identifiers (without the prefix).
 *
 * @returns Array of document identifiers with persisted sessions
 */
export function listPersistedSessions(): string[] {
  if (!isBrowser()) return [];

  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keys.push(key.slice(STORAGE_KEY_PREFIX.length));
      }
    }
    return keys;
  } catch {
    return [];
  }
}

/**
 * Clear all review sessions from sessionStorage.
 *
 * SSR-safe: No-op when not in browser.
 * Useful for cleanup on logout or session reset.
 */
export function clearAllPersistedSessions(): void {
  if (!isBrowser()) return;

  try {
    const keys = listPersistedSessions();
    for (const key of keys) {
      clearPersistedSession(key);
    }
  } catch (error) {
    console.warn('Failed to clear all review sessions:', error);
  }
}
