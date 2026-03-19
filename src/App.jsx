import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TripPage from './pages/TripPage'
import brandIcon from './assets/svgS.svg'
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

function formatMonthKey(year, month) {
  if (!year || !month) {
    return ''
  }

  return `${year}-${month}`
}

function App() {
  const { t } = useTranslation()
  const [viewer] = useState(() => getOrCreateAnonymousUser())
  const [pathname, setPathname] = useState(() => getPathname())
  const [tripName, setTripName] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [participants, setParticipants] = useState([])
  const [limitToMonth, setLimitToMonth] = useState(false)
  const [limitedMonth, setLimitedMonth] = useState('')
  const [isCreatingTrip, setIsCreatingTrip] = useState(false)
  const [accessCodeInput, setAccessCodeInput] = useState('')
  const [accessError, setAccessError] = useState('')
  const [isVerifyingAccess, setIsVerifyingAccess] = useState(false)
  const [isAccessGranted, setIsAccessGranted] = useState(() => hasStoredAccessToken())

  const currentDate = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const monthValue = String(index + 1).padStart(2, '0')
      const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, index, 1))

      return {
        value: monthValue,
        label: monthLabel,
      }
    })
  }, [])
  const yearOptions = useMemo(() => {
    const currentYear = currentDate.getFullYear()

    return Array.from({ length: 7 }, (_, index) => String(currentYear - 1 + index))
  }, [currentDate])
  const selectedLimitedYear = /^\d{4}-\d{2}$/.test(limitedMonth) ? limitedMonth.slice(0, 4) : ''
  const selectedLimitedMonth = /^\d{4}-\d{2}$/.test(limitedMonth) ? limitedMonth.slice(5, 7) : ''

  function updateLimitedMonth(nextYear, nextMonth) {
    setLimitedMonth(formatMonthKey(nextYear, nextMonth))
  }

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
    setPathname(getPathname())
  }

  async function handleCreateTrip(event) {
    event.preventDefault()

    const trimmed = tripName.trim()
    const cleanParticipants = participants
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
    const monthQuery = limitToMonth && /^\d{4}-\d{2}$/.test(limitedMonth) ? limitedMonth : ''

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
      setLimitToMonth(false)
      setLimitedMonth('')

      const targetPath = monthQuery
        ? `/trip/${trip.id}?month=${encodeURIComponent(monthQuery)}`
        : `/trip/${trip.id}`

      navigate(targetPath)
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
        <a href="/" className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <img src={brandIcon} alt="" className="h-8 w-8 rounded-lg border border-slate-400 bg-white object-contain" />
          <span className="truncate">{t('brand.name')}</span>
        </a>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Invite only
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

          <div className="mt-1 rounded-md border border-slate-300 bg-slate-50 p-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={limitToMonth}
                onChange={(event) => {
                  const checked = event.target.checked
                  setLimitToMonth(checked)

                  if (checked) {
                    const defaultMonth = formatMonthKey(
                      String(currentDate.getFullYear()),
                      String(currentDate.getMonth() + 1).padStart(2, '0'),
                    )

                    setLimitedMonth((current) => current || defaultMonth)
                  } else {
                    setLimitedMonth('')
                  }
                }}
                className="h-4 w-4 rounded-[7px] border-slate-400 accent-orange-300 focus:ring-orange-300"
              />
              {t('landing.limitToMonthToggle')}
            </label>

            {limitToMonth && (
              <div className="mt-3">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                  {t('landing.limitToMonthLabel')}
                </label>

                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="relative">
                    <select
                      value={selectedLimitedMonth}
                      onChange={(event) => updateLimitedMonth(selectedLimitedYear, event.target.value)}
                      className="h-10 w-full appearance-none rounded-md border border-slate-400 bg-white pl-3 pr-10 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors duration-150 focus:border-orange-500 focus:ring-0 focus:shadow-none"
                      required={limitToMonth}
                    >
                      <option value="" disabled>Select month</option>
                      {monthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
                        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>

                  <div className="relative">
                    <select
                      value={selectedLimitedYear}
                      onChange={(event) => updateLimitedMonth(event.target.value, selectedLimitedMonth)}
                      className="h-10 w-full appearance-none rounded-md border border-slate-400 bg-white pl-3 pr-10 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors duration-150 focus:border-orange-500 focus:ring-0 focus:shadow-none"
                      required={limitToMonth}
                    >
                      <option value="" disabled>Select year</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
                        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-2 text-xs text-slate-600">{t('landing.limitToMonthHint')}</p>
          </div>

          <button
            type="submit"
            disabled={participants.length === 0 || isCreatingTrip || (limitToMonth && !limitedMonth)}
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
