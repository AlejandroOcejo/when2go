import { useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { useTranslation } from 'react-i18next'
import { trackEvent } from '../lib/telemetry'

const BRAND_ORANGE_RGB = '249, 115, 22'
const BRAND_ORANGE_DARK = '#ea580c'

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function expandRange(fromDate, toDate) {
  const dates = []
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())

  while (cursor <= end) {
    dates.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function mergeDateKeys(baseDates, newDates) {
  return [...new Set([...baseDates, ...newDates])].sort((left, right) => left.localeCompare(right))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function AvailabilityCalendar({ selectedDates, groupedAvailability, totalUsers, onChange }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('multiple')
  const [rangeDraft, setRangeDraft] = useState(undefined)
  const selectedCount = selectedDates.length
  const selectedDateObjects = selectedDates.map((date) => fromDateKey(date))
  const availabilityCountByDate = useMemo(() => {
    return Object.entries(groupedAvailability).reduce((accumulator, [dateKey, users]) => {
      accumulator[dateKey] = users.length
      return accumulator
    }, {})
  }, [groupedAvailability])

  const dayButtonClasses =
    'relative mx-auto inline-flex h-10 w-10 min-h-10 min-w-10 max-h-10 max-w-10 aspect-square box-border items-center justify-center rounded-md p-0 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:scale-[0.98] transition-[background-color,transform,color] duration-150 ease-out'

  const selectedOutlineClass =
    `bg-transparent text-slate-900 shadow-[inset_0_0_0_2px_${BRAND_ORANGE_DARK}]`

  const safeTotalUsers = Math.max(totalUsers || 0, 1)

  function getAvailabilityOpacity(dateKey) {
    const availableUsers = availabilityCountByDate[dateKey] ?? 0

    if (availableUsers <= 0) {
      return 0
    }

    const ratio = clamp(availableUsers / safeTotalUsers, 0, 1)
    return ratio * 0.32
  }

  function CalendarDayButton(props) {
    const { day, modifiers, children, className, ...buttonProps } = props
    const dateKey = toDateKey(day.date)
    const availableUsers = availabilityCountByDate[dateKey] ?? 0
    const opacity = getAvailabilityOpacity(dateKey)

    const heatmapStyle =
      opacity > 0
        ? {
            backgroundColor: `rgba(${BRAND_ORANGE_RGB}, ${opacity})`,
          }
        : undefined

    const isSelected = Boolean(modifiers?.selected || modifiers?.existingSelection)
    const isRangeStart = Boolean(modifiers?.range_start)
    const isRangeMiddle = Boolean(modifiers?.range_middle)
    const isRangeEnd = Boolean(modifiers?.range_end)

    let selectionClass = ''

    if (mode === 'range') {
      if (isRangeStart || isRangeMiddle || isRangeEnd || isSelected) {
        selectionClass = `${selectedOutlineClass} rounded-md`
      }
    } else if (isSelected) {
      selectionClass = `${selectedOutlineClass} rounded-md`
    }

    const mergedClassName = [className, selectionClass].filter(Boolean).join(' ')

    return (
      <button
        {...buttonProps}
        onClick={(event) => {
          trackEvent('calendar_day_clicked', {
            date_key: dateKey,
            mode,
            available_count: availableUsers,
            was_selected: isSelected,
          })

          if (buttonProps.onClick) {
            buttonProps.onClick(event)
          }

          // Keep month animations reliable by clearing day focus after selection.
          const clickedElement = event.currentTarget

          if (clickedElement instanceof HTMLElement) {
            clickedElement.blur()
          }
        }}
        style={{
          ...heatmapStyle,
          ...buttonProps.style,
        }}
        className={mergedClassName}
      >
        {availableUsers > 0 && (
          <span className="pointer-events-none absolute -left-1 -top-1 rounded-sm border border-slate-300 bg-white px-0.5 text-[8px] font-medium leading-none text-slate-600">
            {availableUsers}/{safeTotalUsers}
          </span>
        )}
        {children}
      </button>
    )
  }

  function NavigationButton(props) {
    const { onPointerDown, ...buttonProps } = props

    return (
      <button
        {...buttonProps}
        onPointerDown={(event) => {
          // DayPicker skips month animation while a day is focused.
          const activeElement = document.activeElement

          if (activeElement instanceof HTMLElement) {
            activeElement.blur()
          }

          if (onPointerDown) {
            onPointerDown(event)
          }
        }}
      />
    )
  }

  return (
    <section className="rounded-xl border-2 border-slate-300 bg-white p-6 sm:p-8">
      <style>
        {`@keyframes rdp-slide-in-from-right { from { opacity: 0.15; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      @keyframes rdp-slide-out-to-left { from { opacity: 1; transform: translateX(0); } to { opacity: 0.15; transform: translateX(-100%); } }
      @keyframes rdp-slide-in-from-left { from { opacity: 0.15; transform: translateX(-100%); } to { opacity: 1; transform: translateX(0); } }
      @keyframes rdp-slide-out-to-right { from { opacity: 1; transform: translateX(0); } to { opacity: 0.15; transform: translateX(100%); } }
    .rdp-caption_after_enter, .rdp-weeks_after_enter { animation: rdp-slide-in-from-right 180ms ease-out both; }
    .rdp-caption_after_exit, .rdp-weeks_after_exit { animation: rdp-slide-out-to-right 180ms ease-in both; }
    .rdp-caption_before_enter, .rdp-weeks_before_enter { animation: rdp-slide-in-from-left 180ms ease-out both; }
    .rdp-caption_before_exit, .rdp-weeks_before_exit { animation: rdp-slide-out-to-left 180ms ease-in both; }
    .rdp-month { overflow: hidden; }`}
      </style>

      <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[28px]">{t('calendar.title')}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('calendar.subtitle')}</p>

      <p
        className={`mt-3 inline-flex rounded-md border px-2.5 py-1 text-xs font-medium transition duration-150 ${
          selectedCount > 0
            ? 'border-orange-500 bg-white text-orange-700'
            : 'border-slate-300 bg-white text-slate-600'
        }`}
      >
        {selectedCount === 0
          ? t('calendar.selectedNone')
          : t('calendar.selectedCount', { count: selectedCount })}
      </p>

      <div className="mt-6 flex w-full justify-center">
        <div className="inline-flex rounded-md border border-slate-400 bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setMode('multiple')
              setRangeDraft(undefined)
            }}
            className={`h-8 rounded-sm px-3 text-xs font-semibold transition duration-150 ${
              mode === 'multiple' ? 'bg-orange-500 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t('calendar.multipleDates')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('range')
              setRangeDraft(undefined)
            }}
            className={`h-8 rounded-sm px-3 text-xs font-semibold transition duration-150 ${
              mode === 'range' ? 'bg-orange-500 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {t('calendar.dateRange')}
          </button>
        </div>
      </div>

      {mode === 'multiple' ? (
        <DayPicker
          mode="multiple"
          animate
          selected={selectedDateObjects}
          onSelect={(nextDates) => {
            const next = (nextDates ?? []).map((date) => toDateKey(date))
            onChange(next)
          }}
          components={{
            DayButton: CalendarDayButton,
            PreviousMonthButton: NavigationButton,
            NextMonthButton: NavigationButton,
          }}
          className="mt-6"
          classNames={{
            root: 'rdp-root w-full',
            months: 'flex flex-col',
            month: 'w-full space-y-3',
            month_caption: 'relative flex items-center justify-center py-2',
            caption_label: 'pointer-events-none relative z-0 text-base font-semibold text-slate-900',
            nav: 'absolute inset-x-0 z-10 flex items-center justify-between px-12',
            button_previous: 'pointer-events-auto h-8 w-8 rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors duration-150',
            button_next: 'pointer-events-auto h-8 w-8 rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors duration-150',
            month_grid: 'w-full border-collapse',
            weekdays: 'grid grid-cols-7',
            weekday: 'py-1 text-center text-xs font-semibold text-slate-600',
            week: 'grid grid-cols-7',
            day: 'text-center p-[2px]',
            day_button: dayButtonClasses,
            selected: 'text-slate-900 font-semibold',
            today: 'text-slate-800',
            outside: 'text-slate-300',
          }}
        />
      ) : (
        <DayPicker
          mode="range"
          animate
          selected={rangeDraft}
          onSelect={(nextRange) => {
            setRangeDraft(nextRange)

            if (!nextRange?.from) {
              return
            }

            if (!nextRange.to) {
              return
            }

            const start = nextRange.from <= nextRange.to ? nextRange.from : nextRange.to
            const end = nextRange.from <= nextRange.to ? nextRange.to : nextRange.from
            const rangeDates = expandRange(start, end)
            onChange(mergeDateKeys(selectedDates, rangeDates))
          }}
          modifiers={{
            existingSelection: selectedDateObjects,
          }}
          modifiersClassNames={{
            existingSelection: 'text-slate-900 font-semibold',
          }}
          components={{
            DayButton: CalendarDayButton,
            PreviousMonthButton: NavigationButton,
            NextMonthButton: NavigationButton,
          }}
          className="mt-6"
          classNames={{
            root: 'rdp-root w-full',
            months: 'flex flex-col',
            month: 'w-full space-y-3',
            month_caption: 'relative flex items-center justify-center py-2',
            caption_label: 'pointer-events-none relative z-0 text-base font-semibold text-slate-900',
            nav: 'absolute inset-x-0 z-10 flex items-center justify-between px-12',
            button_previous: 'pointer-events-auto h-8 w-8 rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors duration-150',
            button_next: 'pointer-events-auto h-8 w-8 rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors duration-150',
            month_grid: 'w-full border-collapse',
            weekdays: 'grid grid-cols-7',
            weekday: 'py-1 text-center text-xs font-semibold text-slate-600',
            week: 'grid grid-cols-7',
            day: 'text-center p-[2px]',
            day_button: dayButtonClasses,
            selected: 'text-slate-900 font-semibold',
            range_start: 'text-slate-900 font-semibold',
            range_middle: 'text-slate-900 font-semibold',
            range_end: 'text-slate-900 font-semibold',
            today: 'text-slate-800',
            outside: 'text-slate-300',
          }}
        />
      )}
    </section>
  )
}

export default AvailabilityCalendar
