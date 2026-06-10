import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

function groupAvailabilityByDate(rows) {
  return rows.reduce((accumulator, row) => {
    if (!accumulator[row.date]) {
      accumulator[row.date] = []
    }
    accumulator[row.date].push({ userId: row.user_id, name: row.user_name, color: row.user_color })
    return accumulator
  }, {})
}

function byPopularityThenDate([leftDate, leftUsers], [rightDate, rightUsers]) {
  const countDifference = rightUsers.length - leftUsers.length
  return countDifference !== 0 ? countDifference : leftDate.localeCompare(rightDate)
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(dateKey, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(
    parseDateKey(dateKey),
  )
}

function GroupAvailabilityList({ availabilityRows, totalUsers }) {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [showLessPopularDates, setShowLessPopularDates] = useState(false)

  const groupedAvailability = useMemo(() => groupAvailabilityByDate(availabilityRows), [availabilityRows])

  const maxAvailabilityCount = useMemo(() => {
    return Object.values(groupedAvailability).reduce((highest, users) => Math.max(highest, users.length), 0)
  }, [groupedAvailability])

  const sortedAvailabilityEntries = useMemo(() => {
    return Object.entries(groupedAvailability).sort(byPopularityThenDate)
  }, [groupedAvailability])

  const lessPopularDatesCount = useMemo(() => {
    if (maxAvailabilityCount <= 0) return 0
    return sortedAvailabilityEntries.filter(([, users]) => users.length < maxAvailabilityCount).length
  }, [maxAvailabilityCount, sortedAvailabilityEntries])

  const visibleAvailabilityEntries = useMemo(() => {
    if (showLessPopularDates || maxAvailabilityCount <= 0) return sortedAvailabilityEntries
    return sortedAvailabilityEntries.filter(([, users]) => users.length === maxAvailabilityCount)
  }, [maxAvailabilityCount, showLessPopularDates, sortedAvailabilityEntries])

  const topDatesCount = useMemo(() => {
    return sortedAvailabilityEntries.filter(([, users]) => users.length === maxAvailabilityCount).length
  }, [maxAvailabilityCount, sortedAvailabilityEntries])

  return (
    <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md shadow-slate-200/70 dark:shadow-none">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t('groupAvailability.title')}
        </span>

        {maxAvailabilityCount > 0 && (
          <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            {topDatesCount === 1
              ? `1 date · ${maxAvailabilityCount}/${totalUsers}`
              : `${topDatesCount} dates · ${maxAvailabilityCount}/${totalUsers}`}
          </span>
        )}

        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
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
          <div className="border-t border-slate-200 dark:border-slate-700 px-5 pb-6 pt-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('groupAvailability.subtitle')}
            </p>

            {lessPopularDatesCount > 0 && (
              <button
                type="button"
                onClick={() => setShowLessPopularDates((current) => !current)}
                className="mt-4 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                {showLessPopularDates
                  ? 'Hide less popular dates'
                  : `Show ${lessPopularDatesCount} less popular date${lessPopularDatesCount === 1 ? '' : 's'}`}
              </button>
            )}

            <ul className="mt-4 space-y-3">
              {sortedAvailabilityEntries.length === 0 && (
                <li className="rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-4 text-sm text-slate-500 dark:text-slate-400">
                  {t('groupAvailability.empty')}
                </li>
              )}
              {visibleAvailabilityEntries.map(([dateKey, users]) => (
                <li
                  key={dateKey}
                  className={`rounded-xl border p-3 transition duration-200 ${
                    maxAvailabilityCount > 0 && users.length === maxAvailabilityCount
                      ? 'border-orange-200 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/20 border-l-[3px] border-l-orange-500'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="font-bold text-slate-900 dark:text-slate-100">{formatDate(dateKey, i18n.language)}</strong>
                    <div className="flex items-center gap-2">
                      {maxAvailabilityCount > 0 && users.length === maxAvailabilityCount && (
                        <span className="rounded-md border border-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
                          {t('groupAvailability.topMatch')}
                        </span>
                      )}
                      <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('groupAvailability.available', { count: users.length })}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {users.map((user) => (
                      <span
                        key={`${dateKey}-${user.userId}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        {user.name}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export default GroupAvailabilityList



