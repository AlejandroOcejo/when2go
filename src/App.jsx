import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccessGate from './components/AccessGate'
import TripPage from './pages/TripPage'
import LandingPage from './pages/LandingPage'
import { initAnalytics } from './lib/telemetry'
import {
  consumeTripAccessToken,
  getSessionStatus,
  hasStoredAccessToken,
} from './lib/supabaseBackend'
import {
  clearAccessTokenFromCurrentUrl,
  getAccessTokenFromSearch,
  getTripIdFromPath,
} from './lib/tripLink'
import { getOrCreateAnonymousUser } from './lib/userIdentity'

function getPathname() {
  return window.location.pathname
}

function App() {
  const { t } = useTranslation()
  const [viewer] = useState(() => getOrCreateAnonymousUser())
  const [pathname, setPathname] = useState(() => getPathname())
  const [isAccessGranted, setIsAccessGranted] = useState(() => hasStoredAccessToken())
  const [isBootstrappingAccess, setIsBootstrappingAccess] = useState(true)

  const tripId = getTripIdFromPath(pathname)

  useEffect(() => {
    function onPopState() {
      setPathname(getPathname())
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    initAnalytics(viewer.id)
  }, [viewer.id])

  useEffect(() => {
    let cancelled = false

    async function bootstrapAccessState() {
      setIsBootstrappingAccess(true)

      try {
        if (tripId) {
          const accessToken = getAccessTokenFromSearch(window.location.search)

          if (accessToken) {
            const granted = await consumeTripAccessToken(tripId, accessToken)

            if (!cancelled && granted) {
              setIsAccessGranted(true)
              clearAccessTokenFromCurrentUrl()
            }
          }
        }

        const active = await getSessionStatus()

        if (!cancelled) {
          setIsAccessGranted(active)
        }
      } catch {
        if (!cancelled) {
          setIsAccessGranted(false)
        }
      } finally {
        if (!cancelled) {
          setIsBootstrappingAccess(false)
        }
      }
    }

    bootstrapAccessState()

    return () => {
      cancelled = true
    }
  }, [tripId, pathname])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPathname(getPathname())
  }

  if (isBootstrappingAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
        <section className="mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-7 sm:p-8">
          <p className="text-sm font-medium text-slate-700">{t('access.checking')}</p>
        </section>
      </main>
    )
  }

  if (!isAccessGranted) {
    return <AccessGate onAccessGranted={() => setIsAccessGranted(true)} />
  }

  if (tripId) {
    return <TripPage tripId={tripId} />
  }

  return <LandingPage onNavigate={navigate} />
}

export default App
