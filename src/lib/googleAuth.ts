const SESSION_KEY = "jobflow_google_session";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "openid",
  "email",
  "profile",
].join(" ");

export interface GoogleUser {
  email: string;
  displayName: string;
  photoURL?: string;
}

interface StoredSession {
  accessToken: string;
  expiresAt: number;
  user: GoogleUser;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

let cachedClientId: string | null = null;
let scriptLoadPromise: Promise<void> | null = null;

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  const resp = await fetch("/api/auth/config");
  if (!resp.ok) {
    throw new Error("Could not load Google OAuth configuration from the local server.");
  }

  const data = (await resp.json()) as { clientId?: string; configured?: boolean };
  cachedClientId = data.clientId?.trim() || "";
  return cachedClientId;
}

function ensureGoogleScriptLoaded(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-jobflow-google-auth="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.jobflowGoogleAuth = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

async function fetchUserProfile(accessToken: string): Promise<GoogleUser> {
  const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    throw new Error("Signed in with Google, but could not read your profile details.");
  }

  const profile = (await resp.json()) as {
    email?: string;
    name?: string;
    picture?: string;
  };

  if (!profile.email) {
    throw new Error("Google account did not return an email address.");
  }

  return {
    email: profile.email,
    displayName: profile.name || profile.email,
    photoURL: profile.picture,
  };
}

export const initAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  const session = readSession();
  const stillValid = session && session.expiresAt > Date.now() + 60_000;

  if (stillValid && session) {
    onAuthSuccess?.(session.user, session.accessToken);
  } else {
    if (session) clearSession();
    onAuthFailure?.();
  }

  return () => {};
};

export const googleSignIn = async (): Promise<{ user: GoogleUser; accessToken: string }> => {
  const clientId = await getClientId();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured in .env");
  }

  await ensureGoogleScriptLoaded();

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google OAuth library failed to initialize.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      callback: async (response) => {
        if (settled) return;

        if (response.error) {
          settled = true;
          if (response.error === "access_denied") {
            reject(
              new Error(
                "access_denied: Google blocked sign-in. Add your Gmail under OAuth consent screen > Test users, sign in with that same account, then try again."
              )
            );
            return;
          }
          reject(new Error(response.error_description || response.error));
          return;
        }

        if (!response.access_token) {
          settled = true;
          reject(new Error("No access token returned from Google OAuth."));
          return;
        }

        try {
          const user = await fetchUserProfile(response.access_token);
          const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000;
          saveSession({
            accessToken: response.access_token,
            expiresAt,
            user,
          });
          settled = true;
          resolve({ user, accessToken: response.access_token });
        } catch (error) {
          settled = true;
          reject(error);
        }
      },
      error_callback: (error) => {
        if (settled) return;
        settled = true;
        reject(new Error(error.message || error.type || "Google OAuth failed."));
      },
    });

    client.requestAccessToken({ prompt: "consent" });
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt <= Date.now() + 60_000) {
    clearSession();
    return null;
  }
  return session.accessToken;
};

export const logout = async () => {
  const session = readSession();
  clearSession();

  if (session?.accessToken && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => {
      window.google!.accounts.oauth2.revoke(session.accessToken, () => resolve());
    });
  }
};

export const GOOGLE_OAUTH_CREDENTIALS_URL = "https://console.cloud.google.com/apis/credentials";
export const GOOGLE_GMAIL_API_URL = "https://console.cloud.google.com/apis/library/gmail.googleapis.com";
