import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export type UserIdentity = {
  userId: string; // 8 hex digits, leading zeros preserved
  authToken: string; // 64 char base64 random token (acts like password)
};

const COOKIE_USER_ID = 'lc_user_id';
const COOKIE_AUTH_TOKEN = 'lc_auth_token';

// In development, React StrictMode mounts/unmounts components twice, which can
// cause duplicate RPC calls. We de-dupe allocation with a module-scoped
// in-flight promise so `allocate_user_identity()` only runs once.
let inFlightAllocation: Promise<UserIdentity> | null = null;

// b43b3910 hex == 3023780112 decimal
// (fits safely in JS Number since we stay within 32-bit ids)
const LOCAL_SEQ_START = 3023780112;
const LOCAL_SEQ_KEY = 'lc_local_user_id_next';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function toHex8(n: number): string {
  return n.toString(16).padStart(8, '0').toLowerCase();
}

function generateAuthToken64(): string {
  // 48 bytes -> base64 is exactly 64 characters (with '==' padding).
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function allocateLocalUserId(): string {
  const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_SEQ_KEY) : null;
  const next = raw ? Number(raw) : LOCAL_SEQ_START;
  window.localStorage.setItem(LOCAL_SEQ_KEY, (next + 1).toString());
  return toHex8(next);
}

export function useUserIdentity() {
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    clearIdentityCookies();
    setIdentity(null);
    setInitError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const existingUserId = getCookie(COOKIE_USER_ID);
        const existingToken = getCookie(COOKIE_AUTH_TOKEN);

        // Always ensure the cookie identity matches the server-side profile
        // before we start the lessons. If validation fails, allocate a new id/token.
        const maxAgeSeconds = 60 * 60 * 24 * 365; // ~1 year

        const allocateFresh = async (): Promise<UserIdentity> => {
          if (inFlightAllocation) return inFlightAllocation;

          inFlightAllocation = (async () => {
            if (isSupabaseConfigured() && supabase) {
              const { data, error } = await supabase.rpc('allocate_user_identity');
              if (error) throw error;

              const anyData = data as any;
              const dbUserId =
                anyData && typeof anyData.user_id === 'string'
                  ? anyData.user_id
                  : typeof anyData.userId === 'string'
                    ? anyData.userId
                    : null;
              const dbToken =
                anyData && typeof anyData.auth_token === 'string'
                  ? anyData.auth_token
                  : typeof anyData.authToken === 'string'
                    ? anyData.authToken
                    : null;
              if (!dbUserId || !dbToken) throw new Error('Unexpected RPC response shape');

              setCookie(COOKIE_USER_ID, dbUserId, maxAgeSeconds);
              setCookie(COOKIE_AUTH_TOKEN, dbToken, maxAgeSeconds);
              return { userId: dbUserId, authToken: dbToken };
            }

            const userId = allocateLocalUserId();
            const authToken = generateAuthToken64();
            setCookie(COOKIE_USER_ID, userId, maxAgeSeconds);
            setCookie(COOKIE_AUTH_TOKEN, authToken, maxAgeSeconds);
            return { userId, authToken };
          })();

          try {
            return await inFlightAllocation;
          } finally {
            inFlightAllocation = null;
          }
        };

        if (existingUserId && existingToken) {
          // Validate existing cookies against Supabase before using them.
          if (isSupabaseConfigured() && supabase) {
            try {
              const { error } = await supabase.rpc('validate_identity', {
                p_user_id: existingUserId,
                p_auth_token: existingToken,
              });
              if (error) throw error;
              if (cancelled) return null;
              setIdentity({ userId: existingUserId, authToken: existingToken });
              setLoading(false);
              return;
            } catch {
              // Token mismatch or missing server-side profile; allocate a fresh identity.
              // Avoid logging the token itself.
              console.warn('[Identity] validate_identity failed; allocating a new identity.');
              clearIdentityCookies();
            }
          } else {
            setIdentity({ userId: existingUserId, authToken: existingToken });
            setLoading(false);
            return;
          }
        }

        const fresh = await allocateFresh();
        if (cancelled) return;
        setIdentity(fresh);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setInitError(e instanceof Error ? e.message : String(e));
        // Still allow the UI to render so lessons can be used without progress sync.
        if (typeof window !== 'undefined') {
          const authToken = generateAuthToken64();
          const userId = allocateLocalUserId();
          const maxAgeSeconds = 60 * 60 * 24 * 365;
          setCookie(COOKIE_USER_ID, userId, maxAgeSeconds);
          setCookie(COOKIE_AUTH_TOKEN, authToken, maxAgeSeconds);
          setIdentity({ userId, authToken });
        }
        setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return { identity, loading, initError, signOut };
}

export function clearIdentityCookies(): void {
  clearCookie(COOKIE_USER_ID);
  clearCookie(COOKIE_AUTH_TOKEN);
}

