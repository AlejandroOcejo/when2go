import { useTranslation } from 'react-i18next'
import { useNavigate } from '../lib/navigation'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

function ErrorPage({ error, onReset }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 sm:p-14 shadow-md shadow-slate-200/60 dark:shadow-none text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('ui.errorTitle')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('ui.errorBody')}
          </p>

          {message && (
            <p className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-mono text-slate-500 dark:text-slate-400 text-left break-all">
              {message}
            </p>
          )}

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-md shadow-orange-300/40 dark:shadow-none transition duration-150 hover:bg-orange-600 active:scale-[0.99]"
              >
                {t('ui.tryAgain')}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 text-sm font-semibold text-slate-700 dark:text-slate-300 transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t('ui.backToHome')}
            </button>
          </div>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default ErrorPage
