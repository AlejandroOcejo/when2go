const SESSION_HINT_STORAGE_KEY = 'travel-group-session-active'

async function apiPost(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const details = String(body?.error ?? '').trim()
    throw new Error(details || `Request failed with status ${response.status}`)
  }

  return body
}

function setSessionHint(active) {
  try {
    if (active) {
      window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, '1')
    } else {
      window.localStorage.removeItem(SESSION_HINT_STORAGE_KEY)
    }
  } catch {
    // Ignore storage failures.
  }
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

export function hasStoredAccessToken() {
  try {
    return window.localStorage.getItem(SESSION_HINT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function storeAccessToken() {
  setSessionHint(true)
}

export async function clearAccessToken() {
  setSessionHint(false)

  try {
    await apiPost('/api/session', {
      action: 'logout',
    })
  } catch {
    // Ignore logout failures.
  }
}

export async function getSessionStatus() {
  const result = await apiPost('/api/session', {
    action: 'status',
  })

  const active = Boolean(result?.active)
  setSessionHint(active)
  return active
}

export async function verifyAccessCode(code) {
  const result = await apiPost('/api/session', {
    action: 'start',
    code,
  })

  const token = result?.ok ? 'cookie-session' : null
  setSessionHint(Boolean(token))
  return token
}

export async function consumeTripAccessToken(tripId, accessToken) {
  const result = await apiPost('/api/trip', {
    action: 'consumeAccess',
    tripId,
    accessToken,
  })

  const ok = Boolean(result?.ok)

  if (ok) {
    setSessionHint(true)
  }

  return ok
}

export async function createTrip(name, participantNames = []) {
  const participants = normalizeParticipantNames(participantNames)
  const result = await apiPost('/api/trip', {
    action: 'createTrip',
    tripName: String(name ?? '').trim(),
    participantNames: participants,
  })

  return {
    ...(result?.trip ?? null),
    shareAccessToken: typeof result?.shareAccessToken === 'string' ? result.shareAccessToken : '',
  }
}

export async function issueTripShareToken(tripId) {
  const result = await apiPost('/api/trip', {
    action: 'issueShareToken',
    tripId,
  })

  const token = String(result?.accessToken ?? '')

  if (!token) {
    throw new Error('Failed to issue share token')
  }

  return token
}

export async function getTrip(tripId) {
  const result = await apiPost('/api/trip', {
    action: 'getTrip',
    tripId,
  })

  const raw = result?.trip ?? null

  if (!raw) return null

  return {
    id: raw.id,
    name: raw.name,
    closedAt: raw.closed_at ?? null,
  }
}

export async function getTripUsers(tripId) {
  const result = await apiPost('/api/trip', {
    action: 'getTripUsers',
    tripId,
  })

  return (result?.users ?? []).map((user) => ({
    id: user.id,
    name: user.name,
    color: user.color ?? '#5f6f52',
    confirmedAt: user.confirmed_at ?? null,
  }))
}

export async function replaceAvailability(tripId, userId, dates) {
  const uniqueDates = [...new Set((dates ?? []).map((date) => normalizeDate(date)))]

  try {
    await apiPost('/api/trip', {
      action: 'replaceAvailability',
      tripId,
      userId,
      dates: uniqueDates,
    })
  } catch (error) {
    if (String(error?.message ?? '').includes('rate_limited')) {
      throw new Error('Availability sync was rate-limited. Please wait a moment and try again.')
    }

    throw error
  }
}

export async function getTripAvailability(tripId) {
  const result = await apiPost('/api/trip', {
    action: 'getTripAvailability',
    tripId,
  })

  return result?.availability ?? []
}

export async function getUserAvailability(tripId, userId) {
  const result = await apiPost('/api/trip', {
    action: 'getUserAvailability',
    tripId,
    userId,
  })

  return result?.dates ?? []
}

export async function confirmReady(tripId, userId) {
  await apiPost('/api/trip', {
    action: 'confirmReady',
    tripId,
    userId,
  })
}

export async function closeTrip(tripId) {
  await apiPost('/api/trip', {
    action: 'closeTrip',
    tripId,
  })
}

export async function getTripActivities(tripId) {
  const result = await apiPost('/api/trip', { action: 'getActivities', tripId })
  return (result?.activities ?? []).map((a) => ({
    id: a.id,
    date: String(a.date),
    hour: Number(a.hour),
    title: a.title,
    createdBy: a.created_by ?? null,
    createdAt: a.created_at,
  }))
}

export async function addTripActivity(tripId, { date, hour, title, userId }) {
  const result = await apiPost('/api/trip', {
    action: 'addActivity',
    tripId,
    date,
    hour,
    title,
    userId: userId ?? null,
  })
  return String(result?.id ?? '')
}

export async function removeTripActivity(tripId, activityId) {
  await apiPost('/api/trip', { action: 'removeActivity', tripId, activityId })
}
