import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import {
  DEFAULT_TTL_DAYS,
  createRawSessionToken,
  getSessionTokenFromRequest,
  getSourceKey,
  getUserAgent,
  parseJsonBody,
  sendJson,
  setSessionCookie,
  sha256Hex,
} from './_lib/session.js'

function normalizeDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function ensureSessionHash(req, res, { allowCreate }) {
  const rawFromCookie = getSessionTokenFromRequest(req)

  if (rawFromCookie) {
    return sha256Hex(rawFromCookie)
  }

  if (!allowCreate) {
    return ''
  }

  const rawToken = createRawSessionToken()
  const tokenHash = sha256Hex(rawToken)

  const { error } = await supabaseAdmin.rpc('create_link_session_v2', {
    p_session_token_hash: tokenHash,
    p_ttl_days: DEFAULT_TTL_DAYS,
    p_source_key: getSourceKey(req),
    p_user_agent: getUserAgent(req),
  })

  if (error) {
    throw new Error(`link_session_failed:${error.message}`)
  }

  setSessionCookie(res, rawToken, DEFAULT_TTL_DAYS)
  return tokenHash
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' })
  }

  const body = await parseJsonBody(req)
  const action = String(body.action || '').trim()

  try {
    if (action === 'consumeAccess') {
      const tripId = String(body.tripId || '').trim()
      const accessToken = String(body.accessToken || '').trim()

      if (!tripId || !accessToken) {
        return sendJson(res, 400, { error: 'trip_id_and_access_token_required' })
      }

      const sessionHash = await ensureSessionHash(req, res, { allowCreate: true })
      const { data, error } = await supabaseAdmin.rpc('consume_trip_access_token_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
        p_access_token: accessToken,
      })

      if (error) {
        console.error('consume_access_failed', error)
        return sendJson(res, 500, { error: 'consume_access_failed' })
      }

      if (!data) {
        return sendJson(res, 403, { error: 'invalid_or_expired_access_token' })
      }

      return sendJson(res, 200, { ok: true })
    }

    const sessionHash = await ensureSessionHash(req, res, { allowCreate: false })

    if (!sessionHash) {
      return sendJson(res, 401, { error: 'missing_session' })
    }

    if (action === 'createTrip') {
      const tripName = String(body.tripName || '').trim()
      const participantNames = Array.isArray(body.participantNames) ? body.participantNames : []

      if (!tripName) {
        return sendJson(res, 400, { error: 'trip_name_required' })
      }

      const { data, error } = await supabaseAdmin.rpc('create_trip_with_participants_secure_v2', {
        p_session_token_hash: sessionHash,
        p_trip_name: tripName,
        p_participant_names: participantNames,
      })

      if (error) {
        console.error('trip_create_failed', error)
        return sendJson(res, 500, { error: 'trip_create_failed' })
      }

      const trip = data?.[0]

      if (!trip?.id) {
        return sendJson(res, 500, { error: 'trip_create_missing_id' })
      }

      const issueResult = await supabaseAdmin.rpc('issue_trip_access_token_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: trip.id,
        p_role: 'editor',
        p_ttl_days: DEFAULT_TTL_DAYS,
        p_max_uses: null,
      })

      if (issueResult.error) {
        console.error('share_token_issue_failed', issueResult.error)
        return sendJson(res, 500, { error: 'share_token_issue_failed' })
      }

      return sendJson(res, 200, {
        trip,
        shareAccessToken: issueResult.data,
      })
    }

    const tripId = String(body.tripId || '').trim()

    if (!tripId) {
      return sendJson(res, 400, { error: 'trip_id_required' })
    }

    if (action === 'getTrip') {
      const { data, error } = await supabaseAdmin.rpc('get_trip_secure_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
      })

      if (error) {
        console.error('trip_access_failed', error)
        return sendJson(res, 403, { error: 'trip_access_failed' })
      }

      return sendJson(res, 200, { trip: data?.[0] || null })
    }

    if (action === 'getTripUsers') {
      const { data, error } = await supabaseAdmin.rpc('get_trip_users_secure_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
      })

      if (error) {
        console.error('trip_users_failed', error)
        return sendJson(res, 403, { error: 'trip_users_failed' })
      }

      return sendJson(res, 200, { users: data || [] })
    }

    if (action === 'getTripAvailability') {
      const { data, error } = await supabaseAdmin.rpc('get_trip_availability_secure_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
      })

      if (error) {
        console.error('trip_availability_failed', error)
        return sendJson(res, 403, { error: 'trip_availability_failed' })
      }

      return sendJson(res, 200, { availability: data || [] })
    }

    if (action === 'getUserAvailability') {
      const userId = String(body.userId || '').trim()

      if (!userId) {
        return sendJson(res, 400, { error: 'user_id_required' })
      }

      const { data, error } = await supabaseAdmin.rpc('get_user_availability_secure_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
        p_user_id: userId,
      })

      if (error) {
        console.error('user_availability_failed', error)
        return sendJson(res, 403, { error: 'user_availability_failed' })
      }

      return sendJson(res, 200, { dates: (data || []).map((entry) => entry.date) })
    }

    if (action === 'replaceAvailability') {
      const userId = String(body.userId || '').trim()
      const dates = Array.isArray(body.dates) ? body.dates : []
      const normalizedDates = [...new Set(dates.map(normalizeDate).filter(Boolean))]

      if (!userId) {
        return sendJson(res, 400, { error: 'user_id_required' })
      }

      const { error } = await supabaseAdmin.rpc('replace_availability_buffered_secure_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
        p_user_id: userId,
        p_dates: normalizedDates,
      })

      if (error) {
        const details = String(error.message || '')
        if (details.includes('rate_limited')) {
          return sendJson(res, 429, { error: 'rate_limited' })
        }

        console.error('replace_availability_failed', error)
        return sendJson(res, 403, { error: 'replace_availability_failed' })
      }

      return sendJson(res, 200, { ok: true })
    }

    if (action === 'issueShareToken') {
      const { data, error } = await supabaseAdmin.rpc('issue_trip_access_token_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
        p_role: 'editor',
        p_ttl_days: DEFAULT_TTL_DAYS,
        p_max_uses: null,
      })

      if (error) {
        console.error('issue_share_token_failed', error)
        return sendJson(res, 403, { error: 'issue_share_token_failed' })
      }

      return sendJson(res, 200, { accessToken: data })
    }

    if (action === 'confirmReady') {
      const userId = String(body.userId || '').trim()

      if (!userId) {
        return sendJson(res, 400, { error: 'user_id_required' })
      }

      const { error } = await supabaseAdmin.rpc('confirm_user_ready_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
        p_user_id: userId,
      })

      if (error) {
        console.error('confirm_ready_failed', error)
        return sendJson(res, 403, { error: 'confirm_ready_failed' })
      }

      return sendJson(res, 200, { ok: true })
    }

    if (action === 'closeTrip') {
      const { error } = await supabaseAdmin.rpc('close_trip_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
      })

      if (error) {
        console.error('close_trip_failed', error)
        return sendJson(res, 403, { error: 'close_trip_failed' })
      }

      return sendJson(res, 200, { ok: true })
    }

    if (action === 'getActivities') {
      const { data, error } = await supabaseAdmin.rpc('get_trip_activities_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
      })
      if (error) { console.error('get_activities_failed', error); return sendJson(res, 403, { error: 'get_activities_failed' }) }
      return sendJson(res, 200, { activities: data || [] })
    }

    if (action === 'addActivity') {
      const date = String(body.date || '').trim()
      const hour = Number(body.hour)
      const title = String(body.title || '').trim()
      const userId = String(body.userId || '').trim() || null
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || title.length > 200 || !Number.isInteger(hour) || hour < 0 || hour > 23) {
        return sendJson(res, 400, { error: 'invalid_activity_params' })
      }
      const { data, error } = await supabaseAdmin.rpc('add_trip_activity_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
        p_date: date,
        p_hour: hour,
        p_title: title,
        p_user_id: userId,
      })
      if (error) { console.error('add_activity_failed', error); return sendJson(res, 403, { error: 'add_activity_failed' }) }
      return sendJson(res, 200, { id: data })
    }

    if (action === 'removeActivity') {
      const activityId = String(body.activityId || '').trim()
      if (!activityId) return sendJson(res, 400, { error: 'activity_id_required' })
      const { error } = await supabaseAdmin.rpc('remove_trip_activity_v2', {
        p_session_token_hash: sessionHash,
        p_trip_id: tripId,
        p_activity_id: activityId,
      })
      if (error) { console.error('remove_activity_failed', error); return sendJson(res, 403, { error: 'remove_activity_failed' }) }
      return sendJson(res, 200, { ok: true })
    }

    return sendJson(res, 400, { error: 'invalid_action' })
  } catch (error) {
    console.error('trip_api_error', error)
    return sendJson(res, 500, { error: 'server_error' })
  }
}
