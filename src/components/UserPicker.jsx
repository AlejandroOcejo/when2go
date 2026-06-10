import { useTranslation } from 'react-i18next'

function UserPicker({ users, onSelect }) {
  const { t } = useTranslation()

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-md shadow-slate-200/70 dark:shadow-none sm:p-7">
      <p className="inline-flex border-l-2 border-orange-500 pl-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('userPicker.subtitle')}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{t('userPicker.title')}</h2>

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
    </section>
  )
}

export default UserPicker

