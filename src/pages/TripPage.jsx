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
import { getTripEmoji } from '../lib/tripEmoji'

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
  const [confirmingEditDates, setConfirmingEditDates] = useState(false)
  const [closeFlowPhase, setCloseFlowPhase] = useState(null) // null | 'confirm' | 'success'
  const [closeFlowAnimReady, setCloseFlowAnimReady] = useState(false)
  const [closeFlowContentVisible, setCloseFlowContentVisible] = useState(true)
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
    if (closeFlowPhase === null) { setCloseFlowAnimReady(false); return }
    if (closeFlowPhase === 'confirm') {
      const raf = requestAnimationFrame(() => setCloseFlowAnimReady(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [closeFlowPhase])

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

  function handleClearDays() {
    if (!selectedTripUser) return
    setSelectedDates([])
    pendingDatesRef.current = []
    lastSelectionAtRef.current = Date.now()
    setAvailabilityRows((currentRows) =>
      withUserAvailabilityRows(currentRows, selectedTripUser, tripId, []),
    )
  }

  function handleEditDates() {
    setConfirmingEditDates(true)
  }

  function handleConfirmEditDates() {
    if (!selectedTripUser) return
    setTripUsers((users) =>
      users.map((u) => (u.id === selectedTripUser.id ? { ...u, confirmedAt: null } : u)),
    )
    setConfirmingEditDates(false)
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

  function dismissCloseModal() {
    setCloseFlowAnimReady(false)
    window.setTimeout(() => {
      setCloseFlowPhase(null)
      setCloseFlowContentVisible(true)
    }, 500)
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
      setCloseFlowContentVisible(false)
      window.setTimeout(() => {
        setCloseFlowPhase('success')
        setCloseFlowContentVisible(true)
      }, 220)
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
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-7 shadow-md shadow-slate-200/70 dark:shadow-none">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Connection error</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{loadError}</p>
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
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-7 shadow-md shadow-slate-200/70 dark:shadow-none">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('trip.notFoundTitle')}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('trip.notFoundBody')}</p>
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
    <main className={`min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 sm:py-10${!trip.closedAt && selectedTripUser ? ' pb-32' : ''}`}>
      <AppHeader tripName={trip.name}>
        {trip?.closedAt ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            {t('badge.tripClosed')}
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/50 px-2.5 py-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" aria-hidden="true" />
            {t('badge.liveTrip')}
          </span>
        )}
      </AppHeader>

      <ShareCard tripId={tripId} tripName={trip.name} shareLink={shareLink} />

      {tripUsers.length > 0 && (
        trip.closedAt ? (
          <section className="mx-auto mt-3 max-w-3xl overflow-hidden rounded-xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30">
            <div className="flex items-start justify-between gap-4 px-6 py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 text-lg leading-none">✓</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">{t('trip.closedBanner')}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t('trip.readyCount', { confirmed: confirmedCount, total: tripUsers.length })}
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('trip.closedHint')}</p>
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
        ) : null
      )}

      {!selectedTripUser ? (
        <div className="mx-auto mt-5 max-w-3xl">
          {tripUsers.length === 0 ? (
            <section className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-7">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('trip.noParticipantsTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('trip.noParticipantsBody')}</p>
            </section>
          ) : (
            <UserPicker users={tripUsers} onSelect={handleUserSelect} />
          )}
        </div>
      ) : (
        <>
          <GroupAvailabilityList availabilityRows={availabilityRows} totalUsers={tripUsers.length} />

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

        </>
      )}

      <AppFooter />

      {!trip.closedAt && selectedTripUser && (
        <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-5 pt-2">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-slate-900/15 dark:shadow-slate-900/60">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={handleClearSelectedUser}
                aria-label={t('trip.switchUser')}
                title={t('trip.switchUser')}
                className="shrink-0 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 text-slate-500 dark:text-slate-400 transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
              <span className="flex-1 text-xs text-slate-500 dark:text-slate-400">
                {t('trip.readyCount', { confirmed: confirmedCount, total: tripUsers.length })}
              </span>
              <div className="flex items-center gap-2">
                {confirmingEditDates ? (
                  <>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('trip.editDatesConfirm')}</span>
                    <button
                      type="button"
                      onClick={handleConfirmEditDates}
                      className="cursor-pointer rounded-lg bg-slate-800 dark:bg-slate-200 px-3 py-2 text-xs font-semibold text-white dark:text-slate-900 transition duration-150 hover:bg-slate-700 dark:hover:bg-slate-300 active:scale-[0.99]"
                    >
                      {t('trip.editDatesConfirmAction')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingEditDates(false)}
                      className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      {t('trip.confirmCloseCancel')}
                    </button>
                  </>
                ) : selectedTripUser.confirmedAt ? (
                  <>
                    <button
                      type="button"
                      onClick={handleEditDates}
                      className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      {t('trip.editDates')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCloseFlowPhase('confirm'); setCloseFlowContentVisible(true) }}
                      disabled={isClosingTrip}
                      className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-200 dark:shadow-none transition duration-150 hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('trip.closeTrip')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleClearDays}
                      className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      {t('trip.clearMyDays')}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReady}
                      disabled={isConfirmingReady}
                      className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-200 dark:shadow-none transition duration-150 hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isConfirmingReady ? t('trip.confirming') : t('trip.markReady')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {closeFlowPhase !== null && (
        <div
          onClick={closeFlowPhase === 'confirm' ? dismissCloseModal : undefined}
          className={`fixed inset-0 z-50 flex items-center justify-center p-6 transition-all duration-500 ${closeFlowAnimReady ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'rgba(2,6,23,0.82)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl transition-all duration-500 ${closeFlowAnimReady ? 'scale-100 translate-y-0' : 'scale-95 translate-y-6'}`}
          >
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className={`transition-opacity duration-200 ${closeFlowContentVisible ? 'opacity-100' : 'opacity-0'}`}>
              {closeFlowPhase === 'confirm' ? (
                <div className="px-8 pb-8 pt-7 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t('trip.confirmCloseTitle')}</p>
                  <p className="mt-2 truncate text-2xl font-extrabold text-slate-900 dark:text-white">
                    {(() => { const em = getTripEmoji(trip?.name); return em ? <span className="mr-2">{em}</span> : null })()}
                    {trip?.name}
                  </p>
                  <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {t('trip.readyCount', { confirmed: confirmedCount, total: tripUsers.length })}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('trip.confirmCloseBody')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseTrip}
                    disabled={isClosingTrip}
                    className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isClosingTrip ? t('trip.closingTrip') : t('trip.confirmCloseAction')}
                    {!isClosingTrip && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={dismissCloseModal}
                    className="mt-3 cursor-pointer text-xs text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {t('trip.confirmCloseCancel')}
                  </button>
                </div>
              ) : (
                <div className="px-8 pb-8 pt-7 text-center">
                  <div className="relative mx-auto mb-5 h-20 w-20">
                    <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-20" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t('trip.closedOverlayTitle')}</p>
                  <p className="mt-2 truncate text-2xl font-extrabold text-slate-900 dark:text-white">
                    {(() => { const em = getTripEmoji(trip?.name); return em ? <span className="mr-2">{em}</span> : null })()}
                    {trip?.name}
                  </p>
                  {scheduleDates.length > 0 && (
                    <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDateRange(scheduleDates)}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
                    onClick={dismissCloseModal}
                    className="mt-3 cursor-pointer text-xs text-slate-400 dark:text-slate-500 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {t('trip.closedOverlayDismiss')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TripPage



