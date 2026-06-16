const STORAGE_KEY = 'cookie-consent:v1'

export function getCookieConsent() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'accepted' || value === 'rejected' ? value : null
  } catch {
    return null
  }
}

export function setCookieConsent(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Ignore storage failures.
  }
}
