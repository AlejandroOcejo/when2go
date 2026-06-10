import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { useTranslation } from 'react-i18next'
import { trackEvent } from '../lib/telemetry'

const BRAND_ORANGE_RGB = '249, 115, 22'
const BRAND_ORANGE_DARK = '#ea580c'

const DAY_BUTTON_CLASSES =
  'relative inline-flex h-10 w-10 min-h-10 min-w-10 max-h-10 max-w-10 aspect-square box-border cursor-pointer items-center justify-center rounded-md p-0 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-[background-color,transform,color] duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-slate-300 dark:disabled:text-slate-600 disabled:opacity-60 disabled:active:scale-100'

const SELECTED_OUTLINE_CLASS =
  `bg-transparent text-slate-900 dark:text-slate-100 shadow-[inset_0_0_0_2px_${BRAND_ORANGE_DARK}]`

const SHARED_CLASS_NAMES = {
  root: 'rdp-root w-full',
  months: 'relative flex flex-col w-fit mx-auto',
  month: 'w-fit space-y-3',
  month_caption: 'relative flex items-center justify-center py-2',
  caption_label: 'pointer-events-none relative z-0 text-base font-semibold text-slate-900 dark:text-slate-100',
  nav: 'absolute inset-x-0 z-10 flex items-center justify-between px-1',
  button_previous: 'pointer-events-auto cursor-pointer h-8 w-8 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150 disabled:pointer-events-none',
  button_next: 'pointer-events-auto cursor-pointer h-8 w-8 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors duration-150',
  month_grid: 'w-full border-collapse',
  weekdays: 'grid grid-cols-7 gap-1',
  weekday: 'py-1 text-center text-xs font-semibold text-slate-600 dark:text-slate-400',
  week: 'grid grid-cols-7 gap-x-1 mb-[2px] last:mb-0',
  day: 'flex items-center justify-center p-0',
  day_button: DAY_BUTTON_CLASSES,
  selected: 'text-slate-900 dark:text-slate-100 font-semibold',
  disabled: 'text-slate-300 dark:text-slate-600',
  today: 'text-slate-800 dark:text-slate-200',
  outside: 'text-slate-300 dark:text-slate-600',
}

const RANGE_CLASS_NAMES = {
  ...SHARED_CLASS_NAMES,
  range_start: 'text-slate-900 dark:text-slate-100 font-semibold',
  range_middle: 'text-slate-900 dark:text-slate-100 font-semibold',
  range_end: 'text-slate-900 dark:text-slate-100 font-semibold',
}

// Context used by module-level components to access per-render calendar state
// without being recreated on every render (which would cause DayPicker to
// unmount/remount all buttons and drop in-flight click events).
const CalendarCtx = createContext(null)

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

function monthKeyToDate(monthKey) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthKey ?? ''))) {
    return null
  }

  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

