import { useTranslation } from 'react-i18next'
import { useNavigate } from '../lib/navigation'
import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      {children}
    </div>
  )
}

function P({ children }) {
  return <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{children}</p>
}

function Divider() {
  return <div className="h-px bg-slate-100 dark:bg-slate-800" />
}

function TermsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            {t('terms.eyebrow')}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t('terms.title')}
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('terms.lastUpdated')}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none space-y-7">

          <Section title={t('terms.acceptanceTitle')}>
            <P>{t('terms.acceptanceBody')}</P>
          </Section>

          <Divider />

          <Section title={t('terms.descriptionTitle')}>
            <P>{t('terms.descriptionBody')}</P>
          </Section>

          <Divider />

          <Section title={t('terms.useTitle')}>
            <P>{t('terms.useIntro')}</P>
            <ul className="list-disc list-inside space-y-1">
              {[t('terms.useItem1'), t('terms.useItem2'), t('terms.useItem3'), t('terms.useItem4')].map((item, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-400">{item}</li>
              ))}
            </ul>
          </Section>

          <Divider />

          <Section title={t('terms.contentTitle')}>
            <P>{t('terms.contentBody')}</P>
          </Section>

          <Divider />

          <Section title={t('terms.warrantyTitle')}>
            <P>{t('terms.warrantyBody')}</P>
          </Section>

          <Divider />

          <Section title={t('terms.liabilityTitle')}>
            <P>{t('terms.liabilityBody')}</P>
          </Section>

          <Divider />

          <Section title={t('terms.changesTitle')}>
            <P>{t('terms.changesBody')}</P>
          </Section>

          <Divider />

          <Section title={t('terms.contactTitle')}>
            <P>
              {t('terms.contactBefore')}{' '}
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="cursor-pointer font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150"
              >
                {t('terms.contactLink')}
              </button>.
            </P>
          </Section>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default TermsPage
