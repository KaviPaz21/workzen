import { useCallback, useEffect, useState } from 'react'
import { checkCoworker, type CoworkerLink, type CoworkerStatus } from '../services/coworkerClient'

const tokenKey = 'workzen.coworker.token'
const enabledKey = 'workzen.coworker.enabled'
const recheckMs = 20000

function readStored(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

export function useCoworker() {
  const [token, setToken] = useState<string | null>(() => readStored(tokenKey))
  const [enabled, setEnabledState] = useState(() => readStored(enabledKey) === 'on' && readStored(tokenKey) !== null)
  const [link, setLink] = useState<CoworkerLink>('unknown')
  const [status, setStatus] = useState<CoworkerStatus | null>(null)

  const recheck = useCallback(
    async (candidate: string | null = token) => {
      const result = await checkCoworker(candidate)
      setLink(result.link)
      setStatus(result.status)
      return result
    },
    [token],
  )

  useEffect(() => {
    void recheck()
    const timer = window.setInterval(() => void recheck(), recheckMs)
    const onFocus = () => void recheck()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [recheck])

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value)
    writeStored(enabledKey, value ? 'on' : null)
  }, [])

  const connect = useCallback(
    async (code: string) => {
      const candidate = code.trim()
      const result = await checkCoworker(candidate)
      setLink(result.link)
      setStatus(result.status)
      if (result.link === 'connected') {
        setToken(candidate)
        writeStored(tokenKey, candidate)
        setEnabled(true)
      }
      return result.link
    },
    [setEnabled],
  )

  const disconnect = useCallback(() => {
    setToken(null)
    writeStored(tokenKey, null)
    setEnabled(false)
    setStatus(null)
    setLink('unauthorized')
  }, [setEnabled])

  return { token, enabled, link, status, connected: link === 'connected', setEnabled, connect, disconnect, recheck }
}

export type CoworkerState = ReturnType<typeof useCoworker>
