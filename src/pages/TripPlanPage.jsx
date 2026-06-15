import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { inputCls, inputSmCls } from '../lib/tokens'
import { useNavigate } from '../lib/navigation'

const iconStyle = { display: 'inline', verticalAlign: '-0.125em' }
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={iconStyle}>
      <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={iconStyle}>
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  )
}

import AppFooter from '../components/AppFooter'
import AppHeader from '../components/AppHeader'
import GroupAvailabilityList from '../components/GroupAvailabilityList'
import TripLoadingSkeleton from '../components/TripLoadingSkeleton'
import {
  getTrip,
  getTripAvailability,
  getTripUsers,
} from '../lib/supabaseBackend'
import { getTripEmoji } from '../lib/tripEmoji'
import { getTripPathById } from '../lib/tripLink'
import { trackEvent } from '../lib/telemetry'

const TABS = ['hotels', 'activities']

const TAB_ICONS = {
  hotels: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 11V3H7v4H3v14h8v-4h2v4h8V11h-4zM7 19H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5v-2h2v2zm4 4H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z" />
    </svg>
  ),
  activities: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" />
    </svg>
  ),
}

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
  const isConsecutive = (a, b) => {
    const d = parseKey(a)
    d.setDate(d.getDate() + 1)
    return d.getTime() === parseKey(b).getTime()
  }
  const runs = []
  let s = sortedDates[0], e = sortedDates[0]
  for (let i = 1; i < sortedDates.length; i++) {
    if (isConsecutive(sortedDates[i - 1], sortedDates[i])) {
      e = sortedDates[i]
    } else {
      runs.push([s, e])
      s = sortedDates[i]
      e = sortedDates[i]
    }
  }
  runs.push([s, e])
  return runs.map(([start, end]) => {
    const from = parseKey(start)
    const to = parseKey(end)
    if (start === end) return from.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    const sameYear = from.getFullYear() === to.getFullYear()
    const sameMonth = sameYear && from.getMonth() === to.getMonth()
    if (sameMonth) {
      return `${from.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}–${to.getDate()}, ${to.getFullYear()}`
    }
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }).join(' · ')
}

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function buildBookingUrl({ city, checkin, checkout, guests }) {
  const params = new URLSearchParams()
  if (city) params.set('ss', city)
  if (checkin) params.set('checkin', checkin)
  if (checkout) params.set('checkout', checkout)
  params.set('group_adults', String(Math.max(1, guests)))
  return `https://www.booking.com/searchresults.html?${params}`
}

function buildGetYourGuideUrl({ destination, dateFrom, dateTo, people }) {
  const params = new URLSearchParams()
  if (destination) params.set('q', destination)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  if (people > 0) params.set('adults', String(people))
  return `https://www.getyourguide.com/s/?${params}`
}

