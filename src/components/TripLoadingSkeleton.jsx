import { useTranslation } from 'react-i18next'

function TripLoadingSkeleton() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mx-auto mb-8 flex w-full max-w-3xl items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 shadow-sm shadow-slate-200/80 dark:shadow-none">
        <div className="flex shrink-0 items-center">
          <img src="/favicon.png" alt="" className="h-11 w-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 object-contain shadow-sm" />
        </div>
        <div className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        <div className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-6 w-16 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      </header>

      <section className="mx-auto max-w-3xl rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-7">
        <div className="h-7 w-2/3 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" aria-hidden="true" />
          {t('trip.loading')}
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-7">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, index) => (
            <div key={index} className="aspect-square w-full max-w-10 justify-self-center animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-3xl rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-7">
        <div className="h-5 w-52 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </section>
    </main>
  )
}

export default TripLoadingSkeleton


