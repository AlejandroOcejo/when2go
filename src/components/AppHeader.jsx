import { useTranslation } from 'react-i18next'
import { getTripEmoji } from '../lib/tripEmoji'
import { useDarkMode } from '../lib/darkMode'
import { useNavigate } from '../lib/navigation'

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function AppHeader({ tripName, children }) {
  const { t } = useTranslation()
  const { isDark, toggle } = useDarkMode()
  const navigate = useNavigate()
  const emoji = getTripEmoji(tripName)

  return (
    <>
    <header className="mx-auto mb-8 flex w-full max-w-3xl items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 shadow-sm shadow-slate-200/80 dark:shadow-none">
      <button type="button" onClick={() => navigate('/')} className="flex shrink-0 items-center gap-3 cursor-pointer">
        <img
          src="/favicon.png"
          alt={t('brand.name')}
          className="h-11 w-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 object-contain shadow-sm transition-all duration-200 hover:ring-2 hover:ring-orange-300 dark:hover:ring-orange-700 hover:ring-offset-1"
        />
        {!tripName && (
          <span className="text-base font-extrabold tracking-tight text-white">
            {t('brand.name')}
          </span>
        )}
      </button>

      {tripName ? (
        <>
          <div className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 dark:text-slate-100">
            {emoji && <span className="mr-2">{emoji}</span>}
            {tripName}
          </span>
        </>
      ) : (
        <div className="flex-1" />
      )}

      {children}

      <button
        type="button"
        onClick={toggle}
        className="shrink-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
        title={isDark ? t('ui.switchToLight') : t('ui.switchToDark')}
        aria-label={isDark ? t('ui.switchToLight') : t('ui.switchToDark')}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
    <div id="main-content" tabIndex="-1" aria-hidden="true" />
    </>
  )
}

export default AppHeader



