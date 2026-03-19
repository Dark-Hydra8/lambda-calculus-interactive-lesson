const USER_ID_COOKIE = 'lc_user_id';
const NEXT_ID_COOKIE = 'lc_user_id_next';

// First assigned id when no cookie is present.
const START_HEX = 'b43b3910';

const HEX_RE = /^[0-9a-fA-F]{8}$/;

function padHex8(value: number): string {
  // Keep as unsigned 32-bit so we always have 8 hex digits.
  return (value >>> 0).toString(16).padStart(8, '0');
}

function normalizeHexId(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function parseCookieValue(raw: string | null): string | null {
  if (!raw) return null;
  // Cookies may be urlencoded depending on environment.
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    const [k, ...rest] = part.split('=');
    if (k === name) {
      return parseCookieValue(rest.join('='));
    }
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Returns an existing user id from cookie, or creates one using a local
 * incremental counter (persisted in a separate cookie).
 *
 * The generated ids are 8 hex digits (leading zeros preserved).
 */
export function getOrCreateUserIdFromCookie(): string {
  const existing = normalizeHexId(getCookie(USER_ID_COOKIE) ?? '');
  if (existing) return existing;

  const nextRaw = normalizeHexId(getCookie(NEXT_ID_COOKIE) ?? '') ?? START_HEX;
  const nextVal = parseInt(nextRaw, 16) >>> 0;

  const assigned = padHex8(nextVal);
  const newNext = padHex8((nextVal + 1) >>> 0);

  // Persist for 1 year.
  const oneYearSeconds = 60 * 60 * 24 * 365;
  setCookie(USER_ID_COOKIE, assigned, oneYearSeconds);
  setCookie(NEXT_ID_COOKIE, newNext, oneYearSeconds);

  return assigned;
}

export function getUserIdFromCookie(): string | null {
  return normalizeHexId(getCookie(USER_ID_COOKIE) ?? '');
}

export function clearUserIdCookie(): void {
  deleteCookie(USER_ID_COOKIE);
}

