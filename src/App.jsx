import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccessGate from './components/AccessGate'
import CookieConsent from './components/CookieConsent'
import ErrorBoundary from './components/ErrorBoundary'
import TripPage from './pages/TripPage'
import TripPlanPage from './pages/TripPlanPage'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import NotFoundPage from './pages/NotFoundPage'
import { getCookieConsent, setCookieConsent } from './lib/cookieConsent'
import { DarkModeProvider } from './lib/darkMode'
import { NavigationContext } from './lib/navigation'
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
  const [cookieConsent, setCookieConsentState] = useState(() => getCookieConsent())

  const tripId = getTripIdFromPath(pathname)

  useEffect(() => {
    function onPopState() {
      setPathname(getPathname())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (cookieConsent === 'accepted') {
      initAnalytics(viewer.id)
    }
  }, [cookieConsent, viewer.id])

  function handleAcceptCookies() {
    setCookieConsent('accepted')
    setCookieConsentState('accepted')
  }

  function handleRejectCookies() {
    setCookieConsent('rejected')
    setCookieConsentState('rejected')
  }

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
        if (!cancelled) setIsAccessGranted(active)
      } catch {
        if (!cancelled) setIsAccessGranted(false)
      } finally {
        if (!cancelled) setIsBootstrappingAccess(false)
      }
    }

    bootstrapAccessState()
    return () => { cancelled = true }
  }, [tripId])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPathname(getPathname())
  }

  function renderContent() {
    if (pathname === '/about') return <AboutPage />
    if (pathname === '/contact') return <ContactPage />
    if (pathname === '/privacy') return <PrivacyPage />
    if (pathname === '/terms') return <TermsPage />

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
      if (isPlanPath(pathname)) return <TripPlanPage tripId={tripId} />
      return <TripPage tripId={tripId} />
    }

    if (pathname === '/') return <LandingPage />

    return <NotFoundPage />
  }

  return (
    <DarkModeProvider>
      <NavigationContext.Provider value={navigate}>
        <ErrorBoundary>
          <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <a href="#main-content" className="skip-link">{t('ui.skipToContent')}</a>
            {renderContent()}
            {cookieConsent === null && (
              <CookieConsent onAccept={handleAcceptCookies} onReject={handleRejectCookies} />
            )}
          </div>
        </ErrorBoundary>
      </NavigationContext.Provider>
    </DarkModeProvider>
  )
}

export default App
