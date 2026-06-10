import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccessGate from './components/AccessGate'
import TripPage from './pages/TripPage'
import TripPlanPage from './pages/TripPlanPage'
import LandingPage from './pages/LandingPage'
import { DarkModeProvider } from './lib/darkMode'
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
  isPlanPath,
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
  const [isBootstrappingAccess, setIsBootstrappingAccess] = useState(() => !hasStoredAccessToken())

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
  }, [tripId])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPathname(getPathname())
  }

  function renderContent() {
    if (isBootstrappingAccess) {
      return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 sm:py-10">
          <section className="mx-auto max-w-md rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-7 sm:p-8">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('access.checking')}</p>
          </section>
        </main>
      )
    }

    if (!isAccessGranted) {
      return <AccessGate onAccessGranted={() => setIsAccessGranted(true)} />
    }

    if (tripId) {
      if (isPlanPath(pathname)) {
        return <TripPlanPage tripId={tripId} onNavigate={navigate} />
      }
      return <TripPage tripId={tripId} onNavigate={navigate} />
    }

    return <LandingPage onNavigate={navigate} />
  }

  return <DarkModeProvider>{renderContent()}</DarkModeProvider>
}

export default App


