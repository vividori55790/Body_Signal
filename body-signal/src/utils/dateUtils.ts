import { format, isValid } from 'date-fns';

/**
 * Convert a Date, ISO timestamp, or YYYY-MM-DD string to a local YYYY-MM-DD key.
 * Bare YYYY-MM-DD strings stay untouched so UTC parsing does not shift the local date.
 */
export function toLocalYmd(raw?: string | Date): string {
  if (!raw) return '';
  if (raw instanceof Date) {
    return isValid(raw) ? format(raw, 'yyyy-MM-dd') : '';
  }
  if (!raw.includes('T')) return raw.slice(0, 10);
  const dt = new Date(raw);
  return isValid(dt) ? format(dt, 'yyyy-MM-dd') : raw.slice(0, 10);
}

/**
 * Format a Date or ISO timestamp for `<input type="datetime-local">` using local wall-clock time.
 */
export function toLocalDateTimeInput(raw?: string | Date): string {
  const dt = raw instanceof Date ? raw : raw ? new Date(raw) : new Date();
  return isValid(dt) ? format(dt, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse a YYYY-MM-DD (or ISO) string into a local Date at the specified hour.
 */
export function parseLocalDate(raw?: string, hour = 0): Date | null {
  if (!raw) return null;
  const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
  if (y && m && d) {
    const dt = new Date(y, m - 1, d, hour, 0, 0);
    return isValid(dt) ? dt : null;
  }
  const dt = new Date(raw);
  return isValid(dt) ? dt : null;
}
