/**
 * Smoothly scrolls to a missing required field/section and focuses it when writable.
 */
export function focusInvalidElement(el: HTMLElement | null): void {
  if (!el) return;
  if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (typeof el.focus === 'function') {
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }
}
