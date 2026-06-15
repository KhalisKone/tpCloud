/**
 * Auth via Google Identity Services + JWT applicatif.
 *
 * Flux : bouton Google -> ID token Google -> POST /auth/google -> JWT applicatif.
 * Le JWT est stocké en localStorage et envoyé en Authorization: Bearer.
 */

const TOKEN_KEY = 'microscore_token'
const USER_KEY = 'microscore_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function setSession(token, user) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

export function isAuthenticated() {
  return Boolean(getToken())
}

export function isAdmin() {
  return getUser()?.role === 'admin'
}

export function logout() {
  setSession(null, null)
}

/** fetch avec le JWT applicatif. Redirige vers /login si 401/403. */
export async function adminFetch(url, options = {}) {
  const token = getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (res.status === 401 || res.status === 403) {
    logout()
    window.location.href = '/login'
    throw new Error('Session expirée ou accès refusé')
  }
  return res
}
