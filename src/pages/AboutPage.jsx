import { useTranslation } from 'react-i18next'
import { useNavigate } from '../lib/navigation'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

function Step({ number, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      </div>
    </div>
  )
}

function AboutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            {t('about.eyebrow')}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t('about.title')}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
            {t('about.subtitle')}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none">
          <h2 className="border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-5">
            {t('about.howItWorksTitle')}
          </h2>
          <div className="space-y-5">
            <Step number="1" title={t('about.step1Title')} body={t('about.step1Body')} />
            <Step number="2" title={t('about.step2Title')} body={t('about.step2Body')} />
            <Step number="3" title={t('about.step3Title')} body={t('about.step3Body')} />
            <Step number="4" title={t('about.step4Title')} body={t('about.step4Body')} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-md shadow-slate-200/60 dark:shadow-none">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">{t('about.feature1Title')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t('about.feature1Body')}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-md shadow-slate-200/60 dark:shadow-none">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.2 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.62-.62a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">{t('about.feature2Title')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t('about.feature2Body')}</p>
          </div>
        </div>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-md shadow-orange-300/40 dark:shadow-none transition duration-150 hover:bg-orange-600 active:scale-[0.99]"
          >
            {t('about.cta')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default AboutPage
