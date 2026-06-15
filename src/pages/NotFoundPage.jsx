import { useTranslation } from 'react-i18next'
import { useNavigate } from '../lib/navigation'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 sm:p-14 shadow-md shadow-slate-200/60 dark:shadow-none text-center">
          <p className="text-7xl font-extrabold text-slate-100 dark:text-slate-800 select-none sm:text-8xl">404</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{t('ui.pageNotFoundTitle')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('ui.pageNotFoundBody')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-8 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-md shadow-orange-300/40 dark:shadow-none transition duration-150 hover:bg-orange-600 active:scale-[0.99]"
          >
            {t('ui.backToHome')}
          </button>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default NotFoundPage
