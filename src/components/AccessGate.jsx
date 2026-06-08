import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { storeAccessToken, verifyAccessCode } from '../lib/supabaseBackend'

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
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <section className="mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-7 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Private Access</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">Enter passcode</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
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
            className="h-11 rounded-md border border-slate-400 bg-white px-3 text-slate-900 outline-none transition duration-150 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            placeholder="Passcode"
          />

          {accessError && <p className="text-xs font-medium text-rose-700">{accessError}</p>}

          <button
            type="submit"
            disabled={isVerifyingAccess}
            className="h-11 rounded-md bg-orange-500 px-4 text-sm font-semibold text-white transition duration-150 hover:bg-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {isVerifyingAccess ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AccessGate
