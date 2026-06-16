import { useTranslation } from 'react-i18next'
import { useNavigate } from '../lib/navigation'

function CookieConsent({ onAccept, onReject }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6">
      <style>{`@keyframes cookie-banner-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl shadow-slate-300/40 dark:shadow-slate-950/60 sm:flex-row sm:items-center sm:gap-4"
        style={{ animation: 'cookie-banner-in 280ms cubic-bezier(0.2,0.9,0.3,1) both' }}
      >
        <div className="flex-1">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('cookieConsent.body')}</p>
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="mt-1 cursor-pointer text-sm font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150"
          >
            {t('cookieConsent.privacyLink')}
          </button>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onReject}
            className="cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition duration-150 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t('cookieConsent.reject')}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600 active:scale-[0.99]"
          >
            {t('cookieConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CookieConsent
