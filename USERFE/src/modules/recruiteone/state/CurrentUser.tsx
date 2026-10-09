import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { isHrPerson, people } from '../data/people'
import type { Person } from '../types'

interface CurrentUserValue {
  user: Person
  isHr: boolean
  switchUser: (id: string) => void
}

const storageKey = 'workzen.current-user'
const defaultUserId = 'p-004'

const CurrentUserContext = createContext<CurrentUserValue | null>(null)

function loadUserId() {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored && people.some((person) => person.id === stored)) return stored
  } catch {
    return defaultUserId
  }
  return defaultUserId
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(loadUserId)

  const switchUser = useCallback((id: string) => {
    setUserId(id)
    try {
      window.localStorage.setItem(storageKey, id)
    } catch {
      return
    }
  }, [])

  const value = useMemo(() => {
    const user = people.find((person) => person.id === userId) ?? people[0]
    return { user, isHr: isHrPerson(user), switchUser }
  }, [userId, switchUser])

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser() {
  const value = useContext(CurrentUserContext)
  if (!value) throw new Error('useCurrentUser must be used inside CurrentUserProvider')
  return value
}
