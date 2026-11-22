/**
 * Runtime boundary & unknown error narrowing helpers.
 */

/**
 * Extract a human-readable error message from an `unknown` thrown value.
 */
export function getErrorMessage(err: unknown, fallback = ''): string {
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (typeof err === 'string' && err.trim().length > 0) {
    return err;
  }
  if (isRecord(err) && typeof err.message === 'string') {
    return err.message || fallback;
  }
  return fallback;
}

/**
 * Type guard verifying that an `unknown` value is a non-null, non-array record object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return true;
  }
  return false;
}
