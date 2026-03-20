const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BASE62_MAP = new Map([...BASE62_ALPHABET].map((char, index) => [char, index]))
const TRIP_MONTH_LOCK_PREFIX = 'trip-month-lock:'

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
  const shortMatch = pathname.match(/^\/t\/([^/]+)$/)

  if (shortMatch) {
    const shortId = decodeURIComponent(shortMatch[1])
    return shortIdToUuid(shortId) ?? shortId
  }

  const longMatch = pathname.match(/^\/trip\/([^/]+)$/)

  if (longMatch) {
    return decodeURIComponent(longMatch[1])
  }

  return null
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