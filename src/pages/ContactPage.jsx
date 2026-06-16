import { useTranslation } from 'react-i18next'
import { useNavigate } from '../lib/navigation'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

function ContactPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            {t('contact.eyebrow')}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t('contact.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-500 dark:text-slate-400">
            {t('contact.subtitle')}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none">
          <h2 className="border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-5">
            {t('contact.emailTitle')}
          </h2>

          <a
            href="mailto:hello@voyora.app"
            className="group inline-flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-3.5 transition duration-150 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 shrink-0" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition duration-150">
              hello@voyora.app
            </span>
          </a>

          <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('contact.emailReply')}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none">
          <h2 className="border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            {t('contact.privacyTitle')}
          </h2>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t('contact.privacyBody')}{' '}
            {t('contact.privacySeeOur')}{' '}
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="cursor-pointer font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150"
            >
              {t('contact.privacyPolicyLink')}
            </button>
            {' '}{t('contact.privacyForMore')}
          </p>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default ContactPage
