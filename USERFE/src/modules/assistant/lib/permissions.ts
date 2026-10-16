import type { ActionRisk } from '../types'

export type PermissionMode = 'ask_all' | 'ask_important' | 'allow_all'

export interface PermissionOption {
  id: PermissionMode
  label: string
  short: string
  description: string
}

export const permissionOptions: PermissionOption[] = [
  {
    id: 'ask_all',
    label: 'Ask me for every action',
    short: 'Ask every time',
    description: 'Every step waits for your Allow. The safest choice.',
  },
  {
    id: 'ask_important',
    label: 'Ask only for important actions',
    short: 'Ask for important',
    description: 'Looking, scrolling, clicking, typing and chatting in the Co-worker browser (for example testing a chatbot) run by themselves. It asks before opening files or apps on your computer and before creating anything.',
  },
  {
    id: 'allow_all',
    label: 'Allow everything except creating',
    short: 'Allow all',
    description: 'Everything runs by itself. It still asks before it creates or submits anything.',
  },
]

export const defaultPermissionMode: PermissionMode = 'ask_important'

export function isPermissionMode(value: unknown): value is PermissionMode {
  return permissionOptions.some((option) => option.id === value)
}

export function asksFirst(mode: PermissionMode, risk: ActionRisk): boolean {
  if (risk === 'high') return true
  if (mode === 'ask_all') return true
  if (mode === 'ask_important') return risk !== 'low'
  return false
}

export function modeNote(mode: PermissionMode): string {
  if (mode === 'ask_all') return 'Asks before every action'
  if (mode === 'ask_important') return 'Asks only for important actions'
  return 'Allowed, asks before creating'
}