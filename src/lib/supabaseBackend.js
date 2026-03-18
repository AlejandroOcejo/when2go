import { createClient } from '@supabase/supabase-js'

const USER_COLORS = ['#0f766e', '#16a34a', '#b45309', '#be123c', '#0369a1', '#7c3aed']
const ACCESS_TOKEN_SESSION_KEY = 'travel-group-access-token'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
    )
  }

  return supabase
}

function throwIfError(error, context) {
  if (!error) {
    return
  }

  throw new Error(`${context}: ${error.message}`)
}

function getStoredAccessToken() {
  try {
    const token = window.sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY)
    return token ? token.trim() : ''
  } catch {
    return ''
  }
}

function requireAccessToken() {
  const token = getStoredAccessToken()

  if (!token) {
    throw new Error('Missing access session. Please enter the passcode again.')
  }

  return token
}

export function hasStoredAccessToken() {
  return Boolean(getStoredAccessToken())
}

export function storeAccessToken(token) {
  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_SESSION_KEY, token)
  } catch {
    // Ignore storage failures.
  }
}

export function clearAccessToken() {
  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY)
  } catch {
    // Ignore storage failures.
  }
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

export async function createTrip(name, participantNames = []) {
  const client = requireSupabase()
  const sessionToken = requireAccessToken()

  const participants = normalizeParticipantNames(participantNames)
  const { data, error } = await client.rpc('create_trip_with_participants', {
    p_session_token: sessionToken,
    p_trip_name: name.trim(),
    p_participant_names: participants,
  })

  throwIfError(error, 'Failed to create trip')
  return data?.[0] ?? null
}

export async function getTrip(tripId) {
  const client = requireSupabase()
  const sessionToken = requireAccessToken()

  const { data, error } = await client.rpc('get_trip_secure', {
    p_session_token: sessionToken,
    p_trip_id: tripId,
  })

  throwIfError(error, 'Failed to load trip')
  return data?.[0] ?? null
}

export async function getTripUsers(tripId) {
  const client = requireSupabase()
  const sessionToken = requireAccessToken()

  const { data, error } = await client.rpc('get_trip_users_secure', {
    p_session_token: sessionToken,
    p_trip_id: tripId,
  })

  throwIfError(error, 'Failed to load trip participants')

  return (data ?? []).map((user) => ({
    id: user.id,
    name: user.name,
    color: user.color ?? '#5f6f52',
  }))
}

export async function upsertUser(user) {
  const userId = user?.id
  const userName = user?.name

  if (!userId || !userName) {
    throw new Error('Failed to upsert user: id and name are required')
  }

  return {
    id: userId,
    name: userName,
    color: user?.color ?? pickColor(userId),
  }
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

export async function replaceAvailability(tripId, userId, dates) {
  const client = requireSupabase()
  const sessionToken = requireAccessToken()

  const uniqueDates = [...new Set(dates.map((date) => normalizeDate(date)))]
  const { error } = await client.rpc('replace_availability_buffered', {
    p_session_token: sessionToken,
    p_trip_id: tripId,
    p_user_id: userId,
    p_dates: uniqueDates,
  })

  if (error?.message?.includes('rate_limited')) {
    throw new Error('Availability sync was rate-limited. Please wait a moment and try again.')
  }

  throwIfError(error, 'Failed to save availability')
}

export async function getTripAvailability(tripId) {
  const client = requireSupabase()
  const sessionToken = requireAccessToken()

  const { data, error } = await client.rpc('get_trip_availability_secure', {
    p_session_token: sessionToken,
    p_trip_id: tripId,
  })

  throwIfError(error, 'Failed to load availability')
  return data ?? []
}

export async function getUserAvailability(tripId, userId) {
  const client = requireSupabase()
  const sessionToken = requireAccessToken()

  const { data, error } = await client.rpc('get_user_availability_secure', {
    p_session_token: sessionToken,
    p_trip_id: tripId,
    p_user_id: userId,
  })

  throwIfError(error, 'Failed to load user availability')
  return (data ?? []).map((entry) => entry.date)
}

export async function verifyAccessCode(code) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('verify_access_code', {
    p_code: code,
  })

  throwIfError(error, 'Failed to verify access code')
  return typeof data === 'string' && data.length > 0 ? data : null
}
