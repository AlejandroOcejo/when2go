import { useTranslation } from 'react-i18next'
import brandIcon from '../assets/svgS.svg'

function TripLoadingSkeleton() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mx-auto mb-5 flex w-full max-w-3xl items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <img src={brandIcon} alt="" className="h-8 w-8 rounded-lg border border-slate-400 bg-white object-contain" />
          <span>{t('brand.name')}</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" aria-hidden="true" />
          {t('trip.loading')}
        </span>
      </header>

      <section className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
        <div className="h-7 w-2/3 animate-pulse rounded-md bg-slate-200" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" aria-hidden="true" />
          {t('trip.loading')}
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="aspect-square w-full max-w-10 justify-self-center animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
        <div className="h-5 w-52 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    </main>
  )
}

export default TripLoadingSkeleton
