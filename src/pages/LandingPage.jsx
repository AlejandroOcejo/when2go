import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppFooter from '../components/AppFooter'
import AppHeader from '../components/AppHeader'
import { trackEvent } from '../lib/telemetry'
import { clearAccessToken, createTrip } from '../lib/supabaseBackend'
import { getRecentTrips, getTripPathById, saveTripMonthLock } from '../lib/tripLink'

function formatMonthKey(year, month) {
  if (!year || !month) return ''
  return `${year}-${month}`
}

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

      if (!trip?.id) {
        throw new Error('Failed to create trip: missing trip id in response')
      }

      trackEvent('trip_created', {
        trip_id: trip.id,
        participant_count: cleanParticipants.length,
        trip_name_length: trimmed.length,
      })

      if (monthLock) {
        saveTripMonthLock(trip.id, monthLock)
      }

      onNavigate(getTripPathById(trip.id))
    } catch (error) {
      console.error(error)

      if (String(error?.message ?? '').includes('invalid_session')) {
        await clearAccessToken()
      }

      window.alert('Unable to create trip right now. Please check Supabase configuration and try again.')
    } finally {
      setIsCreatingTrip(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <style>
        {`@keyframes participant-pop-in {
          0% { opacity: 0; transform: translateY(4px) scale(0.94); }
          65% { opacity: 1; transform: translateY(0) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }`}
      </style>

      <AppHeader>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Invite only
        </span>
      </AppHeader>

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
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 transition-transform duration-150"
                style={
                  recentlyAddedParticipant === name
                    ? { animation: 'participant-pop-in 220ms cubic-bezier(0.2, 0.9, 0.2, 1)' }
                    : undefined
                }
                onAnimationEnd={() => {
                  if (recentlyAddedParticipant === name) {
                    setRecentlyAddedParticipant('')
                  }
                }}
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

                  if (checked) {
                    const defaultMonth = formatMonthKey(
                      String(currentDate.getFullYear()),
                      String(currentDate.getMonth() + 1).padStart(2, '0'),
                    )
                    setLimitedMonth((current) => current || defaultMonth)
                  }

                  setLimitToMonth(checked)
                }}
                className="h-4 w-4 rounded-[7px] border-slate-400 accent-orange-300 transition-[transform,filter] duration-150 ease-out checked:scale-105 checked:brightness-95 focus:ring-orange-300"
              />
              {t('landing.limitToMonthToggle')}
            </label>

            <div
              className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                limitToMonth ? 'mt-3 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="min-h-0">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                  {t('landing.limitToMonthLabel')}
                </label>

                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="relative">
                    <select
                      value={selectedLimitedMonth}
                      onChange={(event) => updateLimitedMonth(selectedLimitedYear, event.target.value)}
                      className="h-10 w-full appearance-none rounded-md border border-slate-400 bg-white pl-3 pr-10 text-sm font-medium text-slate-900 shadow-none outline-none transition-colors duration-150 focus:border-orange-500 focus:ring-0 focus:shadow-none"
                      disabled={!limitToMonth}
                      required={limitToMonth}
                    >
                      <option value="" disabled>Select month</option>
                      {monthOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
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
                      disabled={!limitToMonth}
                      required={limitToMonth}
                    >
                      <option value="" disabled>Select year</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
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
            </div>

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

      {recentTrips.length > 0 && (
        <section className="mx-auto mt-5 max-w-2xl rounded-xl border border-slate-300 bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{t('landing.recentTripsTitle')}</h2>
          <div className="mt-3 space-y-2">
            {recentTrips.map((recentTrip) => (
              <button
                key={recentTrip.id}
                type="button"
                onClick={() => onNavigate(recentTrip.path)}
                className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left transition duration-150 hover:bg-slate-50"
              >
                <span className="truncate text-sm font-medium text-slate-900">{recentTrip.name}</span>
                <span className="ml-3 text-xs text-slate-500">{t('landing.openRecent')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <AppFooter maxWidth="max-w-2xl" />
    </main>
  )
}

export default LandingPage
