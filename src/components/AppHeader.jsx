import { useTranslation } from 'react-i18next'
import brandIcon from '../assets/svgS.svg'
import { getTripEmoji } from '../lib/tripEmoji'

function AppHeader({ tripName, wide, children }) {
  const { t } = useTranslation()
  const maxW = wide ? 'max-w-3xl' : 'max-w-2xl'
  const emoji = getTripEmoji(tripName)

  return (
    <header className={`mx-auto mb-8 flex w-full ${maxW} items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm`}>
      <a href="/" className="flex shrink-0 items-center gap-3">
        <img
          src={brandIcon}
          alt=""
          className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain shadow-sm"
        />
        <span className="text-sm font-bold text-slate-900">{t('brand.name')}</span>
      </a>

      {tripName ? (
        <>
          <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
            {emoji && <span className="mr-1.5">{emoji}</span>}
            {tripName}
          </span>
        </>
      ) : (
        <div className="flex-1" />
      )}

      {children}
    </header>
  )
}

export default AppHeader
