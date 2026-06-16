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
  const formatDay = (date) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
  return `${formatDay(start)} – ${formatDay(end)}`
}

function RangeRow({ start, end, users, isTop, isSelected, isClickable, totalUsers, onSelect, locale, topMatchLabel, enterDelay = 0, isNew = true, isExiting = false, filteredUserIds, onToggleUser, isDimmed }) {
  const prevRef = useRef(isSelected)
  const [cardPopping, setCardPopping] = useState(false)
  const [badgePopping, setBadgePopping] = useState(false)
  const [playEnter, setPlayEnter] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setPlayEnter(false), 300 + enterDelay)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const animStyle = isExiting
    ? { animation: 'range-row-exit 280ms cubic-bezier(0.2,0.9,0.3,1) both', pointerEvents: 'none' }
    : cardPopping
      ? { animation: 'range-select 320ms cubic-bezier(0.2,0.9,0.3,1) both' }
      : playEnter
        ? { animation: isNew
            ? `range-row-enter 280ms cubic-bezier(0.2,0.9,0.3,1) ${enterDelay}ms both`
            : 'range-row-update 180ms ease-out both' }
        : undefined

  return (
    <div
      onClick={() => onSelect?.(start, end)}
      style={animStyle}
      className={`rounded-xl px-4 py-3 transition-[opacity,border-color,background-color,box-shadow] duration-200 ${
        isClickable ? 'cursor-pointer' : ''
      } ${isDimmed ? 'opacity-35' : ''} ${
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
        {users.map((user) => {
          const isFiltered = filteredUserIds?.includes(user.userId)
          return (
            <button
              key={user.userId}
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleUser?.(user.userId) }}
              className={`inline-flex cursor-pointer items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                isFiltered
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {user.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function rangesOverlap(a, b) {
  return a.start <= b.end && b.start <= a.end
}

function GroupAvailabilityList({ availabilityRows, totalUsers, onSelectRange, selectedStart, selectedEnd }) {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [filteredUserIds, setFilteredUserIds] = useState([])

  const ranges = useMemo(() => {
    const byDate = groupAvailabilityByDate(availabilityRows)
    return groupConsecutiveDates(byDate)
  }, [availabilityRows])

  function toggleUserFilter(userId) {
    setFilteredUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )
  }

  const filteredNames = useMemo(() => {
    const byId = new Map()
    for (const row of availabilityRows) byId.set(row.user_id, row.user_name)
    return filteredUserIds.map((userId) => ({ userId, name: byId.get(userId) ?? '' }))
  }, [availabilityRows, filteredUserIds])

  const filteredRanges = useMemo(() => {
    if (filteredUserIds.length === 0) return []
    const byDate = groupAvailabilityByDate(availabilityRows)
    const overlapByDate = {}
    for (const [date, users] of Object.entries(byDate)) {
      const userIdsAtDate = new Set(users.map((u) => u.userId))
      if (filteredUserIds.every((id) => userIdsAtDate.has(id))) {
        overlapByDate[date] = users.filter((u) => filteredUserIds.includes(u.userId))
      }
    }
    return groupConsecutiveDates(overlapByDate)
  }, [availabilityRows, filteredUserIds])

  const [displayRanges, setDisplayRanges] = useState(() =>
    ranges.map(r => ({ ...r, isNew: true, isExiting: false }))
  )

  useEffect(() => {
    setDisplayRanges(prev => {
      const currentKeys = new Set(ranges.map(r => `${r.start}-${r.end}`))
      const prevActive = prev.filter(r => !r.isExiting)
      const prevActiveKeys = new Set(prevActive.map(r => `${r.start}-${r.end}`))

      const result = []
      for (const r of prev) {
        if (r.isExiting) { result.push(r); continue }
        if (currentKeys.has(`${r.start}-${r.end}`)) {
          result.push({ ...r, isNew: false, isExiting: false })
        } else {
          const isUpdate = ranges.some(nr => rangesOverlap(nr, r))
          if (!isUpdate) result.push({ ...r, isNew: false, isExiting: true })
        }
      }
      for (const r of ranges) {
        if (!prevActiveKeys.has(`${r.start}-${r.end}`)) {
          const isNew = !prevActive.some(p => rangesOverlap(p, r))
          result.push({ ...r, isNew, isExiting: false })
        }
      }
      return result
    })
  }, [ranges])

  useEffect(() => {
    if (!displayRanges.some(r => r.isExiting)) return
    const timer = setTimeout(
      () => setDisplayRanges(prev => prev.filter(r => !r.isExiting)),
      320
    )
    return () => clearTimeout(timer)
  }, [displayRanges])

  // Auto-select the top match when ranges first load
  useEffect(() => {
    if (onSelectRange && !selectedStart && ranges.length > 0) {
      onSelectRange(ranges[0].start, ranges[0].end)
    }
  }, [ranges]) // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = ranges.length === 0 && !displayRanges.some(r => r.isExiting)

  if (isEmpty) {
    return (
      <section className="mx-auto mt-5 sm:mt-8 max-w-3xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md shadow-slate-200/70 dark:shadow-none">
        <div className="flex w-full items-center gap-3 px-5 py-3.5">
          <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('groupAvailability.title')}</span>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4 text-sm text-slate-400 dark:text-slate-500">
          {t('groupAvailability.empty')}
        </div>
      </section>
    )
  }

  const activeDisplayRanges = displayRanges.filter(r => !r.isExiting)
  const maxCount = activeDisplayRanges.length > 0 ? Math.max(...activeDisplayRanges.map(r => r.users.length)) : 0
  const isClickable = Boolean(onSelectRange)

  return (
    <section className="mx-auto mt-5 sm:mt-8 max-w-3xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md shadow-slate-200/70 dark:shadow-none">
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
        @keyframes range-row-enter {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes range-row-update {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes range-row-exit {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(10px); }
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

            {filteredUserIds.length > 0 && (
              <div
                style={{ animation: 'range-row-enter 220ms cubic-bezier(0.2,0.9,0.3,1) both' }}
                className="mb-3 rounded-xl border border-dashed border-orange-300 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                      {t('groupAvailability.filteringFor')}
                    </span>
                    {filteredNames.map((user) => (
                      <span
                        key={user.userId}
                        className="inline-flex items-center gap-1 rounded-md bg-orange-500 px-2 py-0.5 text-[11px] font-semibold text-white"
                      >
                        {user.name}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilteredUserIds([])}
                    className="shrink-0 cursor-pointer text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {t('groupAvailability.clearFilter')}
                  </button>
                </div>
                <div className="mt-2.5 space-y-1.5">
                  {filteredRanges.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('groupAvailability.noOverlap')}</p>
                  ) : (
                    filteredRanges.map(({ start, end }) => (
                      <div
                        key={`overlap-${start}-${end}`}
                        className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white dark:bg-slate-800 px-3 py-2"
                      >
                        <strong className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {formatRange(start, end, i18n.language)}
                        </strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {displayRanges.map(({ start, end, users, isNew, isExiting }, index) => (
              <RangeRow
                key={`${start}-${end}`}
                start={start}
                end={end}
                users={users}
                isTop={!isExiting && users.length === maxCount}
                isSelected={!isExiting && selectedStart === start && selectedEnd === end}
                isClickable={isClickable && !isExiting}
                totalUsers={totalUsers}
                onSelect={onSelectRange}
                locale={i18n.language}
                topMatchLabel={t('groupAvailability.topMatch')}
                enterDelay={isNew && !isExiting ? index * 55 : 0}
                isNew={isNew}
                isExiting={isExiting}
                filteredUserIds={filteredUserIds}
                onToggleUser={toggleUserFilter}
                isDimmed={!isExiting && filteredUserIds.length > 0 && !filteredUserIds.every((id) => users.some((u) => u.userId === id))}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default GroupAvailabilityList
