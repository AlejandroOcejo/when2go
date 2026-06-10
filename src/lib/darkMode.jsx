import { createContext, useContext, useEffect, useState } from 'react'

const DarkModeContext = createContext(null)

function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function DarkModeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'system')
  const [systemDark, setSystemDark] = useState(getSystemDark)

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    if (theme === 'system') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', theme)
    }
  }, [isDark, theme])

  function toggle() {
    document.documentElement.classList.add('theme-transition')
    setTheme(isDark ? 'light' : 'dark')
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
    }, 300)
  }

  return (
    <DarkModeContext.Provider value={{ isDark, toggle }}>
      {children}
    </DarkModeContext.Provider>
  )
}

export function useDarkMode() {
  const ctx = useContext(DarkModeContext)
  if (!ctx) throw new Error('useDarkMode must be used within DarkModeProvider')
  return ctx
}


