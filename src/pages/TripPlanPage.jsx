import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppFooter from '../components/AppFooter'
import AppHeader from '../components/AppHeader'
import FlightSearch from '../components/FlightSearch'
import TripLoadingSkeleton from '../components/TripLoadingSkeleton'
import TripSchedule from '../components/TripSchedule'
import {
  addTripActivity,
  getTrip,
  getTripActivities,
  getTripAvailability,
  getTripUsers,
  removeTripActivity,
} from '../lib/supabaseBackend'
import { getTripPathById } from '../lib/tripLink'
import { getSelectedTripUser } from '../lib/userIdentity'

const TABS = ['hotels', 'flights', 'agenda']

function groupAvailabilityByDate(rows) {
  return rows.reduce((acc, row) => {
    if (!acc[row.date]) acc[row.date] = []
    acc[row.date].push({ userId: row.user_id, name: row.user_name })
    return acc
  }, {})
}

function formatDateRange(sortedDates) {
  if (sortedDates.length === 0) return ''
  const parseKey = (key) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const from = parseKey(sortedDates[0])
  const to = parseKey(sortedDates[sortedDates.length - 1])
  if (sortedDates.length === 1) {
    return from.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
  const sameYear = from.getFullYear() === to.getFullYear()
  const sameMonth = sameYear && from.getMonth() === to.getMonth()
  if (sameMonth) {
    return `${from.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}–${to.getDate()}, ${to.getFullYear()}`
  }
  return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function buildBookingUrl({ city, checkin, checkout, guests }) {
  const params = new URLSearchParams()
  if (city) params.set('ss', city)
  if (checkin) params.set('checkin', checkin)
  if (checkout) params.set('checkout', checkout)
  params.set('group_adults', String(Math.max(1, guests)))
  return `https://www.booking.com/searchresults.html?${params}`
}

function HotelSearch({ scheduleDates, participantCount, t }) {
  const earliest = scheduleDates[0] ?? ''
  const latest = scheduleDates[scheduleDates.length - 1] ?? ''
  const [city, setCity] = useState('')
  const [checkin, setCheckin] = useState(earliest)
  const [checkout, setCheckout] = useState(latest !== earliest ? latest : '')
  const [guests, setGuests] = useState(Math.max(1, participantCount ?? 1))

  const datesSeededRef = useRef(Boolean(earliest))
  const guestsSeededRef = useRef(participantCount > 0)

  useEffect(() => {
    if (!datesSeededRef.current && earliest) {
      datesSeededRef.current = true
      setCheckin(earliest)
      if (latest && latest !== earliest) setCheckout(latest)
    }
  }, [earliest, latest])

  useEffect(() => {
    if (!guestsSeededRef.current && participantCount > 0) {
      guestsSeededRef.current = true
      setGuests(participantCount)
    }
  }, [participantCount])

  function handleSearch(e) {
    e.preventDefault()
    const url = buildBookingUrl({ city, checkin, checkout, guests })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function adjustGuests(delta) {
    setGuests((n) => Math.max(1, Math.min(30, n + delta)))
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">{t('hotels.title')}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{t('hotels.subtitle')}</p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Booking.com
          </span>
        </div>
      </div>
      <form onSubmit={handleSearch} className="p-6 space-y-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('hotels.destination')}
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t('hotels.destinationPlaceholder')}
            className="h-12 rounded-lg border-2 border-slate-200 bg-white px-4 text-base font-medium text-slate-900 placeholder-slate-300 outline-none transition-colors focus:border-orange-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('hotels.checkin')}
            </label>
            <input
              type="date"
              value={checkin}
              onChange={(e) => setCheckin(e.target.value)}
              className="h-12 rounded-lg border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-orange-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('hotels.checkout')}
            </label>
            <input
              type="date"
              value={checkout}
              min={checkin}
              onChange={(e) => setCheckout(e.target.value)}
              className="h-12 rounded-lg border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-orange-400"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('hotels.guests')}
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustGuests(-1)}
              disabled={guests <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-lg font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center text-base font-semibold text-slate-900 tabular-nums">
              {guests}
            </span>
            <button
              type="button"
              onClick={() => adjustGuests(1)}
              disabled={guests >= 30}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-lg font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
            <span className="text-sm text-slate-500">
              {t('hotels.guestsLabel', { count: guests })}
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-orange-600 active:scale-[0.99]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {t('hotels.searchButton')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </button>
        <p className="text-center text-xs text-slate-400">{t('hotels.disclaimer')}</p>
      </form>
    </div>
  )
}

function TripPlanPage({ tripId }) {
  const { t } = useTranslation()
  const [trip, setTrip] = useState(null)
  const [tripUsers, setTripUsers] = useState([])
  const [availabilityRows, setAvailabilityRows] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('hotels')
  const [slideDir, setSlideDir] = useState('right')

  const selectedTripUser = useMemo(() => {
    const savedId = getSelectedTripUser(tripId)
    return tripUsers.find((u) => u.id === savedId) ?? null
  }, [tripUsers, tripId])

  const groupedAvailability = useMemo(
    () => groupAvailabilityByDate(availabilityRows),
    [availabilityRows],
  )
  const scheduleDates = useMemo(
    () => Object.keys(groupedAvailability).sort(),
    [groupedAvailability],
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [tripResult, usersResult, availResult] = await Promise.allSettled([
        getTrip(tripId),
        getTripUsers(tripId),
        getTripAvailability(tripId),
      ])
      if (cancelled) return
      if (tripResult.status === 'fulfilled') setTrip(tripResult.value)
      else console.error('[TripPlanPage] getTrip failed:', tripResult.reason)
      if (usersResult.status === 'fulfilled') setTripUsers(usersResult.value)
      else console.error('[TripPlanPage] getTripUsers failed:', usersResult.reason)
      if (availResult.status === 'fulfilled') setAvailabilityRows(availResult.value)
      else console.error('[TripPlanPage] getTripAvailability failed:', availResult.reason)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [tripId])

  useEffect(() => {
    let cancelled = false

    async function loadActivities() {
      try {
        const data = await getTripActivities(tripId)
        if (!cancelled) setActivities(data)
      } catch (error) {
        console.error(error)
      }
    }

    loadActivities()
    const intervalId = window.setInterval(loadActivities, 15000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [tripId])

  function handleTabChange(tab) {
    if (tab === activeTab) return
    setSlideDir(TABS.indexOf(tab) > TABS.indexOf(activeTab) ? 'right' : 'left')
    setActiveTab(tab)
  }

  async function handleAddActivity(date, hour, title) {
    const tempId = `temp-${Date.now()}`
    setActivities((prev) => [
      ...prev,
      { id: tempId, date, hour, title, createdBy: selectedTripUser?.id ?? null, createdAt: new Date().toISOString() },
    ])
    try {
      const realId = await addTripActivity(tripId, {
        date, hour, title, userId: selectedTripUser?.id ?? null,
      })
      setActivities((prev) => prev.map((a) => (a.id === tempId ? { ...a, id: realId } : a)))
    } catch (error) {
      console.error(error)
      setActivities((prev) => prev.filter((a) => a.id !== tempId))
    }
  }

  async function handleRemoveActivity(activityId) {
    setActivities((prev) => prev.filter((a) => a.id !== activityId))
    try {
      await removeTripActivity(tripId, activityId)
    } catch (error) {
      console.error(error)
    }
  }

  if (loading) return <TripLoadingSkeleton />

  const tripDatesPath = getTripPathById(tripId)
  const dateRange = formatDateRange(scheduleDates)
  const confirmedCount = tripUsers.filter((u) => u.confirmedAt).length

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <style>{`
        @keyframes tab-enter-right { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tab-enter-left  { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
        .tab-enter-right { animation: tab-enter-right 180ms ease-out both; }
        .tab-enter-left  { animation: tab-enter-left  180ms ease-out both; }
      `}</style>

      <AppHeader tripName={trip?.name} wide>
        <a
          href={tripDatesPath}
          className="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t('plan.backToDates')}
        </a>
      </AppHeader>

      {/* Trip summary card */}
      <section className="mx-auto mb-6 max-w-3xl">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                {t('plan.eyebrow')}
              </span>
              <h1 className="mt-1 truncate text-2xl font-bold text-slate-900">{trip?.name}</h1>
              {dateRange && (
                <p className="mt-1 text-sm text-slate-600">
                  {dateRange}
                  {tripUsers.length > 0 && (
                    <span className="before:mx-2 before:content-['·']">
                      {t('plan.confirmedCount', { confirmed: confirmedCount, total: tripUsers.length })}
                    </span>
                  )}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              {t('badge.tripClosed')}
            </span>
          </div>
        </div>
      </section>

      {/* Tab bar */}
      <div className="mx-auto mb-5 max-w-3xl">
        <nav className="relative flex rounded-lg border border-slate-300 bg-white p-1">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-1 left-1 rounded-md bg-slate-900 transition-transform duration-200 ease-out ${
              activeTab === 'flights' ? 'translate-x-0' :
              activeTab === 'hotels'  ? 'translate-x-full' :
              'translate-x-[200%]'
            }`}
            style={{ width: 'calc((100% - 8px) / 3)' }}
          />
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold transition-colors duration-150 ${
                activeTab === tab ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{t(`plan.tab.${tab}.icon`)}</span>
              <span>{t(`plan.tab.${tab}.label`)}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-3xl">
        <div key={activeTab} className={`tab-enter-${slideDir}`}>
          {activeTab === 'flights' && (
            <FlightSearch scheduleDates={scheduleDates} participantCount={tripUsers.length} />
          )}
          {activeTab === 'hotels' && (
            <HotelSearch scheduleDates={scheduleDates} participantCount={tripUsers.length} t={t} />
          )}
          {activeTab === 'agenda' && (
            <TripSchedule
              scheduleDates={scheduleDates}
              activities={activities}
              onAdd={handleAddActivity}
              onRemove={handleRemoveActivity}
            />
          )}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}

export default TripPlanPage
