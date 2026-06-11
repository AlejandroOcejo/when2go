import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

function groupAvailabilityByDate(rows) {
  return rows.reduce((acc, row) => {
    if (!acc[row.date]) acc[row.date] = []
    acc[row.date].push({ userId: row.user_id, name: row.user_name })
    return acc
  }, {})
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function isNextCalendarDay(dateKeyA, dateKeyB) {
  const a = parseDateKey(dateKeyA)
  a.setDate(a.getDate() + 1)
  return a.getTime() === parseDateKey(dateKeyB).getTime()
}

function getUserKey(users) {
  return users.map((u) => u.userId).sort().join(',')
}

function groupConsecutiveDates(groupedByDate) {
  const sortedDates = Object.keys(groupedByDate).sort()
  if (sortedDates.length === 0) return []

  const ranges = []
  let start = sortedDates[0]
  let end = sortedDates[0]
  let users = groupedByDate[sortedDates[0]]
  let key = getUserKey(users)

  for (let i = 1; i < sortedDates.length; i++) {
    const date = sortedDates[i]
    const dateUsers = groupedByDate[date]
    const dateKey = getUserKey(dateUsers)

    if (isNextCalendarDay(sortedDates[i - 1], date) && dateKey === key) {
      end = date
    } else {
      ranges.push({ start, end, users })
      start = date
      end = date
      users = dateUsers
      key = dateKey
    }
  }
  ranges.push({ start, end, users })

  return ranges.sort((a, b) => {
    const diff = b.users.length - a.users.length
    return diff !== 0 ? diff : a.start.localeCompare(b.start)
  })
}

function formatRange(startKey, endKey, locale) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  if (startKey === endKey) {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(start)
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(start)}–${end.getDate()}`
  }
  return `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(end)}`
}

function RangeRow({ start, end, users, isTop, isSelected, isClickable, totalUsers, onSelect, locale, topMatchLabel }) {
  const prevRef = useRef(isSelected)
  const [cardPopping, setCardPopping] = useState(false)
  const [badgePopping, setBadgePopping] = useState(false)

  useEffect(() => {
    const wasSelected = prevRef.current
    prevRef.current = isSelected
    if (isSelected && !wasSelected) {
      setCardPopping(true)
      const t = setTimeout(() => setCardPopping(false), 320)
      return () => clearTimeout(t)
    }
    if (!isSelected && wasSelected && isTop) {
      setBadgePopping(true)
      const t = setTimeout(() => setBadgePopping(false), 300)
      return () => clearTimeout(t)
    }
  }, [isSelected, isTop])

  return (
    <div
      onClick={() => onSelect?.(start, end)}
      style={cardPopping ? { animation: 'range-select 320ms cubic-bezier(0.2,0.9,0.3,1) both' } : undefined}
      className={`rounded-xl px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 ${
        isClickable ? 'cursor-pointer' : ''
      } ${
        isSelected
          ? 'border-2 border-orange-500 dark:border-orange-400 bg-white dark:bg-slate-800 shadow-md shadow-orange-200/50 dark:shadow-none'
          : isTop
            ? 'border border-slate-200 dark:border-slate-700 border-l-[3px] border-l-orange-400 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
            : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <strong className="flex-1 text-sm font-bold text-slate-900 dark:text-slate-100">
          {formatRange(start, end, locale)}
        </strong>
        <div className="flex shrink-0 items-center gap-2">
          {isSelected ? (
            <span className="flex items-center gap-1 rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Selected
            </span>
          ) : isTop ? (
            <span
              style={badgePopping ? { animation: 'badge-appear 280ms cubic-bezier(0.2,0.9,0.3,1) both' } : undefined}
              className="rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            >
              {topMatchLabel}
            </span>
          ) : null}
          <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {users.length}/{totalUsers}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {users.map((user) => (
          <span
            key={user.userId}
            className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          >
            {user.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function GroupAvailabilityList({ availabilityRows, totalUsers, onSelectRange, selectedStart, selectedEnd }) {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const ranges = useMemo(() => {
    const byDate = groupAvailabilityByDate(availabilityRows)
    return groupConsecutiveDates(byDate)
  }, [availabilityRows])

  // Auto-select the top match when ranges first load
  useEffect(() => {
    if (onSelectRange && !selectedStart && ranges.length > 0) {
      onSelectRange(ranges[0].start, ranges[0].end)
    }
  }, [ranges]) // eslint-disable-line react-hooks/exhaustive-deps

  if (ranges.length === 0) return null

  const maxCount = ranges[0].users.length
  const isClickable = Boolean(onSelectRange)

  return (
    <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md shadow-slate-200/70 dark:shadow-none">
      <style>{`
        @keyframes range-select {
          0%   { transform: scale(1); }
          35%  { transform: scale(0.982); }
          70%  { transform: scale(1.014); }
          100% { transform: scale(1); }
        }
        @keyframes badge-appear {
          0%   { opacity: 0; transform: scale(0.75) translateY(2px); }
          65%  { opacity: 1; transform: scale(1.1) translateY(-1px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t('groupAvailability.title')}
        </span>
        {maxCount > 0 && (
          <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            {maxCount}/{totalUsers}
          </span>
        )}
        <svg
          viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400 transition duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0">
          <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 px-5 pb-5 pt-4">
            {isClickable && (
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Tap a range to pre-fill your flight and hotel search.
              </p>
            )}
            {ranges.map(({ start, end, users }) => (
              <RangeRow
                key={`${start}-${end}`}
                start={start}
                end={end}
                users={users}
                isTop={users.length === maxCount}
                isSelected={selectedStart === start && selectedEnd === end}
                isClickable={isClickable}
                totalUsers={totalUsers}
                onSelect={onSelectRange}
                locale={i18n.language}
                topMatchLabel={t('groupAvailability.topMatch')}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default GroupAvailabilityList
