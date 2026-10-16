import { Bot, LayoutGrid, SquarePen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { modeNote, type PermissionMode } from '../lib/permissions'
import type { CoworkerLink } from '../services/coworkerClient'
import type { SessionSummary } from '../types'

export interface CoworkerSwitchState {
  enabled: boolean
  link: CoworkerLink
  paired: boolean
  mode: PermissionMode
  outdated: boolean
}

function coworkerNote(state: CoworkerSwitchState) {
  if (!state.paired) return 'Not set up yet'
  if (state.link === 'offline') return 'App is not running'
  if (state.link === 'unauthorized') return 'Needs reconnecting'
  if (state.link === 'unknown') return 'Checking the app…'
  if (state.outdated) return 'Needs updating'
  return state.enabled ? `On. ${modeNote(state.mode)}` : 'Off. App is connected'
}

interface SessionsPanelProps {
  open: boolean
  sessions: SessionSummary[]
  loaded: boolean
  activeId: string | null
  busy: boolean
  onNewChat: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  coworker: CoworkerSwitchState
  onToggleCoworker: () => void
  onSetupCoworker: () => void
  onOpenSkills: () => void
}

const groupOrder = ['Today', 'Yesterday', 'Previous 7 days', 'Older']

function dayNumber(date: Date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

function groupOf(updatedAt: string) {
  const age = dayNumber(new Date()) - dayNumber(new Date(updatedAt))
  if (age <= 0) return 'Today'
  if (age === 1) return 'Yesterday'
  if (age < 8) return 'Previous 7 days'
  return 'Older'
}

export function SessionsPanel({ open, sessions, loaded, activeId, busy, onNewChat, onOpen, onDelete, coworker, onToggleCoworker, onSetupCoworker, onOpenSkills }: SessionsPanelProps) {
  const [removing, setRemoving] = useState<SessionSummary | null>(null)
  const grouped = groupOrder
    .map((label) => ({ label, items: sessions.filter((session) => groupOf(session.updated_at) === label) }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className={`sessions${open ? ' sessions--open' : ''}`} aria-label="Chats" aria-hidden={!open}>
      <div className="sessions__inner">
        <button type="button" className="sessions__new" onClick={onNewChat} disabled={busy} tabIndex={open ? 0 : -1}>
          <SquarePen aria-hidden="true" />
          New chat
        </button>

        <div className="sessions__scroll">
          {!loaded && <p className="sessions__empty">Loading chats…</p>}
          {loaded && sessions.length === 0 && <p className="sessions__empty">Your chats will appear here.</p>}
          {grouped.map((group) => (
            <section key={group.label} className="sessions__group">
              <h2 className="sessions__label">{group.label}</h2>
              <ul>
                {group.items.map((session) => (
                  <li key={session.id} className={`sessions__item${session.id === activeId ? ' sessions__item--active' : ''}`}>
                    <button
                      type="button"
                      className="sessions__open"
                      aria-current={session.id === activeId ? 'true' : undefined}
                      disabled={busy}
                      tabIndex={open ? 0 : -1}
                      onClick={() => onOpen(session.id)}
                    >
                      {session.title}
                    </button>
                    <button
                      type="button"
                      className="sessions__delete"
                      aria-label={`Delete chat: ${session.title}`}
                      disabled={busy}
                      tabIndex={open ? 0 : -1}
                      onClick={() => setRemoving(session)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="coworker">
          <button
            type="button"
            className={`coworker__bar${coworker.enabled && coworker.link === 'connected' ? ' coworker__bar--on' : ''}`}
            role="switch"
            aria-checked={coworker.enabled && coworker.link === 'connected'}
            tabIndex={open ? 0 : -1}
            onClick={onToggleCoworker}
          >
            <Bot aria-hidden="true" />
            <span className="coworker__text">
              <strong>Co-worker</strong>
              <small>{coworkerNote(coworker)}</small>
            </span>
            <span className="coworker__switch" aria-hidden="true" />
          </button>
          {coworker.enabled && coworker.link === 'connected' && (
            <button type="button" className="coworker__skills" tabIndex={open ? 0 : -1} onClick={onOpenSkills}>
              <LayoutGrid aria-hidden="true" />
              Skills and tasks
            </button>
          )}
          <button type="button" className="coworker__setup" tabIndex={open ? 0 : -1} onClick={onSetupCoworker}>
            {coworker.paired ? 'Co-worker settings' : 'Set up Co-worker'}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={removing !== null}
        title="Delete this chat?"
        message={`"${removing?.title ?? ''}" and all of its messages will be removed for good.`}
        confirmLabel="Delete chat"
        cancelLabel="Keep it"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) onDelete(removing.id)
          setRemoving(null)
        }}
      />
    </aside>
  )
}
