import { useCallback, useEffect, useState } from 'react'
import { defaultPermissionMode, isPermissionMode, type PermissionMode } from '../lib/permissions'
import { checkCoworker, pairCoworker, unpairCoworker, type CoworkerLink, type CoworkerStatus } from '../services/coworkerClient'

const tokenKey = 'workzen.coworker.token'
const enabledKey = 'workzen.coworker.enabled'
const modeKey = 'workzen.coworker.permissions'
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

export type ConnectResult = 'connected' | 'offline' | 'denied' | 'busy' | 'blocked'

export function useCoworker() {
  const [token, setToken] = useState<string | null>(() => readStored(tokenKey))
  const [enabled, setEnabledState] = useState(() => readStored(enabledKey) === 'on' && readStored(tokenKey) !== null)
  const [mode, setModeState] = useState<PermissionMode>(() => {
    const stored = readStored(modeKey)
    return isPermissionMode(stored) ? stored : defaultPermissionMode
  })
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

  const setMode = useCallback((value: PermissionMode) => {
    setModeState(value)
    writeStored(modeKey, value)
  }, [])

  const connect = useCallback(async (): Promise<ConnectResult> => {
    const paired = await pairCoworker()
    if (!paired.ok) return paired.reason
    setToken(paired.token)
    writeStored(tokenKey, paired.token)
    const result = await checkCoworker(paired.token)
    setLink(result.link)
    setStatus(result.status)
    if (result.link !== 'connected') return 'offline'
    setEnabled(true)
    return 'connected'
  }, [setEnabled])

  const disconnect = useCallback(async () => {
    if (token) await unpairCoworker(token)
    setToken(null)
    writeStored(tokenKey, null)
    setEnabled(false)
    setStatus(null)
    setLink('unauthorized')
  }, [token, setEnabled])

  return { token, enabled, mode, setMode, link, status, connected: link === 'connected', setEnabled, connect, disconnect, recheck }
}

export type CoworkerState = ReturnType<typeof useCoworker>
