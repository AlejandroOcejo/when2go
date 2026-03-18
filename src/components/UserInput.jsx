import { useState } from 'react'

function UserInput({ initialName, onSubmit, userColor }) {
  const [name, setName] = useState(initialName ?? '')

  function handleSubmit(event) {
    event.preventDefault()

    const trimmed = name.trim()

    if (!trimmed) {
      return
    }

    onSubmit(trimmed)
  }

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      onSubmit={handleSubmit}
    >
      <h2 className="text-xl font-semibold text-slate-900">Who are you?</h2>
      <p className="mt-1 text-sm text-slate-600">No login needed. Pick a display name for this browser.</p>
      <label htmlFor="display-name" className="mt-4 block text-sm font-medium text-slate-800">
        Display name
      </label>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{
            backgroundColor: userColor,
          }}
          aria-hidden="true"
        />
        <input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Alex"
          maxLength={24}
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          autoFocus
          required
        />
      </div>
      <button
        type="submit"
        className="mt-4 h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Continue
      </button>
    </form>
  )
}

export default UserInput
