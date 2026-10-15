import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { ChatMessage, LiveAction } from '../types'
import { ActionCards, ActionTrace } from './ActionCards'
import { Markdown, type OpenCode } from './Markdown'

function modeLabel(message: ChatMessage) {
  const parts = [message.mode === 'kb' ? 'Internal KB' : message.mode === 'gpt' ? 'GPT' : null, message.model, message.effort ? `${message.effort} effort` : null]
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className="msg__action" onClick={copy} aria-label="Copy answer">
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function AssistantMessage({ message, onOpenCode }: { message: ChatMessage; onOpenCode?: OpenCode }) {
  return (
    <div className="msg msg--assistant">
      <ActionTrace actions={message.actions ?? []} />
      <Markdown text={message.content} onOpenCode={onOpenCode} />
      {message.sources.length > 0 && (
        <div className="msg__sources">
          <p className="msg__sources-title">Sources</p>
          <ol>
            {message.sources.map((source, index) => (
              <li key={`${source.name}-${index}`} title={source.excerpt}>
                <span className="msg__source-number">{index + 1}</span>
                {source.name}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="msg__footer">
        <CopyButton text={message.content} />
        <span className="msg__meta">{modeLabel(message)}</span>
      </div>
    </div>
  )
}

interface MessageListProps {
  messages: ChatMessage[]
  draft: string | null
  liveActions: LiveAction[]
  onOpenCode: OpenCode
  onApproveAction: (id: string) => void
  onDenyAction: (id: string) => void
  onApproveAll: () => void
}

export function MessageList({ messages, draft, liveActions, onOpenCode, onApproveAction, onDenyAction, onApproveAll }: MessageListProps) {
  const busyWithActions = liveActions.some((action) => action.status === 'awaiting' || action.status === 'running')
  return (
    <div className="assistant__thread">
      {messages.map((message) =>
        message.role === 'user' ? (
          <div key={message.id} className="msg msg--user" data-question-id={message.id}>
            <div className="msg__bubble">{message.content}</div>
          </div>
        ) : (
          <AssistantMessage key={message.id} message={message} onOpenCode={onOpenCode} />
        ),
      )}
      {draft !== null && (
        <div className="msg msg--assistant" aria-live="polite">
          <ActionCards actions={liveActions} onApprove={onApproveAction} onDeny={onDenyAction} onApproveAll={onApproveAll} />
          {draft === '' ? (
            !busyWithActions && (
              <p className="msg__thinking" role="status">
                <span />
                <span />
                <span />
                <span className="sr-only">The assistant is thinking</span>
              </p>
            )
          ) : (
            <>
              <Markdown text={draft} />
              {!busyWithActions && <span className="msg__caret" aria-hidden="true" />}
            </>
          )}
        </div>
      )}
    </div>
  )
}
