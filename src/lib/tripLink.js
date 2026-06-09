const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BASE62_MAP = new Map([...BASE62_ALPHABET].map((char, index) => [char, index]))
const TRIP_MONTH_LOCK_PREFIX = 'trip-month-lock:'
const RECENT_TRIPS_STORAGE_KEY = 'recent-trips:v1'

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? ''),
  )
}

function encodeBigIntToBase62(value) {
  if (value === 0n) {
    return '0'
  }

  let current = value
  let output = ''

  while (current > 0n) {
    const remainder = Number(current % 62n)
    output = BASE62_ALPHABET[remainder] + output
    current /= 62n
  }

  return output
}

function decodeBase62ToBigInt(value) {
  let output = 0n

  for (const char of value) {
    const mapped = BASE62_MAP.get(char)

    if (mapped === undefined) {
      return null
    }

    output = output * 62n + BigInt(mapped)
  }

  return output
}

export function uuidToShortId(uuid) {
  if (!isUuid(uuid)) {
    return null
  }

  const hex = uuid.replaceAll('-', '')
  const value = BigInt(`0x${hex}`)
  return encodeBigIntToBase62(value)
}

export function shortIdToUuid(shortId) {
  const safeShortId = String(shortId ?? '').trim()

  if (!safeShortId) {
    return null
  }

  const parsed = decodeBase62ToBigInt(safeShortId)

  if (parsed === null) {
    return null
  }

  const hex = parsed.toString(16).padStart(32, '0')
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`

  return isUuid(uuid) ? uuid : null
}

export function getTripPathById(tripId) {
  const shortId = uuidToShortId(tripId)

  if (shortId) {
    return `/t/${shortId}`
  }

  return `/trip/${encodeURIComponent(tripId)}`
}

export function getTripIdFromPath(pathname) {
  const shortMatch = pathname.match(/^\/t\/([^/]+)(?:\/plan)?$/)

  if (shortMatch) {
    const shortId = decodeURIComponent(shortMatch[1])
    return shortIdToUuid(shortId) ?? shortId
  }

  const longMatch = pathname.match(/^\/trip\/([^/]+)(?:\/plan)?$/)

  if (longMatch) {
    return decodeURIComponent(longMatch[1])
  }

  return null
}

export function getTripPlanPath(tripId) {
  return `${getTripPathById(tripId)}/plan`
}

export function isPlanPath(pathname) {
  return pathname.endsWith('/plan')
}

export function buildTripSharePath(tripId, accessToken) {
  const basePath = getTripPathById(tripId)
  const safeToken = String(accessToken ?? '').trim()

  if (!safeToken) {
    return basePath
  }

  const params = new URLSearchParams()
  params.set('a', safeToken)
  return `${basePath}?${params.toString()}`
}

export function getAccessTokenFromSearch(search) {
  const params = new URLSearchParams(search)
  const token = String(params.get('a') ?? '').trim()
  return token || null
}

export function clearAccessTokenFromCurrentUrl() {
  const currentUrl = new URL(window.location.href)

  if (!currentUrl.searchParams.has('a')) {
    return
  }

  currentUrl.searchParams.delete('a')
  window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
}

export function saveRecentTrip(trip) {
  const safeTripId = String(trip?.id ?? '').trim()
  const safeName = String(trip?.name ?? '').trim()

  if (!safeTripId || !safeName) {
    return
  }

  const safePath = String(trip?.path ?? getTripPathById(safeTripId)).trim()
  const entry = {
    id: safeTripId,
    name: safeName,
    path: safePath,
    visitedAt: new Date().toISOString(),
  }

  try {
    const current = getRecentTrips()
    const next = [entry, ...current.filter((item) => item.id !== safeTripId)].slice(0, 6)
    window.localStorage.setItem(RECENT_TRIPS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures.
  }
}

export function getRecentTrips() {
  try {
    const raw = window.localStorage.getItem(RECENT_TRIPS_STORAGE_KEY)
    const parsed = JSON.parse(raw ?? '[]')

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => ({
        id: String(item?.id ?? '').trim(),
        name: String(item?.name ?? '').trim(),
        path: String(item?.path ?? '').trim(),
        visitedAt: String(item?.visitedAt ?? '').trim(),
      }))
      .filter((item) => item.id && item.name && item.path)
      .slice(0, 6)
  } catch {
    return []
  }
}

export function removeRecentTrip(tripId) {
  const safeTripId = String(tripId ?? '').trim()

  if (!safeTripId) {
    return
  }

  try {
    const current = getRecentTrips()
    const next = current.filter((item) => item.id !== safeTripId)
    window.localStorage.setItem(RECENT_TRIPS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures.
  }
}

export function saveTripMonthLock(tripId, monthKey) {
  const safeTripId = String(tripId ?? '').trim()
  const safeMonthKey = String(monthKey ?? '').trim()

  if (!safeTripId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(safeMonthKey)) {
    return
  }

  try {
    window.sessionStorage.setItem(`${TRIP_MONTH_LOCK_PREFIX}${safeTripId}`, safeMonthKey)
  } catch {
    // Ignore storage failures.
  }
}

export function getTripMonthLock(tripId) {
  const safeTripId = String(tripId ?? '').trim()

  if (!safeTripId) {
    return null
  }

  try {
    const stored = String(window.sessionStorage.getItem(`${TRIP_MONTH_LOCK_PREFIX}${safeTripId}`) ?? '').trim()
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(stored) ? stored : null
  } catch {
    return null
  }
}