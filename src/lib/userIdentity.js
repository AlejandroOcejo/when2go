const USER_KEY = 'travel-group-mvp-user'
const TRIP_USER_MAP_KEY = 'travel-group-mvp-trip-user-map'
const USER_COLORS = [
  '#0f766e',
  '#16a34a',
  '#b45309',
  '#be123c',
  '#0369a1',
  '#7c3aed',
]

function createId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function pickColor(id) {
  let hash = 0

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(index)
    hash |= 0
  }

  const safeIndex = Math.abs(hash) % USER_COLORS.length
  return USER_COLORS[safeIndex]
}

export function getOrCreateAnonymousUser() {
  const stored = localStorage.getItem(USER_KEY)

  if (stored) {
    try {
      const parsed = JSON.parse(stored)

      if (parsed?.id) {
        return parsed
      }
    } catch {
      // Ignore malformed local data and create a fresh anonymous identity.
    }
  }

  const id = createId()
  const fresh = {
    id,
    color: pickColor(id),
    name: '',
  }

  localStorage.setItem(USER_KEY, JSON.stringify(fresh))
  return fresh
}

export function saveAnonymousUser(nextUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
}

function readTripUserMap() {
  const raw = localStorage.getItem(TRIP_USER_MAP_KEY)

  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getSelectedTripUser(tripId) {
  const map = readTripUserMap()
  return typeof map[tripId] === 'string' ? map[tripId] : null
}

export function saveSelectedTripUser(tripId, userId) {
  const map = readTripUserMap()
  map[tripId] = userId
  localStorage.setItem(TRIP_USER_MAP_KEY, JSON.stringify(map))
}
