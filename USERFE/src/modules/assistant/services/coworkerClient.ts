import type { ActionOutcome } from '../types'

export const coworkerUrl: string = (import.meta.env.VITE_COWORKER_URL as string | undefined) ?? 'http://127.0.0.1:8765'

export type CoworkerLink = 'unknown' | 'connected' | 'offline' | 'unauthorized'

export interface CoworkerStatus {
  name: string
  version: string
  workspace: string
  launch_apps: boolean
  actions: string[]
}

export interface CoworkerCheck {
  link: CoworkerLink
  status: CoworkerStatus | null
}

const checkTimeoutMs = 4000
const actionTimeoutMs = 100000

export async function checkCoworker(token: string | null): Promise<CoworkerCheck> {
  try {
    const ping = await fetch(`${coworkerUrl}/ping`, { signal: AbortSignal.timeout(checkTimeoutMs) })
    if (!ping.ok) return { link: 'offline', status: null }
  } catch {
    return { link: 'offline', status: null }
  }
  if (!token) return { link: 'unauthorized', status: null }
  try {
    const response = await fetch(`${coworkerUrl}/status`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(checkTimeoutMs) })
    if (response.status === 401 || response.status === 403) return { link: 'unauthorized', status: null }
    if (!response.ok) return { link: 'offline', status: null }
    return { link: 'connected', status: (await response.json()) as CoworkerStatus }
  } catch {
    return { link: 'offline', status: null }
  }
}

export async function runCoworkerAction(token: string, tool: string, args: Record<string, unknown>): Promise<ActionOutcome> {
  try {
    const response = await fetch(`${coworkerUrl}/actions/${tool}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ args }),
      signal: AbortSignal.timeout(actionTimeoutMs),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      return { ok: false, error: typeof payload?.detail === 'string' ? payload.detail : `The Co-worker helper returned an error (${response.status}).` }
    }
    return (await response.json()) as ActionOutcome
  } catch {
    return { ok: false, error: 'The Co-worker helper on this computer did not respond.' }
  }
}
