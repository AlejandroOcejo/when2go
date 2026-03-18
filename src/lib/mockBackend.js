const STORAGE_KEY = 'travel-group-mvp-db'
const USER_COLORS = ['#0f766e', '#16a34a', '#b45309', '#be123c', '#0369a1', '#7c3aed']

const DEFAULT_DB = {
  // trips: { id, name, created_at }
  trips: [],
  // users: { id, name, color }
  users: [],
  // availability: { id, trip_id, user_id, date }
  availability: [],
}

function safeParse(jsonValue) {
  try {
    return JSON.parse(jsonValue)
  } catch {
    return null
  }
}

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? safeParse(raw) : null

  if (!parsed) {
    return structuredClone(DEFAULT_DB)
  }

  return {
    trips: Array.isArray(parsed.trips) ? parsed.trips : [],
    users: Array.isArray(parsed.users) ? parsed.users : [],
    availability: Array.isArray(parsed.availability) ? parsed.availability : [],
  }
}

function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

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

function normalizeParticipantNames(names) {
  const safeNames = Array.isArray(names) ? names : []
  const deduped = []
  const seen = new Set()

  for (const rawName of safeNames) {
    const trimmed = String(rawName ?? '').trim()

    if (!trimmed) {
      continue
    }

    const key = trimmed.toLowerCase()

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(trimmed)
  }

  return deduped
}

export function createTrip(name, participantNames = []) {
  const db = loadDb()
  const trip = {
    id: createId(),
    name: name.trim(),
    created_at: new Date().toISOString(),
  }

  const participants = normalizeParticipantNames(participantNames)
  const tripUsers = participants.map((participantName) => {
    const userId = createId()

    return {
      id: userId,
      trip_id: trip.id,
      name: participantName,
      color: pickColor(userId),
    }
  })

  db.trips.push(trip)
  db.users.push(...tripUsers)
  saveDb(db)

  return trip
}

export function getTrip(tripId) {
  const db = loadDb()
  return db.trips.find((trip) => trip.id === tripId) ?? null
}

export function getTripUsers(tripId) {
  const db = loadDb()

  return db.users
    .filter((user) => user.trip_id === tripId)
    .map((user) => ({
      id: user.id,
      name: user.name,
      color: user.color ?? '#5f6f52',
    }))
}

export function upsertUser(user) {
  const db = loadDb()
  const existing = db.users.find((item) => item.id === user.id)

  if (existing) {
    existing.name = user.name
    if (user.color) {
      existing.color = user.color
    }
  } else {
    db.users.push({
      id: user.id,
      name: user.name,
      color: user.color,
    })
  }

  saveDb(db)
}

function normalizeDate(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }

  const parsed = date instanceof Date ? date : new Date(date)
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function replaceAvailability(tripId, userId, dates) {
  const db = loadDb()

  db.availability = db.availability.filter(
    (entry) => !(entry.trip_id === tripId && entry.user_id === userId),
  )

  const uniqueDates = [...new Set(dates.map((date) => normalizeDate(date)))]

  const nextRows = uniqueDates.map((date) => ({
    id: createId(),
    trip_id: tripId,
    user_id: userId,
    date,
  }))

  db.availability.push(...nextRows)
  saveDb(db)
}

export function getTripAvailability(tripId) {
  const db = loadDb()

  const rows = db.availability.filter((entry) => entry.trip_id === tripId)

  return rows.map((row) => {
    const user = db.users.find((item) => item.id === row.user_id)

    return {
      ...row,
      user_name: user?.name ?? 'Unnamed',
      user_color: user?.color ?? '#5f6f52',
    }
  })
}

export function getUserAvailability(tripId, userId) {
  const db = loadDb()

  return db.availability
    .filter((entry) => entry.trip_id === tripId && entry.user_id === userId)
    .map((entry) => entry.date)
}
