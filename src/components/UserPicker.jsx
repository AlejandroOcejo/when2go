import { useTranslation } from 'react-i18next'

function UserPicker({ users, onSelect }) {
  const { t } = useTranslation()

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-6 sm:p-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">{t('userPicker.title')}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('userPicker.subtitle')}</p>

      <div className="mt-4 grid gap-2.5">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user.id)}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-800 transition duration-150 hover:border-slate-500 hover:bg-slate-50 active:scale-[0.99]"
          >
            <span className="font-medium">{user.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default UserPicker
