import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { storeAccessToken, verifyAccessCode } from '../lib/supabaseBackend'
import { inputCls } from '../lib/tokens'

function AccessGate({ onAccessGranted }) {
  const { t } = useTranslation()
  const [accessCodeInput, setAccessCodeInput] = useState('')
  const [accessError, setAccessError] = useState('')
  const [isVerifyingAccess, setIsVerifyingAccess] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    const entered = accessCodeInput.trim()

    if (!entered) {
      setAccessError('Enter a passcode to continue.')
      return
    }

    if (isVerifyingAccess) {
      return
    }

    try {
      setIsVerifyingAccess(true)
      const accessToken = await verifyAccessCode(entered)

      if (!accessToken) {
        setAccessError('Invalid passcode.')
        return
      }

      storeAccessToken(accessToken)
      setAccessError('')
      setAccessCodeInput('')
      onAccessGranted()
    } catch (error) {
      console.error(error)
      setAccessError('Unable to verify passcode right now. Please try again.')
    } finally {
      setIsVerifyingAccess(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:px-6 sm:py-10">
      <section className="mx-auto max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-7 shadow-md shadow-slate-200/70 dark:shadow-none sm:p-8">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Private Access</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">Enter passcode</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          This app is protected with a shared passcode.
        </p>

        <form className="mt-6 flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            type="password"
            autoComplete="off"
            value={accessCodeInput}
            onChange={(event) => {
              setAccessCodeInput(event.target.value)
              if (accessError) {
                setAccessError('')
              }
            }}
            className={inputCls}
            placeholder="Passcode"
          />

          {accessError && <p className="text-xs font-medium text-rose-700 dark:text-rose-400">{accessError}</p>}

          <button
            type="submit"
            disabled={isVerifyingAccess}
            className="h-12 cursor-pointer rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm shadow-orange-200 dark:shadow-none transition duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-orange-300 disabled:shadow-none"
          >
            {isVerifyingAccess ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AccessGate

