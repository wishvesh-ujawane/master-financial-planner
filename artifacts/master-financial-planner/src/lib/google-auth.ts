// Browser-only Google OAuth via Google Identity Services; token lives in memory, never persisted.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

export type GoogleProfile = { sub: string; name: string; email: string; picture: string };

export function isConfigured(): boolean {
  return typeof CLIENT_ID === 'string' && CLIENT_ID.length > 0;
}

let gisReady: Promise<void> | null = null;
function waitForGis(): Promise<void> {
  if (gisReady) return gisReady;
  gisReady = new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) return resolve();
      if (Date.now() - start > 10000) return reject(new Error('Google sign-in library failed to load.'));
      window.setTimeout(tick, 100);
    };
    tick();
  });
  return gisReady;
}

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let pending: { resolve: (r: google.accounts.oauth2.TokenResponse) => void; reject: (e: unknown) => void } | null = null;

async function getClient(): Promise<google.accounts.oauth2.TokenClient> {
  if (tokenClient) return tokenClient;
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set.');
  await waitForGis();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      const current = pending;
      pending = null;
      if (response.error) current?.reject(new Error(response.error_description || response.error));
      else current?.resolve(response);
    },
    error_callback: (error) => {
      const current = pending;
      pending = null;
      current?.reject(new Error(error.message || 'Google sign-in was cancelled.'));
    },
  });
  return tokenClient;
}

let cached: { token: string; expiresAt: number } | null = null;

async function requestToken(prompt: string): Promise<google.accounts.oauth2.TokenResponse> {
  const client = await getClient();
  return new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
    pending = { resolve, reject };
    client.requestAccessToken({ prompt });
  });
}

export async function acquireToken(prompt: '' | 'consent' = ''): Promise<string> {
  const response = await requestToken(prompt);
  cached = { token: response.access_token, expiresAt: Date.now() + Number(response.expires_in) * 1000 };
  return cached.token;
}

// Returns a valid token, refreshing silently when the cached one is near expiry.
export async function ensureToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  return acquireToken('');
}

export async function fetchProfile(token: string): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Could not load your Google profile.');
  const data = (await response.json()) as Partial<GoogleProfile>;
  return { sub: data.sub ?? '', name: data.name ?? '', email: data.email ?? '', picture: data.picture ?? '' };
}

export function clearToken(): void {
  cached = null;
}

export async function revokeToken(): Promise<void> {
  const token = cached?.token;
  cached = null;
  if (!token) return;
  await new Promise<void>((resolve) => {
    try {
      google.accounts.oauth2.revoke(token, () => resolve());
    } catch {
      resolve();
    }
  });
}
