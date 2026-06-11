import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppFooter from '../components/AppFooter'
import AppHeader from '../components/AppHeader'
import { trackEvent } from '../lib/telemetry'
import { clearAccessToken, createTrip } from '../lib/supabaseBackend'
import { getRecentTrips, getTripPathById, saveTripMonthLock } from '../lib/tripLink'
import { inputCls, labelCls, ORANGE_RGB, ORANGE_DARK_HEX } from '../lib/tokens'

function formatMonthKey(year, month) {
  if (!year || !month) return ''
  return `${year}-${month}`
}

// ─── Group preview widget ─────────────────────────────────────────────────────
// Full month view. Mirrors AvailabilityCalendar exactly:
// - orange heatmap fill (opacity by count/total ratio, same formula as CalendarDayButton)
// - inset orange border on days the current user selected
// - x/y badge in top-left, orange when full match
const DEMO_TOTAL = 3
// June 2026 starts on Monday — 30 days, pad to 35 (5 complete weeks)
const DEMO_MONTH = [
  { num:  1, count: 0, selected: false },
  { num:  2, count: 0, selected: false },
  { num:  3, count: 1, selected: false },
  { num:  4, count: 2, selected: false },
  { num:  5, count: 1, selected: false },
  { num:  6, count: 0, selected: false },
  { num:  7, count: 0, selected: false },
  { num:  8, count: 0, selected: false },
  { num:  9, count: 1, selected: false },
  { num: 10, count: 2, selected: false },
  { num: 11, count: 2, selected: false },
  { num: 12, count: 1, selected: false },
  { num: 13, count: 0, selected: false },
  { num: 14, count: 0, selected: false },
  { num: 15, count: 0, selected: false },
  { num: 16, count: 1, selected: false },
  { num: 17, count: 3, selected: true  },
  { num: 18, count: 3, selected: true  },
  { num: 19, count: 3, selected: true  },
  { num: 20, count: 1, selected: false },
  { num: 21, count: 0, selected: false },
  { num: 22, count: 0, selected: false },
  { num: 23, count: 0, selected: false },
  { num: 24, count: 1, selected: false },
  { num: 25, count: 2, selected: false },
  { num: 26, count: 1, selected: false },
  { num: 27, count: 0, selected: false },
  { num: 28, count: 0, selected: false },
  { num: 29, count: 0, selected: false },
  { num: 30, count: 0, selected: false },
]
const DEMO_DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const DEMO_CELLS = [...DEMO_MONTH, ...Array(5).fill(null)]

function heatmapOpacity(count, total) {
  if (count <= 0 || total <= 0) return 0
  const ratio = Math.min(count / total, 1)
  if (ratio >= 1) return 0.32
  return Math.max(0.04, ratio * 0.2)
}

