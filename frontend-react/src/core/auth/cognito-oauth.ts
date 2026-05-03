export const ZV_OAUTH_STATE = 'zv_oauth_state'
export const ZV_OAUTH_VERIFIER = 'zv_oauth_verifier'
export const ZV_OAUTH_RETURN = 'zv_oauth_return_to'

function randomUrlSafeBytes(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function newPkceVerifier(): string { return randomUrlSafeBytes(32) }
export function newOAuthState(): string { return randomUrlSafeBytes(24) }

export async function pkceChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function cognitoTokenUrl(hostedUiDomain: string): string {
  const host = hostedUiDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://${host}/oauth2/token`
}

export function buildGoogleAuthorizeUrl(params: {
  hostedUiDomain: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
  identityProvider: string
  scopes?: string[]
}): string {
  const host = params.hostedUiDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const base = `https://${host}/oauth2/authorize`
  const scope = (params.scopes ?? ['openid', 'email', 'profile']).join(' ')
  const q = new URLSearchParams({
    client_id: params.clientId,
    response_type: 'code',
    scope,
    redirect_uri: params.redirectUri,
    identity_provider: params.identityProvider,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${base}?${q.toString()}`
}
