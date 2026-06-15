import { useTranslation } from 'react-i18next'
import { useNavigate } from '../lib/navigation'

function NavLink({ href, children }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="cursor-pointer transition duration-150 hover:text-slate-900 dark:hover:text-slate-200"
    >
      {children}
    </button>
  )
}

function AppFooter({ maxWidth = 'max-w-3xl' }) {
  const { t } = useTranslation()

  return (
    <footer className={`mx-auto mt-8 ${maxWidth} pb-2 text-center text-xs text-slate-500 dark:text-slate-500`}>
      <p>{t('footer.tagline')}</p>
      <nav className="mt-2 flex items-center justify-center gap-3 text-slate-500 dark:text-slate-500">
        <NavLink href="/about">{t('footer.about')}</NavLink>
        <span aria-hidden="true">•</span>
        <NavLink href="/contact">{t('footer.contact')}</NavLink>
        <span aria-hidden="true">•</span>
        <NavLink href="/privacy">{t('footer.privacy')}</NavLink>
        <span aria-hidden="true">•</span>
        <NavLink href="/terms">{t('footer.terms')}</NavLink>
      </nav>
    </footer>
  )
}

export default AppFooter
