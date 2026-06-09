import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppFooter from '../components/AppFooter'
import AppHeader from '../components/AppHeader'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import GroupAvailabilityList from '../components/GroupAvailabilityList'
import ShareCard from '../components/ShareCard'
import TripLoadingSkeleton from '../components/TripLoadingSkeleton'
import UserPicker from '../components/UserPicker'
import { identifyAnalyticsUser, trackEvent } from '../lib/telemetry'
import {
  closeTrip,
  confirmReady,
  getTrip,
  getTripAvailability,
  getTripUsers,
  getUserAvailability,
  issueTripShareToken,
  replaceAvailability,
} from '../lib/supabaseBackend'
import {
  getOrCreateAnonymousUser,
  getSelectedTripUser,
  saveSelectedTripUser,
} from '../lib/userIdentity'
import {
  buildTripSharePath,
  getTripMonthLock,
  getTripPathById,
  getTripPlanPath,
  saveRecentTrip,
} from '../lib/tripLink'

function formatDateRange(sortedDates) {
  if (!sortedDates.length) return ''
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
  const from = parse(sortedDates[0])
  const to = parse(sortedDates[sortedDates.length - 1])
  if (sortedDates.length === 1)
    return from.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()
  if (sameMonth)
    return `${from.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}–${to.getDate()}, ${to.getFullYear()}`
  return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

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
  return [...new Set((dateKeys ?? []).map((dateKey) => String(dateKey)))].sort(
    (left, right) => left.localeCompare(right),
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
  const { t } = useTranslation()
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [missingTrip, setMissingTrip] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [viewer] = useState(() => getOrCreateAnonymousUser())
  const [tripUsers, setTripUsers] = useState([])
  const [selectedTripUserId, setSelectedTripUserId] = useState(() => getSelectedTripUser(tripId))
  const [selectedDates, setSelectedDates] = useState([])
  const [availabilityRows, setAvailabilityRows] = useState([])
  const [shareLink, setShareLink] = useState(
    () => `${window.location.origin}${getTripPathById(tripId)}`,
  )
  const [isConfirmingReady, setIsConfirmingReady] = useState(false)
  const [isClosingTrip, setIsClosingTrip] = useState(false)
  const [showCloseOverlay, setShowCloseOverlay] = useState(false)
  const [overlayReady, setOverlayReady] = useState(false)
  const pendingDatesRef = useRef([])
  const syncedDatesRef = useRef([])
  const isSyncingRef = useRef(false)
  const lastSelectionAtRef = useRef(0)

  const selectedTripUser = useMemo(() => {
    return tripUsers.find((user) => user.id === selectedTripUserId) ?? null
  }, [tripUsers, selectedTripUserId])

  const confirmedCount = useMemo(() => {
    return tripUsers.filter((u) => u.confirmedAt).length
  }, [tripUsers])

  const groupedAvailability = useMemo(() => {
    return groupAvailabilityByDate(availabilityRows)
  }, [availabilityRows])

  const scheduleDates = useMemo(
    () => Object.keys(groupedAvailability).sort(),
    [groupedAvailability],
  )

  const lockedMonth = getMonthFromSearch(window.location.search) ?? getTripMonthLock(tripId)

  useEffect(() => {
    identifyAnalyticsUser(viewer.id)
  }, [viewer.id])

  useEffect(() => {
    if (!showCloseOverlay) { setOverlayReady(false); return }
    const raf = requestAnimationFrame(() => setOverlayReady(true))
    return () => cancelAnimationFrame(raf)
  }, [showCloseOverlay])

  useEffect(() => {
    if (!trip) return

    saveRecentTrip({
      id: trip.id,
      name: trip.name,
      path: getTripPathById(trip.id),
    })

    trackEvent('trip_viewed', {
      trip_id: trip.id,
      participant_count: tripUsers.length,
    })
  }, [trip, tripUsers.length])

  useEffect(() => {
    let cancelled = false

    async function refreshShareLink() {
      try {
        const accessToken = await issueTripShareToken(tripId)

        if (!cancelled && accessToken) {
          setShareLink(`${window.location.origin}${buildTripSharePath(tripId, accessToken)}`)
        }
      } catch {
        if (!cancelled) {
          setShareLink(`${window.location.origin}${getTripPathById(tripId)}`)
        }
      }
    }

    refreshShareLink()

    return () => {
      cancelled = true
    }
  }, [tripId])

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

        if (cancelled) return

        setTrip(foundTrip)
        setTripUsers(users)
        setMissingTrip(false)
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
  }, [tripId])

  // Reset selected user if they're no longer in the trip's participant list.
  useEffect(() => {
    if (selectedTripUserId && tripUsers.length > 0 && !tripUsers.some((u) => u.id === selectedTripUserId)) {
      setSelectedTripUserId(null)
    }
  }, [tripUsers, selectedTripUserId])

  useEffect(() => {
    if (!tripId || !selectedTripUserId) return

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
    if (!tripId) return

    let cancelled = false

    async function readSharedState() {
      try {
        let rows = await getTripAvailability(tripId)

        if (selectedTripUser) {
          const hasPendingChanges = !areDateKeysEqual(
            pendingDatesRef.current,
            syncedDatesRef.current,
          )

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
    if (!tripId || !selectedTripUser) return

    let cancelled = false

    async function flushPendingAvailability() {
      if (isSyncingRef.current) return

      const elapsedSinceLastSelection = Date.now() - lastSelectionAtRef.current

      if (elapsedSinceLastSelection < AVAILABILITY_MIN_IDLE_MS) return

      const pendingDates = normalizeDateKeys(pendingDatesRef.current)
      const syncedDates = normalizeDateKeys(syncedDatesRef.current)

      if (areDateKeysEqual(pendingDates, syncedDates)) return

      isSyncingRef.current = true

      try {
        await replaceAvailability(tripId, selectedTripUser.id, pendingDates)

        if (cancelled) return

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

  async function flushAndSetUser(userId) {
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
  }

  async function handleUserSelect(userId) {
    await flushAndSetUser(userId)
    trackEvent('trip_user_selected', { trip_id: tripId })
  }

  async function handleClearSelectedUser() {
    await flushAndSetUser(null)
  }

  async function handleConfirmReady() {
    if (!selectedTripUser || isConfirmingReady) return

    try {
      setIsConfirmingReady(true)
      await confirmReady(tripId, selectedTripUser.id)
      setTripUsers((users) =>
        users.map((u) =>
          u.id === selectedTripUser.id ? { ...u, confirmedAt: new Date().toISOString() } : u,
        ),
      )
      trackEvent('user_confirmed_ready', { trip_id: tripId })
    } catch (error) {
      console.error(error)
    } finally {
      setIsConfirmingReady(false)
    }
  }

  async function handleCloseTrip() {
    if (isClosingTrip) return

    try {
      setIsClosingTrip(true)
      if (selectedTripUser && !areDateKeysEqual(pendingDatesRef.current, syncedDatesRef.current)) {
        const pendingDates = normalizeDateKeys(pendingDatesRef.current)
        await replaceAvailability(tripId, selectedTripUser.id, pendingDates)
        syncedDatesRef.current = pendingDates
      }
      await closeTrip(tripId)
      setTrip((current) => ({ ...current, closedAt: new Date().toISOString() }))
      setShowCloseOverlay(true)
      trackEvent('trip_closed', { trip_id: tripId })
    } catch (error) {
      console.error(error)
    } finally {
      setIsClosingTrip(false)
    }
  }

  function handleDatesChange(nextDates) {
    if (!selectedTripUserId) return

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

  if (loading) {
    return <TripLoadingSkeleton />
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
      <AppHeader tripName={trip.name} wide>
        {trip?.closedAt ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {t('badge.tripClosed')}
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" aria-hidden="true" />
            {t('badge.liveTrip')}
          </span>
        )}
      </AppHeader>

      <ShareCard tripId={tripId} tripName={trip.name} shareLink={shareLink} />

      {tripUsers.length > 0 && (
        trip.closedAt ? (
          <section className="mx-auto mt-3 max-w-3xl overflow-hidden rounded-xl border-2 border-emerald-200 bg-emerald-50">
            <div className="flex items-start justify-between gap-4 px-6 py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 text-lg leading-none">✓</span>
                  <span className="font-bold text-emerald-800">{t('trip.closedBanner')}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {t('trip.readyCount', { confirmed: confirmedCount, total: tripUsers.length })}
                </p>
                <p className="mt-2 text-sm text-slate-600">{t('trip.closedHint')}</p>
              </div>
              <a
                href={getTripPlanPath(tripId)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
              >
                {t('trip.planTrip')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </section>
        ) : (
          <section className="mx-auto mt-3 max-w-3xl flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5">
            <span className="text-sm text-slate-600">
              {t('trip.readyCount', { confirmed: confirmedCount, total: tripUsers.length })}
            </span>
            <button
              type="button"
              onClick={handleCloseTrip}
              disabled={isClosingTrip}
              className="rounded-md border border-slate-400 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 transition duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClosingTrip ? t('trip.closingTrip') : t('trip.closeTrip')}
            </button>
          </section>
        )
      )}

      {!selectedTripUser ? (
        <div className="mx-auto mt-5 max-w-3xl">
          {tripUsers.length === 0 ? (
            <section className="rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
              <h2 className="text-xl font-semibold text-slate-900">{t('trip.noParticipantsTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600">{t('trip.noParticipantsBody')}</p>
            </section>
          ) : (
            <UserPicker users={tripUsers} onSelect={handleUserSelect} />
          )}
        </div>
      ) : (
        <>
          <section className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-slate-300 bg-white p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('trip.youAre')}
            </span>
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-3 py-1 text-sm text-slate-900">
              <strong>{selectedTripUser.name}</strong>
            </div>

            {selectedTripUser.confirmedAt ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                ✓ {t('trip.ready')}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConfirmReady}
                disabled={isConfirmingReady}
                className="rounded-md border border-emerald-500 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition duration-150 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirmingReady ? t('trip.confirming') : t('trip.markReady')}
              </button>
            )}

            <button
              type="button"
              onClick={handleClearSelectedUser}
              className="ml-auto rounded-md border border-slate-400 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 transition duration-150 hover:bg-slate-100"
            >
              {t('trip.switchUser')}
            </button>
          </section>

          <div className="mx-auto mt-5 max-w-3xl">
            <AvailabilityCalendar
              selectedDates={selectedDates}
              groupedAvailability={groupedAvailability}
              totalUsers={tripUsers.length}
              lockedMonth={lockedMonth}
              onChange={handleDatesChange}
              readOnly={Boolean(trip.closedAt)}
            />
          </div>

          <GroupAvailabilityList availabilityRows={availabilityRows} totalUsers={tripUsers.length} />
        </>
      )}

      <AppFooter />

      {showCloseOverlay && (
        <div
          onClick={() => setShowCloseOverlay(false)}
          className={`fixed inset-0 z-50 flex items-center justify-center p-6 transition-all duration-500 ${overlayReady ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'rgba(2,6,23,0.82)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-500 ${overlayReady ? 'scale-100 translate-y-0' : 'scale-95 translate-y-6'}`}
          >
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="px-8 pb-8 pt-7 text-center">
              <div className="relative mx-auto mb-5 h-20 w-20">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-20" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-900">{t('trip.closedOverlayTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">{trip?.name}</p>

              {scheduleDates.length > 0 && (
                <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3.5">
                  <p className="font-semibold text-slate-800">{formatDateRange(scheduleDates)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('trip.closedOverlayParticipants', { count: tripUsers.length })}
                  </p>
                </div>
              )}

              <a
                href={getTripPlanPath(tripId)}
                className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
              >
                {t('trip.planTrip')}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>

              <button
                type="button"
                onClick={() => setShowCloseOverlay(false)}
                className="mt-3 text-xs text-slate-400 transition-colors hover:text-slate-600"
              >
                {t('trip.closedOverlayDismiss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TripPage
