import AppHeader from '../components/AppHeader'
import AppFooter from '../components/AppFooter'

function Step({ number, title, body }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      </div>
    </div>
  )
}

function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            About
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Finding dates that work for everyone.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
            voyora is a simple, account-free tool for group trip coordination. No spreadsheets, no back-and-forth messages — just a shared link and a calendar.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none">
          <h2 className="border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-5">
            How it works
          </h2>
          <div className="space-y-5">
            <Step
              number="1"
              title="Create a trip"
              body="Give your trip a name and add the names of everyone joining — no email addresses or accounts required."
            />
            <Step
              number="2"
              title="Share the link"
              body="You get a short, shareable link. Send it via WhatsApp, iMessage, email — however works best for your group."
            />
            <Step
              number="3"
              title="Everyone picks their dates"
              body="Each person opens the link, selects their name, and taps the days they're available. Takes about 30 seconds."
            />
            <Step
              number="4"
              title="See the overlap instantly"
              body="voyora highlights the days that work for the most people, so you can lock in dates and start planning."
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-md shadow-slate-200/60 dark:shadow-none">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">Zero accounts</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Access is controlled by a passcode. We don't ask for your email, name, or any personal information.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-md shadow-slate-200/60 dark:shadow-none">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.22 1.18 2 2 0 012.2 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.62-.62a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">Invite only</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Only people with the link and passcode can join a trip. Your availability data stays private to the group.
            </p>
          </div>
        </div>

        <div className="pt-2 text-center">
          <a
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-md shadow-orange-300/40 dark:shadow-none transition duration-150 hover:bg-orange-600 active:scale-[0.99]"
          >
            Create a trip
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default AboutPage