// Stable module-level component — never recreated, reads live data from context.
function CalendarDayButton(props) {
  const { mode, readOnly, availabilityCountByDate, safeTotalUsers, tapPulseKey, setTapPulseKey, t } =
    useContext(CalendarCtx)
  const { day, modifiers, children, className, ...buttonProps } = props
  const dateKey = toDateKey(day.date)
  const availableUsers = availabilityCountByDate[dateKey] ?? 0
  const isFullyMatched = safeTotalUsers > 0 && availableUsers === safeTotalUsers

  const opacity = (() => {
    if (availableUsers <= 0) return 0
    const ratio = clamp(availableUsers / safeTotalUsers, 0, 1)
    if (ratio >= 1) return 0.32
    return Math.max(0.04, ratio * 0.2)
  })()

  const heatmapStyle =
    opacity > 0 ? { backgroundColor: `rgba(${BRAND_ORANGE_RGB}, ${opacity})` } : undefined

  const isSelected = Boolean(modifiers?.selected || modifiers?.existingSelection)
  const isRangeStart = Boolean(modifiers?.range_start)
  const isRangeMiddle = Boolean(modifiers?.range_middle)
  const isRangeEnd = Boolean(modifiers?.range_end)

  let selectionClass = ''

  if (mode === 'range') {
    if (isRangeStart || isRangeMiddle || isRangeEnd || isSelected) {
      selectionClass = `${SELECTED_OUTLINE_CLASS} rounded-md`
    }
  } else if (isSelected) {
    selectionClass = `${SELECTED_OUTLINE_CLASS} rounded-md`
  }

  const tapAnimationClass =
    tapPulseKey === dateKey ? 'animate-[day-tap-pop_240ms_cubic-bezier(0.2,0.9,0.3,1)]' : ''
  const readOnlyClass = readOnly ? 'cursor-default' : ''
  const mergedClassName = [className, selectionClass, tapAnimationClass, readOnlyClass].filter(Boolean).join(' ')

  return (
    <button
      {...buttonProps}
      onClick={(event) => {
        if (readOnly) return

        trackEvent('calendar_day_clicked', {
          date_key: dateKey,
          mode,
          available_count: availableUsers,
          was_selected: isSelected,
        })

        setTapPulseKey('')
        window.requestAnimationFrame(() => {
          setTapPulseKey(dateKey)
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
      style={{ ...heatmapStyle, ...buttonProps.style }}
      className={mergedClassName}
    >
      {availableUsers > 0 && (
        <span
          className={`pointer-events-none absolute -left-1 -top-1 rounded-sm border px-0.5 text-[8px] font-semibold leading-none shadow-sm transition-colors duration-150 ${
            isFullyMatched
              ? 'border-orange-700 bg-orange-600 text-white'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
          title={isFullyMatched ? t('groupAvailability.topMatch') : undefined}
        >
          {availableUsers}/{safeTotalUsers}
        </span>
      )}
      {children}
    </button>
  )
}

// Stable module-level component — no component state needed.
function NavigationButton(props) {
  const { onPointerDown, ...buttonProps } = props
  const ariaDisabled = buttonProps['aria-disabled']
  const isDisabled = Boolean(buttonProps.disabled || ariaDisabled === true || ariaDisabled === 'true')
  const ariaLabel = String(buttonProps['aria-label'] ?? '')
  const isPreviousButton = /previous/i.test(ariaLabel)

  if (isPreviousButton && isDisabled) {
    return <span className="h-8 w-8" aria-hidden="true" />
  }

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

// Stable object — same reference on every render, prevents DayPicker remounting buttons.
const PICKER_COMPONENTS = {
  DayButton: CalendarDayButton,
  PreviousMonthButton: NavigationButton,
  NextMonthButton: NavigationButton,
}

function AvailabilityCalendar({ selectedDates, groupedAvailability, totalUsers, lockedMonth, onChange, readOnly = false }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('multiple')
  const [rangeDraft, setRangeDraft] = useState(undefined)
  const [tapPulseKey, setTapPulseKey] = useState('')

  const fixedMonthDate = useMemo(() => monthKeyToDate(lockedMonth), [lockedMonth])
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])
  const currentMonthStart = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }, [today])
  const effectiveFixedMonthDate = useMemo(() => {
    if (!fixedMonthDate) return null
    return fixedMonthDate >= currentMonthStart ? fixedMonthDate : null
  }, [fixedMonthDate, currentMonthStart])

  const selectedCount = selectedDates.length
  const selectedDateObjects = selectedDates.map((date) => fromDateKey(date))
  const safeTotalUsers = Math.max(totalUsers || 0, 1)

  const availabilityCountByDate = useMemo(() => {
    return Object.entries(groupedAvailability).reduce((accumulator, [dateKey, users]) => {
      accumulator[dateKey] = users.length
      return accumulator
    }, {})
  }, [groupedAvailability])

  const sharedPickerProps = useMemo(() => ({
    animate: true,
    month: effectiveFixedMonthDate ?? undefined,
    defaultMonth: effectiveFixedMonthDate ?? currentMonthStart,
    startMonth: currentMonthStart,
    fromMonth: effectiveFixedMonthDate ?? currentMonthStart,
    toMonth: effectiveFixedMonthDate ?? undefined,
    disableNavigation: Boolean(effectiveFixedMonthDate),
    hideNavigation: Boolean(effectiveFixedMonthDate),
    disabled: { before: today },
    className: 'mt-6',
  }), [effectiveFixedMonthDate, currentMonthStart, today])

  const ctxValue = useMemo(() => ({
    mode,
    readOnly,
    availabilityCountByDate,
    safeTotalUsers,
    tapPulseKey,
    setTapPulseKey,
    t,
  }), [mode, readOnly, availabilityCountByDate, safeTotalUsers, tapPulseKey, t])

  useEffect(() => {
    if (!tapPulseKey) return

    const timeoutId = window.setTimeout(() => setTapPulseKey(''), 260)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [tapPulseKey])

  return (
    <CalendarCtx.Provider value={ctxValue}>
      <section className="rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <style>
          {`@keyframes rdp-slide-in-from-right { from { opacity: 0.15; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
        @keyframes rdp-slide-out-to-left { from { opacity: 1; transform: translateX(0); } to { opacity: 0.15; transform: translateX(-100%); } }
        @keyframes rdp-slide-in-from-left { from { opacity: 0.15; transform: translateX(-100%); } to { opacity: 1; transform: translateX(0); } }
        @keyframes rdp-slide-out-to-right { from { opacity: 1; transform: translateX(0); } to { opacity: 0.15; transform: translateX(100%); } }
        @keyframes day-tap-pop { 0% { transform: scale(0.9); } 45% { transform: scale(1.08); } 100% { transform: scale(1); } }
      .rdp-caption_after_enter, .rdp-weeks_after_enter { animation: rdp-slide-in-from-right 180ms ease-out both; }
      .rdp-caption_after_exit, .rdp-weeks_after_exit { animation: rdp-slide-out-to-right 180ms ease-in both; }
      .rdp-caption_before_enter, .rdp-weeks_before_enter { animation: rdp-slide-in-from-left 180ms ease-out both; }
      .rdp-caption_before_exit, .rdp-weeks_before_exit { animation: rdp-slide-out-to-left 180ms ease-in both; }
      .rdp-month { overflow: hidden; }`}
        </style>

        <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-[28px]">
          {readOnly ? t('calendar.lockedTitle') : t('calendar.title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {readOnly ? t('calendar.lockedSubtitle') : t('calendar.subtitle')}
        </p>

        {!readOnly && (
          <p
            className={`mt-3 inline-flex rounded-md border px-2.5 py-1 text-xs font-medium transition duration-150 ${
              selectedCount > 0
                ? 'border-orange-500 bg-white dark:bg-slate-900 text-orange-700 dark:text-orange-400'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            {selectedCount === 0
              ? t('calendar.selectedNone')
              : t('calendar.selectedCount', { count: selectedCount })}
          </p>
        )}

        {!readOnly && (
          <div className="mt-6 flex w-full justify-center">
            <div className="relative inline-grid w-full max-w-[300px] grid-cols-2 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-800 p-1">
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-sm bg-orange-500 transition-transform duration-250 ease-out ${
                  mode === 'range' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  setMode('multiple')
                  setRangeDraft(undefined)
                }}
                className={`relative z-10 cursor-pointer h-8 rounded-sm px-3 text-xs font-semibold transition-colors duration-200 ${
                  mode === 'multiple' ? 'text-white' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                className={`relative z-10 cursor-pointer h-8 rounded-sm px-3 text-xs font-semibold transition-colors duration-200 ${
                  mode === 'range' ? 'text-white' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('calendar.dateRange')}
              </button>
            </div>
          </div>
        )}

        {readOnly ? (
          <DayPicker
            {...sharedPickerProps}
            mode="multiple"
            selected={selectedDateObjects}
            onSelect={() => {}}
            components={PICKER_COMPONENTS}
            classNames={SHARED_CLASS_NAMES}
          />
        ) : mode === 'multiple' ? (
          <DayPicker
            {...sharedPickerProps}
            mode="multiple"
            selected={selectedDateObjects}
            onSelect={(nextDates) => {
              const next = (nextDates ?? []).map((date) => toDateKey(date))
              onChange(next)
            }}
            components={PICKER_COMPONENTS}
            classNames={SHARED_CLASS_NAMES}
          />
        ) : (
          <DayPicker
            {...sharedPickerProps}
            mode="range"
            selected={rangeDraft}
            onSelect={(nextRange) => {
              setRangeDraft(nextRange)

              if (!nextRange?.from || !nextRange.to) return

              const start = nextRange.from <= nextRange.to ? nextRange.from : nextRange.to
              const end = nextRange.from <= nextRange.to ? nextRange.to : nextRange.from
              onChange(mergeDateKeys(selectedDates, expandRange(start, end)))
            }}
            modifiers={{ existingSelection: selectedDateObjects }}
            modifiersClassNames={{ existingSelection: 'text-slate-900 dark:text-slate-100 font-semibold' }}
            components={PICKER_COMPONENTS}
            classNames={RANGE_CLASS_NAMES}
          />
        )}
      </section>
    </CalendarCtx.Provider>
  )
}

export default AvailabilityCalendar


