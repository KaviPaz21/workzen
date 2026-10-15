import { Ban, Check, FileText, FolderOpen, Globe, LoaderCircle, ShieldQuestion, X, type LucideIcon } from 'lucide-react'
import type { ActionRecord, LiveAction } from '../types'

function iconFor(tool: string): LucideIcon {
  if (tool.startsWith('browser_') || tool === 'open_in_default_browser') return Globe
  if (tool === 'list_files' || tool === 'open_file') return FolderOpen
  return FileText
}

interface ActionCardsProps {
  actions: LiveAction[]
  onApprove: (id: string) => void
  onDeny: (id: string) => void
  onApproveAll: () => void
}

export function ActionCards({ actions, onApprove, onDeny, onApproveAll }: ActionCardsProps) {
  if (actions.length === 0) return null
  const waiting = actions.filter((action) => action.status === 'awaiting').length
  return (
    <section className="actions" aria-label="Co-worker actions">
      <ol>
        {actions.map((action) => {
          const Icon = iconFor(action.tool)
          return (
            <li key={action.id} className={`action action--${action.status}`}>
              <span className="action__icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="action__body">
                <p className="action__summary">{action.summary}</p>
                {action.status === 'awaiting' && (
                  <p className="action__note">
                    <ShieldQuestion aria-hidden="true" />
                    Co-worker is asking for your permission
                  </p>
                )}
                {action.status === 'running' && (
                  <p className="action__note">
                    <LoaderCircle className="spin" aria-hidden="true" />
                    Working on your computer
                  </p>
                )}
                {action.status === 'done' && (
                  <p className="action__note">
                    <Check aria-hidden="true" />
                    Done{action.detail ? ` · ${action.detail}` : ''}
                  </p>
                )}
                {action.status === 'failed' && (
                  <p className="action__note">
                    <X aria-hidden="true" />
                    Failed{action.detail ? ` · ${action.detail}` : ''}
                  </p>
                )}
                {action.status === 'denied' && (
                  <p className="action__note">
                    <Ban aria-hidden="true" />
                    You did not allow this
                  </p>
                )}
              </div>
              {action.status === 'awaiting' && (
                <div className="action__buttons">
                  <button type="button" className="action__deny" onClick={() => onDeny(action.id)}>
                    Deny
                  </button>
                  <button type="button" className="action__allow" onClick={() => onApprove(action.id)}>
                    Allow
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {waiting > 0 && (
        <button type="button" className="actions__all" onClick={onApproveAll}>
          Allow every action in this task
        </button>
      )}
    </section>
  )
}

export function ActionTrace({ actions }: { actions: ActionRecord[] }) {
  if (actions.length === 0) return null
  return (
    <section className="actions actions--trace" aria-label="Actions Co-worker took">
      <p className="actions__title">Co-worker actions</p>
      <ol>
        {actions.map((action) => {
          const Icon = iconFor(action.tool)
          return (
            <li key={action.id} className={`action action--${action.status}`}>
              <span className="action__icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="action__body">
                <p className="action__summary">{action.summary}</p>
                <p className="action__note">
                  {action.status === 'done' && <Check aria-hidden="true" />}
                  {action.status === 'failed' && <X aria-hidden="true" />}
                  {action.status === 'denied' && <Ban aria-hidden="true" />}
                  {action.status === 'done' ? 'Done' : action.status === 'failed' ? 'Failed' : 'Not allowed'}
                  {action.detail ? ` · ${action.detail}` : ''}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
