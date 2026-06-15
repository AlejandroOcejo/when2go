import { createContext, useContext } from 'react'

export const NavigationContext = createContext(() => {})

export function useNavigate() {
  return useContext(NavigationContext)
}
