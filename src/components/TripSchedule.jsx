import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SCHEDULE_START_HOUR = 7
const SCHEDULE_END_HOUR = 22
const DEFAULT_HOURS = Array.from(
  { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 },
  (_, i) => i + SCHEDULE_START_HOUR,
)

function formatDateHeading(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function HourRow({ date, hour, activities, onAdd, onRemove }) {
  const { t } = useTranslation()
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  function openInput() {
    setIsAdding(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function commit() {
    const title = draft.trim()
    if (title) onAdd(date, hour, title)
    setIsAdding(false)
    setDraft('')
  }

  function cancel() {
    setIsAdding(false)
    setDraft('')
  }

  const hasActivities = activities.length > 0

  return (
    <div className="group grid items-start gap-x-3 py-1" style={{ gridTemplateColumns: '3.5rem 1fr' }}>
      <span className="pt-1.5 text-right font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums leading-none">
        {String(hour).padStart(2, '0')}:00
      </span>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-700 pt-1.5 pb-0.5 min-h-[28px]">
        {activities.map((activity) => (
          <span
            key={activity.id}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300"
          >
            <span>{activity.title}</span>
            <button
              type="button"
              onClick={() => onRemove(activity.id)}
              className="cursor-pointer leading-none text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors duration-100"
              aria-label={t('schedule.removeActivity')}
            >
              ×
            </button>
          </span>
        ))}
        {isAdding ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              else if (e.key === 'Escape') cancel()
            }}
            onBlur={commit}
            placeholder={t('schedule.activityPlaceholder')}
            maxLength={100}
            className="h-6 w-36 rounded border border-orange-400 bg-white dark:bg-slate-800 px-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-1 focus:ring-orange-300"
          />
        ) : (
          <button
            type="button"
            onClick={openInput}
            className={`cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors duration-100 ${
              hasActivities ? '' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            + {t('schedule.add')}
          </button>
        )}
      </div>
    </div>
  )
}

function DayCard({ dateKey, activities, onAdd, onRemove }) {
  const activityHoursOutsideDefault = activities
    .map((a) => a.hour)
    .filter((h) => h < SCHEDULE_START_HOUR || h > SCHEDULE_END_HOUR)
  const allHours = [...new Set([...DEFAULT_HOURS, ...activityHoursOutsideDefault])].sort(
    (a, b) => a - b,
  )
  const activitiesByHour = activities.reduce((acc, a) => {
    ;(acc[a.hour] ??= []).push(a)
    return acc
  }, {})

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm shadow-slate-200/60 dark:shadow-none">
      <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-5 py-3.5">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">{formatDateHeading(dateKey)}</h3>
      </div>
      <div className="px-4 py-2">
        {allHours.map((hour) => (
          <HourRow
            key={hour}
            date={dateKey}
            hour={hour}
            activities={activitiesByHour[hour] ?? []}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}

function TripSchedule({ scheduleDates, activities, onAdd, onRemove }) {
  const { t } = useTranslation()

  if (scheduleDates.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('schedule.noDates')}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('schedule.noDatesHint')}</p>
      </div>
    )
  }

  return (
    <section className="mx-auto mt-5 max-w-3xl">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('schedule.title')}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('schedule.subtitle')}</p>
      </div>
      <div className="space-y-4">
        {scheduleDates.map((dateKey) => (
          <DayCard
            key={dateKey}
            dateKey={dateKey}
            activities={activities.filter((a) => a.date === dateKey)}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  )
}

export default TripSchedule



