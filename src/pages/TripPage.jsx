import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import brandIcon from '../assets/svgS.svg'
import AppFooter from '../components/AppFooter'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import GroupAvailabilityList from '../components/GroupAvailabilityList'
import ShareCard from '../components/ShareCard'
import TripLoadingSkeleton from '../components/TripLoadingSkeleton'
import UserPicker from '../components/UserPicker'
import { identifyAnalyticsUser, trackEvent } from '../lib/telemetry'
import {
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
  saveRecentTrip,
} from '../lib/tripLink'

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
  const pendingDatesRef = useRef([])
  const syncedDatesRef = useRef([])
  const isSyncingRef = useRef(false)
  const lastSelectionAtRef = useRef(0)

  const selectedTripUser = useMemo(() => {
    return tripUsers.find((user) => user.id === selectedTripUserId) ?? null
  }, [tripUsers, selectedTripUserId])

  const lockedMonth = getMonthFromSearch(window.location.search) ?? getTripMonthLock(tripId)

  const groupedAvailability = useMemo(() => {
    return groupAvailabilityByDate(availabilityRows)
  }, [availabilityRows])

  useEffect(() => {
    identifyAnalyticsUser(viewer.id)
  }, [viewer.id])

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
      <header className="mx-auto mb-8 flex w-full max-w-3xl items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 transition-colors duration-150">
        <a
          href="/"
          className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-slate-900"
        >
          <img src={brandIcon} alt="" className="h-8 w-8 rounded-lg border border-slate-400 bg-white object-contain" />
          <span className="truncate">{t('brand.name')}</span>
        </a>
        <span className="rounded-md bg-orange-500 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          {t('badge.liveTrip')}
        </span>
      </header>

      <ShareCard tripId={tripId} tripName={trip.name} shareLink={shareLink} />

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
          <section className="mx-auto mt-5 flex max-w-3xl items-center gap-3 rounded-xl border border-slate-300 bg-white p-4">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('trip.youAre')}
            </span>
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

          <div className="mx-auto mt-5 max-w-3xl">
            <AvailabilityCalendar
              selectedDates={selectedDates}
              groupedAvailability={groupedAvailability}
              totalUsers={tripUsers.length}
              lockedMonth={lockedMonth}
              onChange={handleDatesChange}
            />
          </div>

          <GroupAvailabilityList availabilityRows={availabilityRows} totalUsers={tripUsers.length} />
        </>
      )}

      <AppFooter />
    </main>
  )
}

export default TripPage
