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

export type PairResult = { ok: true; token: string } | { ok: false; reason: 'offline' | 'denied' | 'busy' | 'blocked' }

const checkTimeoutMs = 4000
const pairTimeoutMs = 125000
const actionTimeoutMs = 100000

export async function pingCoworker(): Promise<boolean> {
  try {
    const response = await fetch(`${coworkerUrl}/ping`, { signal: AbortSignal.timeout(checkTimeoutMs) })
    return response.ok
  } catch {
    return false
  }
}

export async function checkCoworker(token: string | null): Promise<CoworkerCheck> {
  if (!(await pingCoworker())) return { link: 'offline', status: null }
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

export async function pairCoworker(): Promise<PairResult> {
  try {
    const response = await fetch(`${coworkerUrl}/pair`, { method: 'POST', signal: AbortSignal.timeout(pairTimeoutMs) })
    if (response.ok) return { ok: true, token: ((await response.json()) as { token: string }).token }
    if (response.status === 409) return { ok: false, reason: 'busy' }
    if (response.status === 403) {
      const payload = await response.json().catch(() => null)
      return { ok: false, reason: String(payload?.detail ?? '').includes('not allowed to control') ? 'blocked' : 'denied' }
    }
    return { ok: false, reason: 'offline' }
  } catch {
    return { ok: false, reason: 'offline' }
  }
}

export async function unpairCoworker(token: string): Promise<void> {
  try {
    await fetch(`${coworkerUrl}/unpair`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(checkTimeoutMs) })
  } catch {
    return
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
      return { ok: false, error: typeof payload?.detail === 'string' ? payload.detail : `The Co-worker app returned an error (${response.status}).` }
    }
    return (await response.json()) as ActionOutcome
  } catch {
    return { ok: false, error: 'The Co-worker app on this computer did not respond.' }
  }
}
