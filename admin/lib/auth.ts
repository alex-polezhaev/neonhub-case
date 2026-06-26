const AUTH_KEY = 'admin_auth'
const AUTH_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
// Thin client-side demo gate only — not real security.
// Set NEXT_PUBLIC_ADMIN_PASSWORD in the environment (see .env.example).
const VALID_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  
  const authData = localStorage.getItem(AUTH_KEY)
  if (!authData) return false
  
  try {
    const { expiry } = JSON.parse(authData)
    return Date.now() < expiry
  } catch {
    return false
  }
}

export function login(password: string): boolean {
  if (password !== VALID_PASSWORD) return false
  
  const authData = {
    expiry: Date.now() + AUTH_DURATION
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(authData))
  return true
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY)
}
