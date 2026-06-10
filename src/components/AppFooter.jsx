import { useTranslation } from 'react-i18next'

function AppFooter({ maxWidth = 'max-w-3xl' }) {
  const { t } = useTranslation()

  return (
    <footer className={`mx-auto mt-8 ${maxWidth} pb-2 text-center text-xs text-slate-500 dark:text-slate-500`}>
      <p>{t('footer.tagline')}</p>
      <nav className="mt-2 flex items-center justify-center gap-3 text-slate-500 dark:text-slate-500">
        <a href="/about" className="transition duration-150 hover:text-slate-900 dark:hover:text-slate-200">{t('footer.about')}</a>
        <span aria-hidden="true">•</span>
        <a href="/contact" className="transition duration-150 hover:text-slate-900 dark:hover:text-slate-200">{t('footer.contact')}</a>
        <span aria-hidden="true">•</span>
        <a href="/privacy" className="transition duration-150 hover:text-slate-900 dark:hover:text-slate-200">{t('footer.privacy')}</a>
        <span aria-hidden="true">•</span>
        <a href="/terms" className="transition duration-150 hover:text-slate-900 dark:hover:text-slate-200">{t('footer.terms')}</a>
      </nav>
    </footer>
  )
}

export default AppFooter


