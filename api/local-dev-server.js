import { config as loadEnv } from 'dotenv'
import express from 'express'

const env = globalThis.process?.env ?? {}

// Mirror Vite-style local env resolution for API-only local runs.
for (const path of ['.env.development.local', '.env.local', '.env.development', '.env']) {
  loadEnv({ path, override: false })
}

let sessionHandler = null
let tripHandler = null
let startupConfigError = null

try {
  const [{ default: loadedSessionHandler }, { default: loadedTripHandler }] = await Promise.all([
    import('./session.js'),
    import('./trip.js'),
  ])

  sessionHandler = loadedSessionHandler
  tripHandler = loadedTripHandler
} catch (error) {
  startupConfigError = String(error?.message || error)
  console.error('local_api_startup_config_error', startupConfigError)
}

const port = Number(env.LOCAL_API_PORT || 3000)
const app = express()

app.use(express.json({ limit: '1mb' }))

// Keep shape close to Vercel handlers by preserving req/res usage.
app.post('/api/session', async (req, res) => {
  if (startupConfigError || !sessionHandler) {
    return res.status(500).json({
      error: 'local_api_not_configured',
      details: startupConfigError || 'Session handler failed to initialize.',
    })
  }

  try {
    await sessionHandler(req, res)
  } catch (error) {
    res.status(500).json({
      error: 'local_api_handler_error',
      details: String(error?.message || error),
    })
  }
})

app.post('/api/trip', async (req, res) => {
  if (startupConfigError || !tripHandler) {
    return res.status(500).json({
      error: 'local_api_not_configured',
      details: startupConfigError || 'Trip handler failed to initialize.',
    })
  }

  try {
    await tripHandler(req, res)
  } catch (error) {
    res.status(500).json({
      error: 'local_api_handler_error',
      details: String(error?.message || error),
    })
  }
})

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, mode: 'local-api-server' })
})

app.listen(port, () => {
  console.log(`Local API server ready on http://localhost:${port}`)
})
