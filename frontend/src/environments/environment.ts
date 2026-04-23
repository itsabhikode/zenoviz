/**
 * Development configuration. Loaded by the Vite dev server; use `VITE_*` keys in `.env`
 * (see `.env.example`). Production uses `environment.prod.ts` via `fileReplacements`.
 */
export const environment = {
  production: false,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  /** Cognito Hosted UI hostname only, e.g. `my-domain.auth.us-east-1.amazoncognito.com` (no scheme). */
  cognitoHostedUiDomain: import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN || '',
  /** Same user-pool app client ID as the backend (`COGNITO_APP_CLIENT_ID`). Must allow PKCE + authorization code grant. */
  cognitoAppClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID || '',
  /** Registered callback URL (must match Cognito app client settings exactly). */
  oauthRedirectUri:
    import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:4200/auth/callback',
  /** Cognito identity provider name for Google (console: User pool → Sign-in → Federated → name). */
  cognitoGoogleIdentityProvider:
    import.meta.env.VITE_COGNITO_GOOGLE_IDENTITY_PROVIDER || 'Google',
};
