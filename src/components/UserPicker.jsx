import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { inputSmCls, labelCls } from '../lib/tokens'

const MAX_PARTICIPANT_NAME_LENGTH = 24

function UserPicker({ users, onSelect, onAddParticipant, addDisabled = false }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed || isAdding) return

    setError('')

    try {
      setIsAdding(true)
      const user = await onAddParticipant(trimmed)
      setName('')
      if (user?.id) onSelect(user.id)
    } catch (err) {
      const message = String(err?.message ?? '')

      if (message.includes('participant_name_taken')) {
        setError(t('userPicker.nameTaken'))
      } else if (message.includes('too_many_participants')) {
        setError(t('userPicker.tooManyParticipants'))
      } else if (message.includes('trip_closed')) {
        setError(t('userPicker.tripClosed'))
      } else {
        setError(t('userPicker.addError'))
      }
    } finally {
      setIsAdding(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleAdd()
  }

  const showEmptyClosedMessage = addDisabled && users.length === 0

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-md shadow-slate-200/70 dark:shadow-none sm:p-7">
      <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('userPicker.subtitle')}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{t('userPicker.title')}</h2>

      {showEmptyClosedMessage ? (
        <p className="mt-5 text-sm text-slate-600 dark:text-slate-400">{t('trip.noParticipantsBody')}</p>
      ) : (
        <>
          {users.length > 0 && (
            <div className="mt-5 grid gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSelect(user.id)}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-left text-sm text-slate-800 dark:text-slate-200 transition duration-150 hover:border-orange-200 dark:hover:border-orange-900 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 active:scale-[0.99]"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-orange-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden="true" />
                  <span className="font-medium">{user.name}</span>
                  {user.confirmedAt && (
                    <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Ready</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!addDisabled && (
            <div className={`${users.length > 0 ? 'mt-5 border-t border-slate-100 dark:border-slate-800 pt-5' : 'mt-5'}`}>
              <label htmlFor="add-participant-name" className={labelCls}>
                {t('userPicker.notListedLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="add-participant-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('userPicker.addPlaceholder')}
                  maxLength={MAX_PARTICIPANT_NAME_LENGTH}
                  disabled={isAdding}
                  className={inputSmCls}
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isAdding || !name.trim()}
                  className="h-10 shrink-0 cursor-pointer rounded-lg bg-slate-100 dark:bg-slate-800/80 border-2 border-transparent px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 transition duration-150 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAdding ? t('userPicker.adding') : t('userPicker.add')}
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default UserPicker
