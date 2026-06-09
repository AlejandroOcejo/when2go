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

function IataInput({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
        placeholder={placeholder}
        className="h-12 rounded-lg border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 placeholder-slate-300 outline-none transition-colors focus:border-orange-400 focus:ring-0"
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

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">{t('flights.title')}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{t('flights.subtitle')}</p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Skyscanner
          </span>
        </div>
      </div>

      <form onSubmit={handleSearch} className="p-6 space-y-5">
        {/* Round trip / One way toggle */}
        <div className="flex gap-2">
          {[true, false].map((rt) => (
            <button
              key={String(rt)}
              type="button"
              onClick={() => setIsRoundTrip(rt)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
                isRoundTrip === rt
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              {rt ? t('flights.roundTrip') : t('flights.oneWay')}
            </button>
          ))}
        </div>

        {/* From / To */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <IataInput
              label={t('flights.from')}
              value={from}
              onChange={setFrom}
              placeholder="e.g. MAD"
            />
          </div>
          <button
            type="button"
            onClick={handleSwap}
            aria-label={t('flights.swap')}
            className="mb-0.5 flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h10M3 6l3-3M3 6l3 3M13 10H3M13 10l-3-3M13 10l-3 3" />
            </svg>
          </button>
          <div className="flex-1">
            <IataInput
              label={t('flights.to')}
              value={to}
              onChange={setTo}
              placeholder="e.g. AMS"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('flights.departure')}
            </label>
            <input
              type="date"
              value={outbound}
              onChange={(e) => setOutbound(e.target.value)}
              required
              className="h-12 rounded-lg border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-orange-400"
            />
          </div>
          {isRoundTrip && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('flights.return')}
              </label>
              <input
                type="date"
                value={inbound}
                min={outbound}
                onChange={(e) => setInbound(e.target.value)}
                className="h-12 rounded-lg border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-orange-400"
              />
            </div>
          )}
        </div>

        {/* Passengers */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('flights.passengers')}
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustAdults(-1)}
              disabled={adults <= 1}
              aria-label={t('flights.removePassenger')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-lg font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center text-base font-semibold text-slate-900 tabular-nums">
              {adults}
            </span>
            <button
              type="button"
              onClick={() => adjustAdults(1)}
              disabled={adults >= 9}
              aria-label={t('flights.addPassenger')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-lg font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
            <span className="text-sm text-slate-500">
              {t('flights.adultsLabel', { count: adults })}
            </span>
          </div>
        </div>

        {/* Search button */}
        <button
          type="submit"
          disabled={!outbound}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
          {t('flights.searchButton')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </button>

        <p className="text-center text-xs text-slate-400">{t('flights.disclaimer')}</p>
      </form>
    </div>
  )
}

export default FlightSearch
