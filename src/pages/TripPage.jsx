import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import brandIcon from '../assets/svgS.svg'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import UserPicker from '../components/UserPicker'
import { identifyAnalyticsUser, trackEvent } from '../lib/telemetry'
import {
  getTrip,
  getTripAvailability,
  getTripUsers,
  getUserAvailability,
  replaceAvailability,
} from '../lib/supabaseBackend'
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

function byPopularityThenDate([leftDate, leftUsers], [rightDate, rightUsers]) {
  const countDifference = rightUsers.length - leftUsers.length

  if (countDifference !== 0) {
    return countDifference
  }

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

function getIntervalFromEnv(value, fallbackMs) {
  const configured = Number(value)

  if (!Number.isFinite(configured)) {
    return fallbackMs
  }

  return Math.max(1000, Math.floor(configured))
}

const AVAILABILITY_SYNC_INTERVAL_MS = getIntervalFromEnv(
  import.meta.env.VITE_AVAILABILITY_SYNC_INTERVAL_MS,
  10000,
)

const AVAILABILITY_MIN_IDLE_MS = getIntervalFromEnv(
  import.meta.env.VITE_AVAILABILITY_MIN_IDLE_MS,
  1800,
)

const AVAILABILITY_POLL_INTERVAL_MS = getIntervalFromEnv(
  import.meta.env.VITE_AVAILABILITY_POLL_INTERVAL_MS,
  6000,
)

function normalizeDateKeys(dateKeys) {
  return [...new Set((dateKeys ?? []).map((dateKey) => String(dateKey)))].sort((left, right) =>
    left.localeCompare(right),
  )
}

function areDateKeysEqual(leftDateKeys, rightDateKeys) {
  const left = normalizeDateKeys(leftDateKeys)
  const right = normalizeDateKeys(rightDateKeys)

  if (left.length !== right.length) {
    return false
  }

  return left.every((dateKey, index) => dateKey === right[index])
}

function withUserAvailabilityRows(rows, user, tripId, selectedDates) {
  const safeRows = Array.isArray(rows) ? rows : []

  if (!user?.id) {
    return safeRows
  }

  const withoutUserRows = safeRows.filter((row) => row.user_id !== user.id)
  const nextRows = normalizeDateKeys(selectedDates).map((date) => ({
    id: `${user.id}-${date}`,
    trip_id: tripId,
    user_id: user.id,
    date,
    user_name: user.name,
    user_color: user.color,
  }))

  return [...withoutUserRows, ...nextRows]
}

function getMonthFromSearch(search) {
  const params = new URLSearchParams(search)
  const month = String(params.get('month') ?? '').trim()
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null
}

function TripPage({ tripId }) {
  const { t, i18n } = useTranslation()
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missingTrip, setMissingTrip] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [shareCardOpen, setShareCardOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showLessPopularDates, setShowLessPopularDates] = useState(false)
  const [viewer] = useState(() => getOrCreateAnonymousUser())
  const [tripUsers, setTripUsers] = useState([])
  const [selectedTripUserId, setSelectedTripUserId] = useState(() => getSelectedTripUser(tripId))
  const [selectedDates, setSelectedDates] = useState([])
  const [availabilityRows, setAvailabilityRows] = useState([])
  const pendingDatesRef = useRef([])
  const syncedDatesRef = useRef([])
  const isSyncingRef = useRef(false)
  const lastSelectionAtRef = useRef(0)

  const selectedTripUser = useMemo(() => {
    return tripUsers.find((user) => user.id === selectedTripUserId) ?? null
  }, [tripUsers, selectedTripUserId])

  const lockedMonth = getMonthFromSearch(window.location.search)
  const shareLink = useMemo(() => {
    const monthParam = lockedMonth ? `?month=${encodeURIComponent(lockedMonth)}` : ''
    return `${window.location.origin}/trip/${tripId}${monthParam}`
  }, [lockedMonth, tripId])

  const groupedAvailability = useMemo(() => {
    return groupAvailabilityByDate(availabilityRows)
  }, [availabilityRows])

  const maxAvailabilityCount = useMemo(() => {
    return Object.values(groupedAvailability).reduce((highest, users) => {
      return Math.max(highest, users.length)
    }, 0)
  }, [groupedAvailability])

  const sortedAvailabilityEntries = useMemo(() => {
    return Object.entries(groupedAvailability).sort(byPopularityThenDate)
  }, [groupedAvailability])

  const lessPopularDatesCount = useMemo(() => {
    if (maxAvailabilityCount <= 0) {
      return 0
    }

    return sortedAvailabilityEntries.filter(([, users]) => users.length < maxAvailabilityCount).length
  }, [maxAvailabilityCount, sortedAvailabilityEntries])

  const visibleAvailabilityEntries = useMemo(() => {
    if (showLessPopularDates || maxAvailabilityCount <= 0) {
      return sortedAvailabilityEntries
    }

    return sortedAvailabilityEntries.filter(([, users]) => users.length === maxAvailabilityCount)
  }, [maxAvailabilityCount, showLessPopularDates, sortedAvailabilityEntries])

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
    let cancelled = false

    async function loadTripState() {
      setLoading(true)
      setLoadError('')

      try {
        const foundTrip = await getTrip(tripId)

        if (!foundTrip) {
          if (!cancelled) {
            setMissingTrip(true)
            setTrip(null)
            setTripUsers([])
          }

          return
        }

        const users = await getTripUsers(tripId)

        if (cancelled) {
          return
        }

        setTrip(foundTrip)
        setTripUsers(users)
        setMissingTrip(false)

        if (!users.some((user) => user.id === selectedTripUserId)) {
          setSelectedTripUserId(null)
        }
      } catch (error) {
        console.error(error)

        if (!cancelled) {
          setLoadError('Unable to load trip right now. Please check Supabase configuration.')
          setTrip(null)
          setTripUsers([])
          setMissingTrip(false)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTripState()

    return () => {
      cancelled = true
    }
  }, [tripId, selectedTripUserId])

  useEffect(() => {
    if (!tripId || !selectedTripUserId) {
      return
    }

    let cancelled = false

    async function loadOwnDates() {
      try {
        const ownDates = await getUserAvailability(tripId, selectedTripUserId)

        if (!cancelled) {
          const normalizedDates = normalizeDateKeys(ownDates)

          setSelectedDates(normalizedDates)
          pendingDatesRef.current = normalizedDates
          syncedDatesRef.current = normalizedDates
        }
      } catch (error) {
        console.error(error)
      }
    }

    loadOwnDates()

    return () => {
      cancelled = true
    }
  }, [tripId, selectedTripUserId])

  useEffect(() => {
    if (!tripId) {
      return
    }

    let cancelled = false

    async function readSharedState() {
      try {
        let rows = await getTripAvailability(tripId)

        if (selectedTripUser) {
          const hasPendingChanges = !areDateKeysEqual(pendingDatesRef.current, syncedDatesRef.current)

          if (hasPendingChanges) {
            rows = withUserAvailabilityRows(rows, selectedTripUser, tripId, pendingDatesRef.current)
          }
        }

        if (!cancelled) {
          setAvailabilityRows(rows)
        }
      } catch (error) {
        console.error(error)
      }
    }

    readSharedState()
    const intervalId = window.setInterval(readSharedState, AVAILABILITY_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [tripId, selectedTripUser])

  useEffect(() => {
    if (!tripId || !selectedTripUser) {
      return
    }

    let cancelled = false

    async function flushPendingAvailability() {
      if (isSyncingRef.current) {
        return
      }

      const elapsedSinceLastSelection = Date.now() - lastSelectionAtRef.current

      if (elapsedSinceLastSelection < AVAILABILITY_MIN_IDLE_MS) {
        return
      }

      const pendingDates = normalizeDateKeys(pendingDatesRef.current)
      const syncedDates = normalizeDateKeys(syncedDatesRef.current)

      if (areDateKeysEqual(pendingDates, syncedDates)) {
        return
      }

      isSyncingRef.current = true

      try {
        await replaceAvailability(tripId, selectedTripUser.id, pendingDates)

        if (cancelled) {
          return
        }

        syncedDatesRef.current = pendingDates
        const rows = await getTripAvailability(tripId)

        if (!cancelled) {
          setAvailabilityRows(rows)
        }
      } catch (error) {
        console.error(error)
      } finally {
        isSyncingRef.current = false
      }
    }

    const intervalId = window.setInterval(flushPendingAvailability, AVAILABILITY_SYNC_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [tripId, selectedTripUser])

  async function handleUserSelect(userId) {
    if (selectedTripUser && !areDateKeysEqual(pendingDatesRef.current, syncedDatesRef.current)) {
      try {
        const pendingDates = normalizeDateKeys(pendingDatesRef.current)
        await replaceAvailability(tripId, selectedTripUser.id, pendingDates)
        syncedDatesRef.current = pendingDates
      } catch (error) {
        console.error(error)
      }
    }

    setSelectedTripUserId(userId)
    saveSelectedTripUser(tripId, userId)
    trackEvent('trip_user_selected', {
      trip_id: tripId,
    })
  }

  async function handleClearSelectedUser() {
    if (selectedTripUser && !areDateKeysEqual(pendingDatesRef.current, syncedDatesRef.current)) {
      try {
        const pendingDates = normalizeDateKeys(pendingDatesRef.current)
        await replaceAvailability(tripId, selectedTripUser.id, pendingDates)
        syncedDatesRef.current = pendingDates
      } catch (error) {
        console.error(error)
      }
    }

    setSelectedTripUserId(null)
  }

  function handleDatesChange(nextDates) {
    if (!selectedTripUserId) {
      return
    }

    const normalizedDates = normalizeDateKeys(nextDates)
    const previousCount = selectedDates.length
    const nextCount = normalizedDates.length

    setSelectedDates(normalizedDates)
    pendingDatesRef.current = normalizedDates
    lastSelectionAtRef.current = Date.now()

    if (selectedTripUser) {
      setAvailabilityRows((currentRows) =>
        withUserAvailabilityRows(currentRows, selectedTripUser, tripId, normalizedDates),
      )
    }

    trackEvent('availability_updated', {
      trip_id: tripId,
      selected_count: nextCount,
      delta: nextCount - previousCount,
    })
  }

  async function handleCopyLink() {
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
    if (loadError) {
      return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-rose-300 bg-white p-7">
            <h1 className="text-2xl font-bold text-slate-900">Connection error</h1>
            <p className="mt-2 text-sm text-slate-600">{loadError}</p>
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
        <a href="/" className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <img src={brandIcon} alt="" className="h-8 w-8 rounded-lg border border-slate-400 bg-white object-contain" />
          <span className="truncate">{t('brand.name')}</span>
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
                value={shareLink}
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
              onClick={handleClearSelectedUser}
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
              lockedMonth={lockedMonth}
              onChange={handleDatesChange}
            />  
          </div>

          <section className="mx-auto mt-7 max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t('groupAvailability.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('groupAvailability.subtitle')}</p>

            {lessPopularDatesCount > 0 && (
              <button
                type="button"
                onClick={() => setShowLessPopularDates((current) => !current)}
                className="mt-4 rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition duration-150 hover:bg-slate-100"
              >
                {showLessPopularDates
                  ? 'Hide less popular dates'
                  : `Show ${lessPopularDatesCount} less popular date${lessPopularDatesCount === 1 ? '' : 's'}`}
              </button>
            )}

            <ul className="mt-4 space-y-3">
              {sortedAvailabilityEntries.length === 0 && (
                <li className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  {t('groupAvailability.empty')}
                </li>
              )}
              {visibleAvailabilityEntries.map(([dateKey, users]) => (
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
