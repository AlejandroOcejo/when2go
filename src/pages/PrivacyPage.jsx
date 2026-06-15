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

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            Legal
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Last updated: June 2026</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none space-y-7">

          <Section title="Overview">
            <P>
              voyora is designed with privacy in mind. We don't require any personal information to use the service — no name, email address, or phone number. This policy explains what data we do collect and how we use it.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="What we collect">
            <P>When you use voyora, the following data is stored:</P>
            <Ul items={[
              'Trip data — trip name, participant names (as entered by the organiser), and availability dates.',
              'An anonymous user ID — randomly generated and stored in your browser\'s local storage. It has no connection to your real identity.',
              'Session tokens — stored as HttpOnly cookies to maintain your access between page loads.',
            ]} />
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="What we don't collect">
            <Ul items={[
              'Your real name, email address, phone number, or any other personal identifier.',
              'Payment information — voyora is free.',
              'Location data.',
            ]} />
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Analytics">
            <P>
              We use PostHog to collect anonymised usage analytics (e.g. which features are used, how often trips are created). This data is tied to your anonymous user ID, not to any personal information. You can opt out of analytics by blocking the PostHog domain in your browser.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Third-party services">
            <P>voyora uses the following third-party services:</P>
            <Ul items={[
              'Supabase — database hosting (trip and availability data).',
              'Vercel — web hosting and serverless functions.',
              'PostHog — anonymised analytics.',
            ]} />
            <P>Each service has its own privacy policy. Trip data is stored on Supabase servers in the EU.</P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Data retention & deletion">
            <P>
              Trip data is retained until manually deleted. If you'd like your trip data removed, email us at{' '}
              <a href="mailto:hello@voyora.app" className="font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150">
                hello@voyora.app
              </a>{' '}
              with the trip link and we'll delete it promptly.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Changes to this policy">
            <P>
              We may update this policy from time to time. The "last updated" date at the top of this page will reflect any changes. Continued use of voyora after changes constitutes acceptance of the new policy.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Contact">
            <P>
              Questions about this policy?{' '}
              <a href="/contact" className="font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150">
                Get in touch
              </a>.
            </P>
          </Section>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default PrivacyPage
