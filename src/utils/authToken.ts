import { jwtDecode } from 'jwt-decode';

/**
 * Claims the backend puts in the auth token.
 * See gold-khata-book-backend/src/common/utils/generateToken.ts
 */
interface AuthTokenClaims {
  /** The user's Mongo ObjectId as a 24-char hex string. */
  sub?: string;
  role?: string;
}

/**
 * Returns the opaque server-issued user id from the auth token, or null.
 *
 * Used to label analytics instead of the phone number. Firebase prohibits
 * personally identifiable information in user ids, and a phone number is PII —
 * hashing it would not help either, since a 10-digit number is only ~10^10
 * possibilities and trivially brute-forced. The server's ObjectId is opaque by
 * construction.
 *
 * Returns null rather than throwing for any malformed input. Two real cases:
 *   - the offline dev path issues the literal string 'dummy-token'
 *     (see authService.verifyOtp)
 *   - a truncated or corrupted value restored from storage
 *
 * Callers must skip setting a user id when this returns null, never fall back
 * to the phone number.
 */
export const getUserIdFromToken = (token?: string | null): string | null => {
  if (!token) return null;

  try {
    const claims = jwtDecode<AuthTokenClaims>(token);
    return typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;
  } catch {
    return null;
  }
};

/**
 * True when this token belongs to an admin rather than a shopkeeper.
 *
 * The backend issues exactly two roles to this app — 'admin' and 'dukandar'
 * (see generateToken.ts) — and an admin's `sub` is an Admin ObjectId, which
 * exists in a different collection entirely from the Dukandar records the
 * analytics platform resolves names and phones against. Reporting one as an app
 * user produces a row that can never resolve, with no name and no phone, and
 * whose desk-bound session times distort every engagement average.
 *
 * Tested positively for 'admin' rather than by requiring 'dukandar': a token
 * that somehow carries no role at all is far more likely to be a shopkeeper
 * than an admin, and silently dropping real users' telemetry is the worse
 * failure of the two.
 */
export const isAdminToken = (token?: string | null): boolean => {
  if (!token) return false;

  try {
    return jwtDecode<AuthTokenClaims>(token).role === 'admin';
  } catch {
    return false;
  }
};
