import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trackEvent } from '../lib/telemetry'

function ShareCard({ tripId, tripName, shareLink }) {
  const { t } = useTranslation()
  const [shareCardOpen, setShareCardOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      trackEvent('trip_link_copied', { trip_id: tripId })
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
      <div className="flex items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">
          {tripName}
        </h1>

        <div
          className={`overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out ${
            shareCardOpen
              ? 'pointer-events-none max-w-0 -translate-y-1 opacity-0'
              : 'max-w-[180px] translate-y-0 opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={handleCopyLink}
            className="h-10 rounded-md bg-orange-500 px-3 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600 active:scale-[0.99]"
          >
            {copied ? t('trip.copied') : t('trip.copyLink')}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShareCardOpen((current) => !current)}
          aria-label={shareCardOpen ? t('trip.collapseCard') : t('trip.expandCard')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-400 text-slate-700 transition duration-150 hover:bg-slate-100"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 transition duration-200 ${shareCardOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
      </div>

      <div
        className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
          shareCardOpen
            ? 'mt-4 grid-rows-[1fr] opacity-100'
            : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0">
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            {t('trip.shareSubtitle')}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={shareLink}
              onFocus={(event) => event.target.select()}
              className="h-10 flex-1 rounded-md border border-slate-400 bg-white px-3 text-sm text-slate-800"
              aria-label={t('trip.shareInputAria')}
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`h-10 rounded-md bg-orange-500 px-3 text-sm font-semibold text-white transition-[background-color,transform,opacity] duration-200 ease-out hover:bg-orange-600 active:scale-[0.99] ${
                shareCardOpen
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none -translate-y-1 opacity-0'
              }`}
            >
              {copied ? t('trip.copied') : t('trip.copyLink')}
            </button>
          </div>
          <p className={`mt-2 text-xs transition duration-150 ${copied ? 'text-emerald-700' : 'text-slate-500'}`}>
            {copied ? t('trip.copiedHint') : t('trip.shareHint')}
          </p>
        </div>
      </div>
    </section>
  )
}

export default ShareCard
