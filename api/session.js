import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import {
  DEFAULT_TTL_DAYS,
  clearSessionCookie,
  createRawSessionToken,
  getSessionTokenFromRequest,
  getSourceKey,
  getUserAgent,
  parseJsonBody,
  sendJson,
  setSessionCookie,
  sha256Hex,
} from './_lib/session.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' })
  }

  const body = await parseJsonBody(req)
  const action = String(body.action || '').trim()

  try {
    if (action === 'start') {
      const code = String(body.code || '').trim()

      if (!code) {
        return sendJson(res, 400, { error: 'code_required' })
      }

      const rawToken = createRawSessionToken()
      const tokenHash = sha256Hex(rawToken)

      const { data, error } = await supabaseAdmin.rpc('start_session_with_access_code_v2', {
        p_code: code,
        p_session_token_hash: tokenHash,
        p_source_key: getSourceKey(req),
        p_user_agent: getUserAgent(req),
        p_ttl_days: DEFAULT_TTL_DAYS,
      })

      if (error) {
        console.error('session_start_failed', error)
        return sendJson(res, 500, { error: 'session_start_failed' })
      }

      if (!data) {
        return sendJson(res, 401, { error: 'invalid_passcode' })
      }

      setSessionCookie(res, rawToken, DEFAULT_TTL_DAYS)
      return sendJson(res, 200, { ok: true })
    }

    if (action === 'status') {
      const rawToken = getSessionTokenFromRequest(req)

      if (!rawToken) {
        return sendJson(res, 200, { active: false })
      }

      const tokenHash = sha256Hex(rawToken)
      const { error } = await supabaseAdmin.rpc('assert_valid_session_v2', {
        p_session_token_hash: tokenHash,
      })

      if (error) {
        clearSessionCookie(res)
        return sendJson(res, 200, { active: false })
      }

      return sendJson(res, 200, { active: true })
    }

    if (action === 'logout') {
      const rawToken = getSessionTokenFromRequest(req)

      if (rawToken) {
        await supabaseAdmin.rpc('revoke_session_v2', {
          p_session_token_hash: sha256Hex(rawToken),
        })
      }

      clearSessionCookie(res)
      return sendJson(res, 200, { ok: true })
    }

    return sendJson(res, 400, { error: 'invalid_action' })
  } catch (error) {
    console.error('session_api_error', error)
    return sendJson(res, 500, { error: 'server_error' })
  }
}
