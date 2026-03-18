import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import UserPicker from '../components/UserPicker'
import { identifyAnalyticsUser, trackEvent } from '../lib/telemetry'
import {
  getTrip,
  getTripAvailability,
  getTripUsers,
  getUserAvailability,
  replaceAvailability,
} from '../lib/mockBackend'
import {
  getOrCreateAnonymousUser,
  getSelectedTripUser,
  saveSelectedTripUser,
} from '../lib/userIdentity'

function groupAvailabilityByDate(availabilityRows) {
  return availabilityRows.reduce((accumulator, row) => {
    if (!accumulator[row.date]) {
      accumulator[row.date] = []
    }

    accumulator[row.date].push({
      userId: row.user_id,
      name: row.user_name,
      color: row.user_color,
    })

    return accumulator
  }, {})
}

function byDateAscending([leftDate], [rightDate]) {
  return leftDate.localeCompare(rightDate)
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(dateKey, locale) {
  const date = parseDateKey(dateKey)

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function TripPage({ tripId }) {
  const { t, i18n } = useTranslation()
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missingTrip, setMissingTrip] = useState(false)
  const [shareCardOpen, setShareCardOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [viewer] = useState(() => getOrCreateAnonymousUser())
  const [tripUsers, setTripUsers] = useState([])
  const [selectedTripUserId, setSelectedTripUserId] = useState(() => getSelectedTripUser(tripId))
  const [selectedDates, setSelectedDates] = useState([])
  const [availabilityRows, setAvailabilityRows] = useState([])

  const selectedTripUser = useMemo(() => {
    return tripUsers.find((user) => user.id === selectedTripUserId) ?? null
  }, [tripUsers, selectedTripUserId])

  const groupedAvailability = useMemo(() => {
    return groupAvailabilityByDate(availabilityRows)
  }, [availabilityRows])

  const maxAvailabilityCount = useMemo(() => {
    return Object.values(groupedAvailability).reduce((highest, users) => {
      return Math.max(highest, users.length)
    }, 0)
  }, [groupedAvailability])

  useEffect(() => {
    identifyAnalyticsUser(viewer.id)
  }, [viewer.id])

  useEffect(() => {
    if (!trip) {
      return
    }

    trackEvent('trip_viewed', {
      trip_id: trip.id,
      participant_count: tripUsers.length,
    })
  }, [trip, tripUsers.length])

  useEffect(() => {
    const foundTrip = getTrip(tripId)

    if (!foundTrip) {
      setMissingTrip(true)
      setLoading(false)
      return
    }

    setTrip(foundTrip)
    const users = getTripUsers(tripId)
    setTripUsers(users)

    if (users.some((user) => user.id === selectedTripUserId)) {
      // Keep previously chosen user for this trip in this browser.
    } else {
      setSelectedTripUserId(null)
    }

    setMissingTrip(false)
    setLoading(false)
  }, [tripId, selectedTripUserId])

  useEffect(() => {
    if (!tripId || !selectedTripUserId) {
      return
    }

    const ownDates = getUserAvailability(tripId, selectedTripUserId)
    setSelectedDates(ownDates)
  }, [tripId, selectedTripUserId])

  useEffect(() => {
    if (!tripId) {
      return
    }

    function readSharedState() {
      const rows = getTripAvailability(tripId)
      setAvailabilityRows(rows)
    }

    readSharedState()
    const intervalId = window.setInterval(readSharedState, 2000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [tripId])

  function handleUserSelect(userId) {
    setSelectedTripUserId(userId)
    saveSelectedTripUser(tripId, userId)
    trackEvent('trip_user_selected', {
      trip_id: tripId,
    })
  }

  function handleDatesChange(nextDates) {
    if (!selectedTripUserId) {
      return
    }

    const previousCount = selectedDates.length
    const nextCount = nextDates.length

    setSelectedDates(nextDates)
    trackEvent('availability_updated', {
      trip_id: tripId,
      selected_count: nextCount,
      delta: nextCount - previousCount,
    })

    replaceAvailability(tripId, selectedTripUserId, nextDates)
    const rows = getTripAvailability(tripId)
    setAvailabilityRows(rows)
  }

  async function handleCopyLink() {
    const shareLink = `${window.location.origin}/trip/${tripId}`

    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      trackEvent('trip_link_copied', {
        trip_id: tripId,
      })
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-700 sm:px-6">
        <div className="mx-auto max-w-3xl">{t('trip.loading')}</div>
      </main>
    )
  }

  if (missingTrip || !trip) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-7">
          <h1 className="text-2xl font-bold text-slate-900">{t('trip.notFoundTitle')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('trip.notFoundBody')}</p>
          <a
            href="/"
            className="mt-5 inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600"
          >
            {t('trip.createNewTrip')}
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mx-auto mb-8 flex w-full max-w-3xl items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 transition-colors duration-150">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-orange-500 text-white">✈</span>
          <span>{t('brand.name')}</span>
        </a>
        <span className="rounded-md bg-orange-500 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          {t('badge.liveTrip')}
        </span>
      </header>

      <section className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">
            {trip.name}
          </h1>

          <div
            className={`overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out ${
              shareCardOpen
                ? 'pointer-events-none max-w-0 -translate-y-1 opacity-0'
                : 'max-w-[180px] translate-y-0 opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-10 rounded-md bg-orange-500 px-3 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600 active:scale-[0.99]"
            >
              {copied ? t('trip.copied') : t('trip.copyLink')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShareCardOpen((current) => !current)}
            aria-label={shareCardOpen ? t('trip.collapseCard') : t('trip.expandCard')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-400 text-slate-700 transition duration-150 hover:bg-slate-100"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 transition duration-200 ${shareCardOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        </div>

        <div
          className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
            shareCardOpen ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0">
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{t('trip.shareSubtitle')}</p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                value={`${window.location.origin}/trip/${trip.id}`}
                onFocus={(event) => event.target.select()}
                className="h-10 flex-1 rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-800"
                aria-label={t('trip.shareInputAria')}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`h-10 rounded-md bg-orange-500 px-3 text-sm font-semibold text-white transition-[background-color,transform,opacity] duration-200 ease-out hover:bg-orange-600 active:scale-[0.99] ${
                  shareCardOpen
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none -translate-y-1 opacity-0'
                }`}
              >
                {copied ? t('trip.copied') : t('trip.copyLink')}
              </button>
            </div>
            <p className={`mt-2 text-xs transition duration-150 ${copied ? 'text-emerald-700' : 'text-slate-500'}`}>
              {copied ? t('trip.copiedHint') : t('trip.shareHint')}
            </p>
          </div>
        </div>
      </section>

      {!selectedTripUser ? (
        <div className="mx-auto mt-7 max-w-3xl">
          {tripUsers.length === 0 ? (
            <section className="rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
              <h2 className="text-xl font-semibold text-slate-900">{t('trip.noParticipantsTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {t('trip.noParticipantsBody')}
              </p>
            </section>
          ) : (
            <UserPicker users={tripUsers} onSelect={handleUserSelect} />
          )}
        </div>
      ) : (
        <>
          <section className="mx-auto mt-7 flex max-w-3xl items-center gap-3 rounded-xl border border-slate-300 bg-white p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('trip.youAre')}</span>
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-3 py-1 text-sm text-slate-900">
              <strong>{selectedTripUser.name}</strong>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTripUserId(null)}
              className="ml-auto rounded-md border border-slate-400 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 transition duration-150 hover:bg-slate-100"
            >
              {t('trip.switchUser')}
            </button>
          </section>

          <div className="mx-auto mt-7 max-w-3xl">
            <AvailabilityCalendar
              selectedDates={selectedDates}
              groupedAvailability={groupedAvailability}
              totalUsers={tripUsers.length}
              onChange={handleDatesChange}
            />  
          </div>

          <section className="mx-auto mt-7 max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t('groupAvailability.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('groupAvailability.subtitle')}</p>
            <ul className="mt-4 space-y-3">
              {Object.entries(groupedAvailability).length === 0 && (
                <li className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  {t('groupAvailability.empty')}
                </li>
              )}
              {Object.entries(groupedAvailability).sort(byDateAscending).map(([dateKey, users]) => (
                <li
                  key={dateKey}
                  className={`rounded-xl border p-3 transition duration-200 ${
                    maxAvailabilityCount > 0 && users.length === maxAvailabilityCount
                      ? 'border-orange-500 bg-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-slate-900">{formatDate(dateKey, i18n.language)}</strong>
                    <div className="flex items-center gap-2">
                      {maxAvailabilityCount > 0 && users.length === maxAvailabilityCount && (
                        <span className="rounded-md border border-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                          {t('groupAvailability.topMatch')}
                        </span>
                      )}
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {t('groupAvailability.available', { count: users.length })}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {users.map((user) => (
                      <span
                        key={`${dateKey}-${user.userId}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {user.name}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <footer className="mx-auto mt-8 max-w-3xl pb-2 text-center text-xs text-slate-600">
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

export default TripPage
