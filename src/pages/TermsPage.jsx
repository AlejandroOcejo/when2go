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

function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
      <AppHeader />

      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">
            Legal
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Last updated: June 2026</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-md shadow-slate-200/60 dark:shadow-none space-y-7">

          <Section title="Acceptance of terms">
            <P>
              By accessing or using voyora ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Description of service">
            <P>
              voyora is a group trip date coordination tool. It allows users to create trips, share availability, and identify overlapping dates without requiring accounts or personal information.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Acceptable use">
            <P>You agree not to:</P>
            <ul className="list-disc list-inside space-y-1">
              <li className="text-sm text-slate-600 dark:text-slate-400">Use the Service for any unlawful purpose or in violation of any regulations.</li>
              <li className="text-sm text-slate-600 dark:text-slate-400">Attempt to gain unauthorised access to the Service or its underlying systems.</li>
              <li className="text-sm text-slate-600 dark:text-slate-400">Interfere with or disrupt the integrity or performance of the Service.</li>
              <li className="text-sm text-slate-600 dark:text-slate-400">Transmit any malicious code or use the Service to harm others.</li>
            </ul>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="User content">
            <P>
              You are responsible for the content you submit (trip names, participant names, dates). By submitting content, you confirm it doesn't violate any applicable laws or third-party rights. We reserve the right to remove content that violates these terms.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Disclaimer of warranties">
            <P>
              The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Limitation of liability">
            <P>
              To the fullest extent permitted by law, voyora and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of (or inability to use) the Service.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Changes to these terms">
            <P>
              We may update these terms from time to time. The "last updated" date at the top of this page reflects the most recent revision. Continued use of the Service after changes constitutes acceptance of the new terms.
            </P>
          </Section>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

          <Section title="Contact">
            <P>
              Questions about these terms?{' '}
              <a href="/contact" className="font-medium text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition duration-150">
                Contact us
              </a>.
            </P>
          </Section>
        </div>
      </div>

      <AppFooter maxWidth="max-w-3xl" />
    </main>
  )
}

export default TermsPage
