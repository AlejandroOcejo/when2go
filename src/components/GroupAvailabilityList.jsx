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

  return (
    <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        {t('groupAvailability.title')}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {t('groupAvailability.subtitle')}
      </p>

      {lessPopularDatesCount > 0 && (
        <button
          type="button"
          onClick={() => setShowLessPopularDates((current) => !current)}
          className="mt-4 rounded-md border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition duration-150 hover:bg-slate-100"
        >
          {showLessPopularDates
            ? 'Hide less popular dates'
            : `Show ${lessPopularDatesCount} less popular date${lessPopularDatesCount === 1 ? '' : 's'}`}
        </button>
      )}

      <ul className="mt-4 space-y-3">
        {sortedAvailabilityEntries.length === 0 && (
          <li className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            {t('groupAvailability.empty')}
          </li>
        )}
        {visibleAvailabilityEntries.map(([dateKey, users]) => (
          <li
            key={dateKey}
            className={`rounded-xl border p-3 transition duration-200 ${
              maxAvailabilityCount > 0 && users.length === maxAvailabilityCount
                ? 'border-orange-500 bg-white'
                : 'border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="text-slate-900">{formatDate(dateKey, i18n.language)}</strong>
              <div className="flex items-center gap-2">
                {maxAvailabilityCount > 0 && users.length === maxAvailabilityCount && (
                  <span className="rounded-md border border-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                    {t('groupAvailability.topMatch')}
                  </span>
                )}
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {t('groupAvailability.available', { count: users.length })}
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {users.map((user) => (
                <span
                  key={`${dateKey}-${user.userId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {user.name}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default GroupAvailabilityList
