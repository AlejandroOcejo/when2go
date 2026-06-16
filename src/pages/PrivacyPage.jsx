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

function Ul({ items }) {
  return (
    <ul className="list-disc list-inside space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-slate-600 dark:text-slate-400">{item}</li>
      ))}
    </ul>
  )
}

function Divider() {
  return <div className="h-px bg-slate-100 dark:bg-slate-800" />
}

function PrivacyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            {t('privacy.eyebrow')}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t('privacy.title')}
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('privacy.lastUpdated')}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none space-y-7">

          <Section title={t('privacy.overviewTitle')}>
            <P>{t('privacy.overviewBody')}</P>
          </Section>

          <Divider />

          <Section title={t('privacy.collectTitle')}>
            <P>{t('privacy.collectIntro')}</P>
            <Ul items={[t('privacy.collectItem1'), t('privacy.collectItem2'), t('privacy.collectItem3')]} />
          </Section>

          <Divider />

          <Section title={t('privacy.notCollectTitle')}>
            <Ul items={[t('privacy.notCollectItem1'), t('privacy.notCollectItem2'), t('privacy.notCollectItem3')]} />
          </Section>

          <Divider />

          <Section title={t('privacy.analyticsTitle')}>
            <P>{t('privacy.analyticsBody')}</P>
          </Section>

          <Divider />

          <Section title={t('privacy.thirdPartyTitle')}>
            <P>{t('privacy.thirdPartyIntro')}</P>
            <Ul items={[t('privacy.thirdPartyItem1'), t('privacy.thirdPartyItem2'), t('privacy.thirdPartyItem3')]} />
            <P>{t('privacy.thirdPartyOutro')}</P>
          </Section>

          <Divider />

          <Section title={t('privacy.retentionTitle')}>
            <P>
              {t('privacy.retentionBefore')}{' '}
              <a href="mailto:hello@voyora.app" className="font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150">
                hello@voyora.app
              </a>
              {' '}{t('privacy.retentionAfter')}
            </P>
          </Section>

          <Divider />

          <Section title={t('privacy.changesTitle')}>
            <P>{t('privacy.changesBody')}</P>
          </Section>

          <Divider />

          <Section title={t('privacy.contactTitle')}>
            <P>
              {t('privacy.contactBefore')}{' '}
              <button
                type="button"
                onClick={() => navigate('/contact')}
                className="cursor-pointer font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150"
              >
                {t('privacy.contactLink')}
              </button>.
            </P>
          </Section>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default PrivacyPage
