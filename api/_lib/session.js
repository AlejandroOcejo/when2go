import crypto from 'node:crypto'

const SESSION_COOKIE_NAME = 'app_sess'
const DEFAULT_TTL_DAYS = 30

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function parseJsonBody(req) {
  if (req._parsedJsonBody !== undefined) {
    return req._parsedJsonBody
  }

  // Prefer framework-parsed body when available and safe.
  try {
    if (req.body && typeof req.body === 'object') {
      req._parsedJsonBody = req.body
      return req._parsedJsonBody
    }

    if (typeof req.body === 'string' && req.body.trim()) {
      req._parsedJsonBody = JSON.parse(req.body)
      return req._parsedJsonBody
    }
  } catch {
    // Fall through to manual stream parsing.
  }

  let rawBody = ''

  try {
    for await (const chunk of req) {
      rawBody += chunk
    }
  } catch {
    req._parsedJsonBody = {}
    return req._parsedJsonBody
  }

  if (!rawBody.trim()) {
    req._parsedJsonBody = {}
    return req._parsedJsonBody
  }

  try {
    req._parsedJsonBody = JSON.parse(rawBody)
    return req._parsedJsonBody
  } catch {
    req._parsedJsonBody = {}
    return req._parsedJsonBody
  }
}

export function getCookie(req, name) {
  const cookieHeader = String(req.headers.cookie || '')

  if (!cookieHeader) {
    return ''
  }

  const pairs = cookieHeader.split(';')

  for (const pair of pairs) {
    const [rawKey, ...rawValue] = pair.trim().split('=')

    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='))
    }
  }

  return ''
}

export function getSessionTokenFromRequest(req) {
  return getCookie(req, SESSION_COOKIE_NAME)
}

export function createRawSessionToken() {
  return toBase64Url(crypto.randomBytes(32))
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

export function getSourceKey(req) {
  const vercelForwardedFor = String(req.headers['x-vercel-forwarded-for'] || '').split(',')[0].trim()
  const socketAddress = String(req.socket?.remoteAddress || '').trim()
  const realIp = String(req.headers['x-real-ip'] || '').trim()

  return vercelForwardedFor || socketAddress || realIp || 'unknown'
}

export function getUserAgent(req) {
  return String(req.headers['user-agent'] || '')
}

export function setSessionCookie(res, token, ttlDays = DEFAULT_TTL_DAYS) {
  const safeTtlDays = Math.max(1, Math.min(Number(ttlDays) || DEFAULT_TTL_DAYS, 30))
  const maxAge = safeTtlDays * 24 * 60 * 60
  const cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  res.setHeader('Set-Cookie', cookie)
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
}

export function sendJson(res, statusCode, body) {
  res.status(statusCode).setHeader('Content-Type', 'application/json; charset=utf-8').end(JSON.stringify(body))
}

export { DEFAULT_TTL_DAYS }