function HotelSearch({ scheduleDates, participantCount, tripId }) {
  const { t } = useTranslation()
  const earliest = scheduleDates[0] ?? ''
  const latest = scheduleDates[scheduleDates.length - 1] ?? ''
  const [city, setCity] = useState('')
  const [checkin, setCheckin] = useState(earliest)
  const [checkout, setCheckout] = useState(latest ?? '')
  const [guests, setGuests] = useState(Math.max(1, participantCount ?? 1))
  const [showDetails, setShowDetails] = useState(false)

  const datesSeededRef = useRef(Boolean(earliest))
  const guestsSeededRef = useRef(participantCount > 0)

  useEffect(() => {
    if (!datesSeededRef.current && earliest) {
      datesSeededRef.current = true
      setCheckin(earliest)
      if (latest) setCheckout(latest)
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
    trackEvent('hotel_search_submitted', { trip_id: tripId, guests, has_city: Boolean(city), has_dates: Boolean(checkin) })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function adjustGuests(delta) {
    setGuests((n) => Math.max(1, Math.min(30, n + delta)))
  }

  const dateSummary = checkin
    ? `${formatDateShort(checkin)}${checkout ? ` → ${formatDateShort(checkout)}` : ''}`
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <form onSubmit={handleSearch} className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('hotels.title')}</span>
          <span className="rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
            Booking.com
          </span>
        </div>

        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t('hotels.destinationPlaceholder')}
          className={`${inputCls} font-medium`}
        />

        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-200"
          >
            <span className="flex-1 text-left">
              {dateSummary ? (
                <span><CalendarIcon /> {dateSummary} · <PeopleIcon /> {t('hotels.guestsLabel', { count: guests })}</span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">{t('hotels.checkin')} &amp; {t('hotels.guests').toLowerCase()}</span>
              )}
            </span>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>

          <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${showDetails ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="min-h-0">
              <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-1">{t('hotels.checkin')}</label>
                    <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} className={inputSmCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-1">{t('hotels.checkout')}</label>
                    <input type="date" value={checkout} min={checkin} onChange={(e) => setCheckout(e.target.value)} className={inputSmCls} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('hotels.guests')}</span>
                  <button type="button" onClick={() => adjustGuests(-1)} disabled={guests <= 1} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">−</button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{guests}</span>
                  <button type="button" onClick={() => adjustGuests(1)} disabled={guests >= 30} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-orange-600 active:scale-[0.99]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {t('hotels.searchButton')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </button>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">{t('hotels.disclaimer')}</p>
      </form>
    </div>
  )
}

function ActivitySearch({ scheduleDates, participantCount, tripId }) {
  const { t } = useTranslation()
  const earliest = scheduleDates[0] ?? ''
  const latest = scheduleDates[scheduleDates.length - 1] ?? ''
  const [destination, setDestination] = useState('')
  const [dateFrom, setDateFrom] = useState(earliest)
  const [dateTo, setDateTo] = useState(latest ?? '')
  const [people, setPeople] = useState(Math.max(1, participantCount ?? 1))
  const [showDetails, setShowDetails] = useState(false)

  const datesSeededRef = useRef(Boolean(earliest))
  const peopleSeededRef = useRef(participantCount > 0)

  useEffect(() => {
    if (!datesSeededRef.current && earliest) {
      datesSeededRef.current = true
      setDateFrom(earliest)
      if (latest) setDateTo(latest)
    }
  }, [earliest, latest])

  useEffect(() => {
    if (!peopleSeededRef.current && participantCount > 0) {
      peopleSeededRef.current = true
      setPeople(participantCount)
    }
  }, [participantCount])

  function handleSearch(e) {
    e.preventDefault()
    const url = buildGetYourGuideUrl({ destination, dateFrom, dateTo, people })
    trackEvent('activity_search_submitted', { trip_id: tripId, people, has_destination: Boolean(destination), has_dates: Boolean(dateFrom) })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function adjustPeople(delta) {
    setPeople((n) => Math.max(1, Math.min(30, n + delta)))
  }

  const dateSummary = dateFrom
    ? `${formatDateShort(dateFrom)}${dateTo ? ` → ${formatDateShort(dateTo)}` : ''}`
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <form onSubmit={handleSearch} className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('activities.title')}</span>
          <span className="rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            GetYourGuide
          </span>
        </div>

        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={t('activities.destinationPlaceholder')}
          className={`${inputCls} font-medium`}
        />

        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-200"
          >
            <span className="flex-1 text-left">
              {dateSummary ? (
                <span><CalendarIcon /> {dateSummary} · <PeopleIcon /> {t('activities.peopleLabel', { count: people })}</span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">{t('activities.dateFrom')} &amp; {t('activities.people').toLowerCase()}</span>
              )}
            </span>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>

          <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${showDetails ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="min-h-0">
              <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-1">{t('activities.dateFrom')}</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputSmCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400 mb-1">{t('activities.dateTo')}</label>
                    <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className={inputSmCls} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('activities.people')}</span>
                  <button type="button" onClick={() => adjustPeople(-1)} disabled={people <= 1} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">−</button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{people}</span>
                  <button type="button" onClick={() => adjustPeople(1)} disabled={people >= 30} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-orange-600 active:scale-[0.99]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" />
          </svg>
          {t('activities.searchButton')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </button>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">{t('activities.disclaimer')}</p>
      </form>
    </div>
  )
}

function TripPlanPage({ tripId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [tripUsers, setTripUsers] = useState([])
  const [availabilityRows, setAvailabilityRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('hotels')
  const [slideDir, setSlideDir] = useState('right')
  const [selectedRange, setSelectedRange] = useState(null)

  const groupedAvailability = useMemo(
    () => groupAvailabilityByDate(availabilityRows),
    [availabilityRows],
  )
  const scheduleDates = useMemo(
    () => Object.keys(groupedAvailability).sort(),
    [groupedAvailability],
  )
  const searchScheduleDates = useMemo(
    () => selectedRange ? [selectedRange.start, selectedRange.end] : scheduleDates,
    [selectedRange, scheduleDates],
  )

  function handleSelectRange(start, end) {
    setSelectedRange({ start, end })
  }

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
      trackEvent('plan_page_viewed', {
        trip_id: tripId,
        participant_count: usersResult.status === 'fulfilled' ? usersResult.value.length : undefined,
      })
    }

    load()
    return () => { cancelled = true }
  }, [tripId])

  function handleTabChange(tab) {
    if (tab === activeTab) return
    setSlideDir(TABS.indexOf(tab) > TABS.indexOf(activeTab) ? 'right' : 'left')
    setActiveTab(tab)
    trackEvent('plan_tab_changed', { trip_id: tripId, tab })
  }

  if (loading) return <TripLoadingSkeleton />

  const tripDatesPath = getTripPathById(tripId)
  const dateRange = formatDateRange(searchScheduleDates.length > 0 ? searchScheduleDates : scheduleDates)
  const confirmedCount = tripUsers.filter((u) => u.confirmedAt).length

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 sm:py-10">
      <style>{`
        @keyframes tab-enter-right { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tab-enter-left  { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes date-range-in   { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .tab-enter-right  { animation: tab-enter-right 180ms ease-out both; }
        .tab-enter-left   { animation: tab-enter-left  180ms ease-out both; }
        .date-range-in    { animation: date-range-in   220ms ease-out both; }
      `}</style>

      <AppHeader tripName={trip?.name}>
        <button
          type="button"
          onClick={() => navigate(tripDatesPath)}
          className="shrink-0 flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-200"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t('plan.backToDates')}
        </button>
      </AppHeader>

      <section className="mx-auto mb-5 max-w-3xl">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-6 py-5 shadow-sm shadow-emerald-100/60 dark:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex border-l-2 border-emerald-500 pl-2.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                  {t('plan.eyebrow')}
                </span>
              </div>
              {dateRange && (
                <p key={`dr-${dateRange}`} className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight date-range-in">
                  {dateRange}
                </p>
              )}
              <p className="mt-1.5 truncate text-sm text-slate-500 dark:text-slate-400">
                {(() => { const em = getTripEmoji(trip?.name); return em ? <span className="mr-1">{em}</span> : null })()}
                {trip?.name}
                {tripUsers.length > 0 && (
                  <span className="before:mx-2 before:content-['·']">
                    {t('plan.confirmedCount', { confirmed: confirmedCount, total: tripUsers.length })}
                  </span>
                )}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              {t('badge.tripClosed')}
            </span>
          </div>
        </div>
      </section>

      {availabilityRows.length > 0 && (
        <GroupAvailabilityList
          availabilityRows={availabilityRows}
          totalUsers={tripUsers.length}
          onSelectRange={handleSelectRange}
          selectedStart={selectedRange?.start}
          selectedEnd={selectedRange?.end}
        />
      )}

      <div className="mx-auto mt-8 mb-6 max-w-3xl">
        <nav className="relative flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 shadow-sm shadow-slate-200/60 dark:shadow-none">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-1 left-1 rounded-md bg-orange-500 transition-transform duration-200 ease-out ${
              activeTab === 'hotels' ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{ width: 'calc((100% - 8px) / 2)' }}
          />
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`relative z-10 cursor-pointer flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-semibold transition-colors duration-150 ${
                activeTab === tab ? 'text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="shrink-0">{TAB_ICONS[tab]}</span>
              <span>{t(`plan.tab.${tab}.label`)}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-3xl">
        <div key={activeTab} className={`tab-enter-${slideDir}`}>
          {activeTab === 'hotels' && (
            <HotelSearch
              key={`hotels-${searchScheduleDates[0]}-${searchScheduleDates[searchScheduleDates.length - 1]}`}
              scheduleDates={searchScheduleDates}
              participantCount={tripUsers.length}
              tripId={tripId}
            />
          )}
          {activeTab === 'activities' && (
            <ActivitySearch
              key={`activities-${searchScheduleDates[0]}-${searchScheduleDates[searchScheduleDates.length - 1]}`}
              scheduleDates={searchScheduleDates}
              participantCount={tripUsers.length}
              tripId={tripId}
            />
          )}
        </div>
      </div>

      <AppFooter />
    </main>
  )
}

export default TripPlanPage
