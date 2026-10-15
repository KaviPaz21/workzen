import { Check, Copy, Play } from 'lucide-react'
import { Children, isValidElement, useState, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { canvasLanguage } from '../lib/canvas'

export type OpenCode = (fenceLanguage: string, code: string) => void

function CodeBlock({ language, code, onOpen }: { language: string; code: string; onOpen?: OpenCode }) {
  const [copied, setCopied] = useState(false)
  const runnable = canvasLanguage(language) !== null

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="code">
      <div className="code__bar">
        <span>{language || 'code'}</span>
        <div className="code__actions">
          <button type="button" onClick={copy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {runnable && onOpen && (
            <button type="button" className="code__run" onClick={() => onOpen(language, code)}>
              <Play aria-hidden="true" />
              {canvasLanguage(language) === 'html' ? 'Preview' : 'Run'}
            </button>
          )}
        </div>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node as ReactElement<{ children?: ReactNode }>).props.children)
  return ''
}

export function Markdown({ text, onOpenCode }: { text: string; onOpenCode?: OpenCode }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          pre: ({ children }) => {
            const child = Children.toArray(children)[0]
            const className = isValidElement(child) ? ((child as ReactElement<{ className?: string }>).props.className ?? '') : ''
            const language = /language-([\w+-]+)/.exec(className)?.[1] ?? ''
            return <CodeBlock language={language} code={textOf(children).replace(/\n$/, '')} onOpen={onOpenCode} />
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
