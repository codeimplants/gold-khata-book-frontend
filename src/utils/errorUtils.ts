/**
 * Parses API error responses into a human-readable string.
 *
 * Handles:
 * - Plain strings
 * - JSON arrays of Zod-style validation objects: [{ path, message, code, ... }]
 * - JSON objects with a `message` field
 */
export function parseApiError(err: unknown): string {
  const list = parseApiErrorList(err);
  return list.join('\n') || 'An unexpected error occurred.';
}

/**
 * Parses API error responses into an array of human-readable strings.
 * Each element is one error message suitable for bullet-point display.
 *
 * Handles:
 * - Plain strings (returned as single-element array)
 * - JSON arrays of Zod-style validation objects: [{ path, message, code, ... }]
 * - JSON objects with a `message` field
 */
export function parseApiErrorList(err: unknown): string[] {
  if (!err) return ['An unexpected error occurred.'];

  // If already a plain string, try to parse it as JSON
  const raw = typeof err === 'string' ? err : null;

  // Try to work with the raw value as an object/array
  let parsed: unknown = err;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Not JSON — could be an HTML error page (e.g. nginx 413/502); don't echo it verbatim.
      if (raw.trim().startsWith('<') || raw.length > 300) {
        return ['An unexpected error occurred. Please try again.'];
      }
      return [raw];
    }
  }

  // Array of validation errors (Zod style): [{ path, message, code, ... }]
  if (Array.isArray(parsed)) {
    const messages = (parsed as any[])
      .map((e) => {
        // Only show the message, not the field path prefix
        return e?.message ? String(e.message) : '';
      })
      .filter(Boolean);
    return messages.length > 0 ? messages : ['Validation failed. Please check your inputs.'];
  }

  // Single object with a `message` key
  if (typeof parsed === 'object' && parsed !== null && 'message' in (parsed as object)) {
    return [String((parsed as any).message)];
  }

  return [String(err)];
}
