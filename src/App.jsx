import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TripPage from './pages/TripPage'
import { initAnalytics, trackEvent } from './lib/telemetry'
import {
  clearAccessToken,
  createTrip,
  hasStoredAccessToken,
  storeAccessToken,
  verifyAccessCode,
} from './lib/supabaseBackend'
import { getOrCreateAnonymousUser } from './lib/userIdentity'

function getPathname() {
  return window.location.pathname
}

function App() {
  const { t } = useTranslation()
  const [viewer] = useState(() => getOrCreateAnonymousUser())
  const [pathname, setPathname] = useState(() => getPathname())
  const [tripName, setTripName] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [participants, setParticipants] = useState([])
  const [isCreatingTrip, setIsCreatingTrip] = useState(false)
  const [accessCodeInput, setAccessCodeInput] = useState('')
  const [accessError, setAccessError] = useState('')
  const [isVerifyingAccess, setIsVerifyingAccess] = useState(false)
  const [isAccessGranted, setIsAccessGranted] = useState(() => hasStoredAccessToken())

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

  const tripId = useMemo(() => {
    const match = pathname.match(/^\/trip\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]) : null
  }, [pathname])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPathname(path)
  }

  async function handleCreateTrip(event) {
    event.preventDefault()

    const trimmed = tripName.trim()
    const cleanParticipants = participants
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    if (!trimmed || cleanParticipants.length === 0) {
      return
    }

    if (isCreatingTrip) {
      return
    }

    try {
      setIsCreatingTrip(true)
      const trip = await createTrip(trimmed, cleanParticipants)

      if (!trip?.id) {
        throw new Error('Failed to create trip: missing trip id in response')
      }

      trackEvent('trip_created', {
        trip_id: trip.id,
        participant_count: cleanParticipants.length,
        trip_name_length: trimmed.length,
      })
      setTripName('')
      setParticipantName('')
      setParticipants([])
      navigate(`/trip/${trip.id}`)
    } catch (error) {
      console.error(error)

      if (String(error?.message ?? '').includes('invalid_session')) {
        clearAccessToken()
        setIsAccessGranted(false)
      }

      window.alert('Unable to create trip right now. Please check Supabase configuration and try again.')
    } finally {
      setIsCreatingTrip(false)
    }
  }

  function handleAddParticipant() {
    const trimmed = participantName.trim()

    if (!trimmed) {
      return
    }

    const exists = participants.some((name) => name.toLowerCase() === trimmed.toLowerCase())

    if (exists) {
      setParticipantName('')
      return
    }

    setParticipants((current) => [...current, trimmed])
    trackEvent('participant_added', {
      participant_count: participants.length + 1,
    })
    setParticipantName('')
  }

  function handleParticipantKeyDown(event) {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    handleAddParticipant()
  }

  function removeParticipant(nameToRemove) {
    setParticipants((current) => current.filter((name) => name !== nameToRemove))
  }

  async function handleAccessSubmit(event) {
    event.preventDefault()

    const entered = accessCodeInput.trim()

    if (!entered) {
      setAccessError('Enter a passcode to continue.')
      return
    }

    if (isVerifyingAccess) {
      return
    }

    try {
      setIsVerifyingAccess(true)
      const accessToken = await verifyAccessCode(entered)

      if (!accessToken) {
        setAccessError('Invalid passcode.')
        return
      }

      storeAccessToken(accessToken)

      setIsAccessGranted(true)
      setAccessError('')
      setAccessCodeInput('')
    } catch (error) {
      console.error(error)
      setAccessError('Unable to verify passcode right now. Please try again.')
    } finally {
      setIsVerifyingAccess(false)
    }
  }

  if (!isAccessGranted) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
        <section className="mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-7 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Private Access</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">Enter passcode</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            This app is protected with a shared passcode.
          </p>

          <form className="mt-6 flex flex-col gap-3" onSubmit={handleAccessSubmit}>
            <input
              type="password"
              autoComplete="off"
              value={accessCodeInput}
              onChange={(event) => {
                setAccessCodeInput(event.target.value)

                if (accessError) {
                  setAccessError('')
                }
              }}
              className="h-11 rounded-md border border-slate-400 bg-white px-3 text-slate-900 outline-none transition duration-150 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Passcode"
            />

            {accessError && <p className="text-xs font-medium text-rose-700">{accessError}</p>}

            <button
              type="submit"
              disabled={isVerifyingAccess}
              className="h-11 rounded-md bg-orange-500 px-4 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-orange-300"
            >
              {isVerifyingAccess ? 'Checking...' : 'Continue'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (tripId) {
    return <TripPage tripId={tripId} />
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mx-auto mb-8 flex w-full max-w-2xl items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 transition-colors duration-150">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-orange-500 text-white">✈</span>
          <span>{t('brand.name')}</span>
        </a>
        <span className="rounded-md bg-orange-500 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          {t('badge.mvp')}
        </span>
      </header>

      <section className="mx-auto max-w-2xl rounded-xl border border-slate-300 bg-white p-7 sm:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">{t('landing.eyebrow')}</p>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
          {t('landing.title')}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
          {t('landing.subtitle')}
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={handleCreateTrip}>
          <label htmlFor="trip-name" className="text-sm font-medium text-slate-800">
            {t('landing.tripNameLabel')}
          </label>
          <input
            id="trip-name"
            placeholder={t('landing.tripNamePlaceholder')}
            value={tripName}
            onChange={(event) => setTripName(event.target.value)}
            maxLength={64}
            className="h-11 rounded-md border border-slate-400 bg-white px-3 text-slate-900 outline-none transition duration-150 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            required
          />

          <label htmlFor="participant-name" className="mt-2 text-sm font-medium text-slate-800">
            {t('landing.participantsLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="participant-name"
              placeholder={t('landing.participantPlaceholder')}
              value={participantName}
              onChange={(event) => setParticipantName(event.target.value)}
              onKeyDown={handleParticipantKeyDown}
              maxLength={24}
              className="h-11 flex-1 rounded-md border border-slate-400 bg-white px-3 text-slate-900 outline-none transition duration-150 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={handleAddParticipant}
              className="h-11 rounded-md border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-800 transition duration-150 hover:bg-slate-100 active:scale-[0.99]"
            >
              {t('landing.add')}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {participants.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeParticipant(name)}
                  className="rounded-sm px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  aria-label={t('landing.removeParticipant', { name })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <p className="text-xs text-slate-500">{t('landing.participantsHint')}</p>
          <button
            type="submit"
            disabled={participants.length === 0 || isCreatingTrip}
            className="h-11 rounded-md bg-orange-500 px-4 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {isCreatingTrip ? 'Creating trip...' : t('landing.createTrip')}
          </button>
        </form>
      </section>

      <footer className="mx-auto mt-8 max-w-2xl pb-2 text-center text-xs text-slate-600">
        <p>{t('footer.tagline')}</p>
        <nav className="mt-2 flex items-center justify-center gap-3 text-slate-600">
          <a href="/about" className="transition duration-150 hover:text-slate-900">{t('footer.about')}</a>
          <span aria-hidden="true">•</span>
          <a href="/contact" className="transition duration-150 hover:text-slate-900">{t('footer.contact')}</a>
          <span aria-hidden="true">•</span>
          <a href="/privacy" className="transition duration-150 hover:text-slate-900">{t('footer.privacy')}</a>
          <span aria-hidden="true">•</span>
          <a href="/terms" className="transition duration-150 hover:text-slate-900">{t('footer.terms')}</a>
        </nav>
      </footer>
    </main>
  )
}

export default App
