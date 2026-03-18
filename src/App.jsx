import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TripPage from './pages/TripPage'
import { initAnalytics, trackEvent } from './lib/telemetry'
import { createTrip } from './lib/mockBackend'
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

  function handleCreateTrip(event) {
    event.preventDefault()

    const trimmed = tripName.trim()
    const cleanParticipants = participants
      .map((name) => name.trim())
      .filter((name) => name.length > 0)

    if (!trimmed || cleanParticipants.length === 0) {
      return
    }

    const trip = createTrip(trimmed, cleanParticipants)
    trackEvent('trip_created', {
      trip_id: trip.id,
      participant_count: cleanParticipants.length,
      trip_name_length: trimmed.length,
    })
    setTripName('')
    setParticipantName('')
    setParticipants([])
    navigate(`/trip/${trip.id}`)
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
            disabled={participants.length === 0}
            className="h-11 rounded-md bg-orange-500 px-4 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {t('landing.createTrip')}
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
