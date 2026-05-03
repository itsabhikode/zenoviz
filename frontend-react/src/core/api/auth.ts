import { apiClient, plainAxios } from './client'
import {
  ZV_OAUTH_STATE,
  ZV_OAUTH_VERIFIER,
  ZV_OAUTH_RETURN,
  newPkceVerifier,
  newOAuthState,
  pkceChallengeS256,
  cognitoTokenUrl,
  buildGoogleAuthorizeUrl,
} from '@/core/auth/cognito-oauth'
import { tokenStorage } from '@/core/auth/token-storage'
import type {
  LoginTokens,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ForgotPasswordResponse,
  ApiMessageResponse,
  MeResponse,
} from './models'

export async function login(email: string, password: string): Promise<LoginTokens> {
  const { data } = await apiClient.post<LoginTokens>('/auth/login', { email, password })
  tokenStorage.setTokens(data.access_token, data.refresh_token)
  return data
}

export async function register(body: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>('/auth/register', body)
  return data
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const { data } = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', { email })
  return data
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<ApiMessageResponse> {
  const { data } = await apiClient.post<ApiMessageResponse>('/auth/confirm-forgot-password', {
    email,
    confirmation_code: code,
    new_password: newPassword,
  })
  return data
}

export async function me(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>('/auth/me')
  return data
}

export async function refresh(): Promise<RefreshTokenResponse> {
  const refreshToken = tokenStorage.refreshToken
  const { data } = await apiClient.post<RefreshTokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  tokenStorage.setAccessToken(data.access_token)
  return data
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    // ignore errors
  }
  tokenStorage.clear()
}

export function googleOAuthAvailable(): boolean {
  return !!(
    import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN &&
    import.meta.env.VITE_COGNITO_CLIENT_ID &&
    import.meta.env.VITE_COGNITO_REDIRECT_URI
  )
}

export async function startGoogleOAuth(returnTo: string): Promise<void> {
  const verifier = newPkceVerifier()
  const state = newOAuthState()
  const challenge = await pkceChallengeS256(verifier)

  sessionStorage.setItem(ZV_OAUTH_VERIFIER, verifier)
  sessionStorage.setItem(ZV_OAUTH_STATE, state)
  sessionStorage.setItem(ZV_OAUTH_RETURN, returnTo)

  const url = buildGoogleAuthorizeUrl({
    hostedUiDomain: import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN,
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
    codeChallenge: challenge,
    state,
    identityProvider: 'Google',
  })

  window.location.href = url
}

export async function exchangeOAuthCode(code: string): Promise<LoginTokens> {
  const verifier = sessionStorage.getItem(ZV_OAUTH_VERIFIER)
  const tokenUrl = cognitoTokenUrl(import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
    code,
    ...(verifier ? { code_verifier: verifier } : {}),
  })

  const { data } = await plainAxios.post<LoginTokens>(tokenUrl, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  tokenStorage.setTokens(data.access_token, data.refresh_token)
  sessionStorage.removeItem(ZV_OAUTH_VERIFIER)
  sessionStorage.removeItem(ZV_OAUTH_STATE)

  return data
}

export function consumeOAuthReturnPath(): string | null {
  const returnTo = sessionStorage.getItem(ZV_OAUTH_RETURN)
  sessionStorage.removeItem(ZV_OAUTH_RETURN)
  return returnTo
}