function GroupPreviewCard() {
  return (
    <div className="w-72 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl shadow-slate-300/40 dark:shadow-slate-950/60">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">Lisbon weekend</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-orange-500">Live</span>
        </div>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DEMO_DAY_LABELS.map((d, i) => (
          <div key={`lbl-${i}`} className="py-0.5 text-center text-[9px] font-semibold text-slate-500 dark:text-slate-400">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {DEMO_CELLS.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const opacity = heatmapOpacity(day.count, DEMO_TOTAL)
          return (
            <div
              key={`cell-${i}`}
              className="relative flex aspect-square items-center justify-center rounded-md text-[10px] font-semibold text-slate-900 dark:text-slate-100"
              style={{
                backgroundColor: opacity > 0 ? `rgba(${ORANGE_RGB}, ${opacity})` : undefined,
                boxShadow: day.selected ? `inset 0 0 0 2px ${ORANGE_DARK_HEX}` : undefined,
              }}
            >
              {day.num}
            </div>
          )
        })}
      </div>

      {/* Best match */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-orange-100 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/20 px-3 py-2">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400">Jun 17–19: everyone free</p>
          <p className="text-[9px] text-slate-500 dark:text-slate-500">3 of 3 available</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
function LandingPage({ onNavigate }) {
  const { t } = useTranslation()
  const [tripName, setTripName] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [participants, setParticipants] = useState([])
  const [recentlyAddedParticipant, setRecentlyAddedParticipant] = useState('')
  const [limitToMonth, setLimitToMonth] = useState(false)
  const [limitedMonth, setLimitedMonth] = useState('')
  const [isCreatingTrip, setIsCreatingTrip] = useState(false)
  const [recentTrips] = useState(() => getRecentTrips())

  const currentDate = useMemo(() => new Date(), [])
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, index, 1)),
    }))
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

  function handleAddParticipant() {
    const trimmed = participantName.trim()
    if (!trimmed) return
    if (participants.some((name) => name.toLowerCase() === trimmed.toLowerCase())) {
      setParticipantName('')
      return
    }
    setParticipants((current) => [...current, trimmed])
    setRecentlyAddedParticipant(trimmed)
    trackEvent('participant_added', { participant_count: participants.length + 1 })
    setParticipantName('')
  }

  function handleParticipantKeyDown(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAddParticipant()
  }

  function removeParticipant(nameToRemove) {
    setParticipants((current) => current.filter((name) => name !== nameToRemove))
    trackEvent('participant_removed', { participant_count: participants.length - 1 })
  }

  async function handleCreateTrip(event) {
    event.preventDefault()
    const trimmed = tripName.trim()
    const cleanParticipants = participants.map((name) => name.trim()).filter((name) => name.length > 0)
    const monthLock = limitToMonth && /^\d{4}-\d{2}$/.test(limitedMonth) ? limitedMonth : ''
    if (!trimmed || cleanParticipants.length === 0 || isCreatingTrip) return
    try {
      setIsCreatingTrip(true)
      const trip = await createTrip(trimmed, cleanParticipants)
      if (!trip?.id) throw new Error('Failed to create trip: missing trip id in response')
      trackEvent('trip_created', {
        trip_id: trip.id,
        participant_count: cleanParticipants.length,
        trip_name_length: trimmed.length,
      })
      if (monthLock) saveTripMonthLock(trip.id, monthLock)
      onNavigate(getTripPathById(trip.id))
    } catch (error) {
      console.error(error)
      if (String(error?.message ?? '').includes('invalid_session')) await clearAccessToken()
      window.alert('Unable to create trip right now. Please check Supabase configuration and try again.')
    } finally {
      setIsCreatingTrip(false)
    }
  }

  return (
    <main
      className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16"
      style={{ backgroundImage: 'radial-gradient(ellipse 90% 320px at 60% -80px, rgba(249,115,22,0.09), transparent)' }}
    >
      <style>{`
        @keyframes participant-pop-in {
          0%   { opacity: 0; transform: translateY(4px) scale(0.94); }
          65%  { opacity: 1; transform: translateY(0) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <AppHeader>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Invite only
        </span>
      </AppHeader>

      {/* ── Hero ── */}
      <section
        className="mx-auto mb-11 max-w-3xl"
        style={{ animation: 'fade-up 380ms ease both' }}
      >
        <div className="flex items-center gap-8 lg:gap-12 py-8">
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <span className="h-px w-5 bg-orange-400 dark:bg-orange-600" aria-hidden="true" />
              No signup · No passwords
            </p>
            <h1 className="mt-4 text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              {t('landing.title')}
            </h1>
            <p className="mt-5 max-w-[420px] text-base leading-relaxed text-slate-500 dark:text-slate-400">
              {t('landing.subtitle')}
            </p>

            {/* Feature steps */}
            <div className="mt-8 flex gap-7">
              {[
                {
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                  ),
                  title: 'Share a link',
                  sub: 'No account needed',
                },
                {
                  icon: (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ),
                  title: 'Find the best week',
                  sub: 'See the overlap instantly',
                },
              ].map(({ icon, title, sub }) => (
                <div key={title} className="flex items-center gap-3">
                  <span className="shrink-0 text-orange-500 dark:text-orange-400">{icon}</span>
                  <div>
                    <p className="text-xs font-bold leading-none text-slate-900 dark:text-slate-100 mb-1">{title}</p>
                    <p className="text-[11px] leading-none text-slate-500 dark:text-slate-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="hidden lg:block"
            style={{ animation: 'fade-up 420ms 80ms ease both' }}
          >
            <GroupPreviewCard />
          </div>
        </div>
      </section>

      {/* ── Form card ── */}
      <section
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md shadow-slate-200/60 dark:shadow-none"
        style={{ animation: 'fade-up 380ms 60ms ease both' }}
      >
        <div className="h-[3px] bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400" />

        <div className="p-7 sm:p-9">
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-7">
            {t('landing.eyebrow')}
          </p>

          <form className="flex flex-col gap-6" onSubmit={handleCreateTrip}>
            {/* Trip name */}
            <div>
              <label htmlFor="trip-name" className={labelCls}>
                {t('landing.tripNameLabel')}
              </label>
              <input
                id="trip-name"
                placeholder={t('landing.tripNamePlaceholder')}
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                maxLength={64}
                className={inputCls}
                required
              />
            </div>

            {/* Participants */}
            <div>
              <label htmlFor="participant-name" className={labelCls}>
                {t('landing.participantsLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="participant-name"
                  placeholder={t('landing.participantPlaceholder')}
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  onKeyDown={handleParticipantKeyDown}
                  maxLength={24}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={handleAddParticipant}
                  className="h-12 shrink-0 cursor-pointer rounded-xl bg-slate-100 dark:bg-slate-800/80 border-2 border-transparent px-5 text-sm font-semibold text-slate-700 dark:text-slate-300 transition duration-150 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.99]"
                >
                  {t('landing.add')}
                </button>
              </div>

              {/* Chips */}
              {participants.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {participants.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      style={
                        recentlyAddedParticipant === name
                          ? { animation: 'participant-pop-in 220ms cubic-bezier(0.2, 0.9, 0.2, 1)' }
                          : undefined
                      }
                      onAnimationEnd={() => {
                        if (recentlyAddedParticipant === name) setRecentlyAddedParticipant('')
                      }}
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeParticipant(name)}
                        className="cursor-pointer rounded px-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                        aria-label={t('landing.removeParticipant', { name })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-2.5 text-xs text-slate-400 dark:text-slate-500">{t('landing.participantsHint')}</p>
            </div>

            {/* Month limit */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={limitToMonth}
                  onChange={(event) => {
                    const checked = event.target.checked
                    if (checked) {
                      const defaultMonth = formatMonthKey(
                        String(currentDate.getFullYear()),
                        String(currentDate.getMonth() + 1).padStart(2, '0'),
                      )
                      setLimitedMonth((current) => current || defaultMonth)
                    }
                    setLimitToMonth(checked)
                  }}
                  className="h-4 w-4 cursor-pointer rounded-[7px] border-slate-400 accent-orange-300 transition-[transform,filter] duration-150 ease-out checked:scale-105 checked:brightness-95 focus:ring-orange-300"
                />
                {t('landing.limitToMonthToggle')}
              </label>

              <div
                className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                  limitToMonth ? 'mt-3 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="min-h-0">
                  <label className={labelCls}>{t('landing.limitToMonthLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <select
                        value={selectedLimitedMonth}
                        onChange={(e) => updateLimitedMonth(selectedLimitedYear, e.target.value)}
                        disabled={!limitToMonth}
                        required={limitToMonth}
                        className="h-10 w-full cursor-pointer appearance-none rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-transparent pl-3 pr-10 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all duration-150 focus:bg-white dark:focus:bg-slate-800 focus:border-orange-400"
                      >
                        <option value="" disabled>Select month</option>
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500 dark:text-slate-400">
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
                          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={selectedLimitedYear}
                        onChange={(e) => updateLimitedMonth(e.target.value, selectedLimitedMonth)}
                        disabled={!limitToMonth}
                        required={limitToMonth}
                        className="h-10 w-full cursor-pointer appearance-none rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-transparent pl-3 pr-10 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-all duration-150 focus:bg-white dark:focus:bg-slate-800 focus:border-orange-400"
                      >
                        <option value="" disabled>Select year</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500 dark:text-slate-400">
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
                          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">{t('landing.limitToMonthHint')}</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={participants.length === 0 || isCreatingTrip || (limitToMonth && !limitedMonth)}
              className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 text-[15px] font-bold text-white shadow-md shadow-orange-300/40 dark:shadow-none transition duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-orange-300 disabled:shadow-none"
            >
              {isCreatingTrip ? 'Creating trip…' : t('landing.createTrip')}
              {!isCreatingTrip && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* ── Recent trips ── */}
      {recentTrips.length > 0 && (
        <section
          className="mx-auto mt-5 max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-md shadow-slate-200/60 dark:shadow-none sm:p-6"
          style={{ animation: 'fade-up 380ms 120ms ease both' }}
        >
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t('landing.recentTripsTitle')}
          </h2>
          <div className="mt-3 space-y-1.5">
            {recentTrips.map((recentTrip) => (
              <button
                key={recentTrip.id}
                type="button"
                onClick={() => {
                  trackEvent('recent_trip_opened', { trip_id: recentTrip.id })
                  onNavigate(recentTrip.path)
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              >
                <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {recentTrip.name}
                </span>
                <span className="ml-3 shrink-0 text-xs font-bold text-orange-500 dark:text-orange-400">
                  {t('landing.openRecent')} →
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default LandingPage
