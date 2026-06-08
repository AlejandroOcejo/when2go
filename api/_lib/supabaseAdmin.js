import { createClient } from '@supabase/supabase-js'

const env = globalThis.process?.env ?? {}

const SUPABASE_URL_ENV_KEYS = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
]

const SERVICE_ROLE_ENV_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_ROLE',
  'SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
]

function readFirstEnvValue(keys) {
  for (const key of keys) {
    const value = String(env[key] || '').trim()

    if (value) {
      return value
    }
  }

  return ''
}

function looksLikePlaceholderServiceRoleKey(value) {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) {
    return true
  }

  if (normalized.includes('paste_your') || normalized.includes('your_') || normalized.includes('here')) {
    return true
  }

  // Supabase service keys are JWTs with 3 dot-separated segments.
  return String(value).split('.').length !== 3
}

const supabaseUrl = readFirstEnvValue(SUPABASE_URL_ENV_KEYS)
const serviceRoleKey = readFirstEnvValue(SERVICE_ROLE_ENV_KEYS)

if (!supabaseUrl || !serviceRoleKey) {
  const resolvedKeys = [...SUPABASE_URL_ENV_KEYS, ...SERVICE_ROLE_ENV_KEYS].filter((key) =>
    Boolean(String(env[key] || '').trim()),
  )

  throw new Error(
    `Missing Supabase credentials. Provide one of [${SUPABASE_URL_ENV_KEYS.join(', ')}] and one of [${SERVICE_ROLE_ENV_KEYS.join(', ')}]. Resolved env keys: ${resolvedKeys.join(', ') || 'none'}.`,
  )
}

if (looksLikePlaceholderServiceRoleKey(serviceRoleKey)) {
  throw new Error(
    'Invalid SUPABASE_SERVICE_ROLE_KEY. Replace placeholder text with a real service role key from Supabase Project Settings > API.',
  )
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})
