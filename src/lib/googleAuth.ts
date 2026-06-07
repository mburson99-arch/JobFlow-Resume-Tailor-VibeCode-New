const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

let cachedAccessToken: string | null = null;

function getGoogleClientId(): string {
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const savedClientId = localStorage.getItem("jobflow_google_client_id");
  return (envClientId || savedClientId || "").trim();
}

function waitForGoogleIdentity(): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }

      if (Date.now() - startedAt > 10000) {
        reject(new Error("Google Identity Services did not load. Check your internet connection."));
        return;
      }

      window.setTimeout(check, 150);
    };

    check();
  });
}

export const googleSignIn = async (): Promise<{ accessToken: string } | null> => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Missing Google OAuth client ID. Paste it into Email Monitor or set VITE_GOOGLE_CLIENT_ID in .env.");
  }

  await waitForGoogleIdentity();

  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      prompt: "consent",
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }

        if (!response.access_token) {
          reject(new Error("Google OAuth did not return an access token."));
          return;
        }

        cachedAccessToken = response.access_token;
        resolve({ accessToken: cachedAccessToken });
      },
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
};

export const getAccessToken = async (): Promise<string | null> => cachedAccessToken;

export const logout = async () => {
  cachedAccessToken = null;
};
