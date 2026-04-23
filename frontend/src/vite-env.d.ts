/**
 * Build-time env for the Vite-based dev server (`ng serve`).
 * Only names prefixed with `VITE_` are exposed to the browser (see Vite docs).
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_COGNITO_HOSTED_UI_DOMAIN?: string;
  readonly VITE_COGNITO_APP_CLIENT_ID?: string;
  readonly VITE_OAUTH_REDIRECT_URI?: string;
  readonly VITE_COGNITO_GOOGLE_IDENTITY_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
