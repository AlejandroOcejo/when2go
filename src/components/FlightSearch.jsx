import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

function toSkyscannerDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${String(year).slice(2)}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
}

function buildSkyscannerUrl({ from, to, outbound, inbound, adults, isRoundTrip }) {
  const fromCode = from.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'anywhere'
  const toCode = to.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'anywhere'
  const params = new URLSearchParams({ adults: String(Math.max(1, adults)) })
  const base = 'https://www.skyscanner.net/transport/flights'
  const out = toSkyscannerDate(outbound)

  if (isRoundTrip && inbound) {
    return `${base}/${fromCode}/${toCode}/${out}/${toSkyscannerDate(inbound)}/?${params}`
  }
  return `${base}/${fromCode}/${toCode}/${out}/?${params}`
}

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function IataInput({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
        placeholder={placeholder}
        className="h-12 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-base font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 outline-none transition-colors focus:border-orange-400 focus:ring-0"
        spellCheck={false}
        autoCapitalize="characters"
        autoCorrect="off"
      />
    </div>
  )
}

function FlightSearch({ scheduleDates, participantCount }) {
  const { t } = useTranslation()
  const earliest = scheduleDates[0] ?? ''
  const latest = scheduleDates[scheduleDates.length - 1] ?? ''

  const [isRoundTrip, setIsRoundTrip] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [outbound, setOutbound] = useState(earliest)
  const [inbound, setInbound] = useState(latest !== earliest ? latest : '')
  const [adults, setAdults] = useState(Math.max(1, participantCount ?? 1))
  const [showDetails, setShowDetails] = useState(false)

  const datesSeededRef = useRef(Boolean(earliest))
  const adultsSeededRef = useRef(participantCount > 0)

  useEffect(() => {
    if (!datesSeededRef.current && earliest) {
      datesSeededRef.current = true
      setOutbound(earliest)
      if (latest && latest !== earliest) setInbound(latest)
    }
  }, [earliest, latest])

  useEffect(() => {
    if (!adultsSeededRef.current && participantCount > 0) {
      adultsSeededRef.current = true
      setAdults(participantCount)
    }
  }, [participantCount])

  function handleSwap() {
    setFrom(to)
    setTo(from)
  }

  function handleSearch(e) {
    e.preventDefault()
    if (!outbound) return
    const url = buildSkyscannerUrl({ from, to, outbound, inbound, adults, isRoundTrip })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function adjustAdults(delta) {
    setAdults((n) => Math.max(1, Math.min(9, n + delta)))
  }

  const dateSummary = outbound
    ? `${formatDateShort(outbound)}${isRoundTrip && inbound ? ` → ${formatDateShort(inbound)}` : ''}`
    : null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <form onSubmit={handleSearch} className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          {[true, false].map((rt) => (
            <button
              key={String(rt)}
              type="button"
              onClick={() => setIsRoundTrip(rt)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
                isRoundTrip === rt
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
            >
              {rt ? t('flights.roundTrip') : t('flights.oneWay')}
            </button>
          ))}
          <span className="ml-auto rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400">
            Skyscanner
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:flex sm:items-end sm:gap-3">
          <div className="sm:flex-1">
            <IataInput label={t('flights.from')} value={from} onChange={setFrom} placeholder="MAD" />
          </div>
          <button
            type="button"
            onClick={handleSwap}
            aria-label={t('flights.swap')}
            className="flex h-12 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h10M3 6l3-3M3 6l3 3M13 10H3M13 10l-3-3M13 10l-3 3" />
            </svg>
          </button>
          <div className="sm:flex-1">
            <IataInput label={t('flights.to')} value={to} onChange={setTo} placeholder="AMS" />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-200"
          >
            <span className="flex-1 text-left">
              {dateSummary ? (
                <span>📅 {dateSummary} · 👥 {t('flights.adultsLabel', { count: adults })}</span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">{t('flights.departure')} &amp; {t('flights.passengers').toLowerCase()}</span>
              )}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>

          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
              showDetails ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0">
              <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('flights.departure')}
                    </label>
                    <input
                      type="date"
                      value={outbound}
                      onChange={(e) => setOutbound(e.target.value)}
                      required
                      className="h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-colors focus:border-orange-400"
                    />
                  </div>
                  {isRoundTrip && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {t('flights.return')}
                      </label>
                      <input
                        type="date"
                        value={inbound}
                        min={outbound}
                        onChange={(e) => setInbound(e.target.value)}
                        className="h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none transition-colors focus:border-orange-400"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('flights.passengers')}</span>
                  <button
                    type="button"
                    onClick={() => adjustAdults(-1)}
                    disabled={adults <= 1}
                    aria-label={t('flights.removePassenger')}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{adults}</span>
                  <button
                    type="button"
                    onClick={() => adjustAdults(1)}
                    disabled={adults >= 9}
                    aria-label={t('flights.addPassenger')}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!outbound}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
          {t('flights.searchButton')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </button>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">{t('flights.disclaimer')}</p>
      </form>
    </div>
  )
}

export default FlightSearch


