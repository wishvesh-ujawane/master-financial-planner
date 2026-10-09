import { useCallback, useEffect, useState } from 'react';

import { acquireToken, clearToken, ensureToken, fetchProfile, isConfigured, revokeToken, type GoogleProfile } from './google-auth';

const SIGNED_IN_FLAG = 'goodmeasure-google-signed-in';

export type AuthState = {
  user: GoogleProfile | null;
  configured: boolean;
  busy: boolean;
  initializing: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string>;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<GoogleProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isConfigured();
  const [initializing, setInitializing] = useState<boolean>(() => configured && localStorage.getItem(SIGNED_IN_FLAG) === '1');

  useEffect(() => {
    if (!configured || localStorage.getItem(SIGNED_IN_FLAG) !== '1') { setInitializing(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await ensureToken();
        const profile = await fetchProfile(token);
        if (!cancelled) setUser(profile);
      } catch {
        localStorage.removeItem(SIGNED_IN_FLAG);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const signIn = useCallback(async () => {
    setBusy(true);
    try {
      const token = await acquireToken('');
      setUser(await fetchProfile(token));
      localStorage.setItem(SIGNED_IN_FLAG, '1');
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await revokeToken();
      clearToken();
      localStorage.removeItem(SIGNED_IN_FLAG);
      setUser(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const getToken = useCallback(() => ensureToken(), []);

  return { user, configured, busy, initializing, signIn, signOut, getToken };
}
