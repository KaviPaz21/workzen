import { Check, Copy, Maximize2, Minimize2, Play, Square, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { canvasLabels, webDocument, type CanvasContent, type ConsoleLine } from '../lib/canvas'
import { usePythonRunner } from '../state/usePythonRunner'

export interface CanvasState extends CanvasContent {
  token: number
}

interface CanvasPanelProps {
  canvas: CanvasState
  wide: boolean
  onChange: (code: string) => void
  onToggleWide: () => void
  onClose: () => void
}

function Editor({ code, onChange, label }: { code: string; onChange: (code: string) => void; label: string }) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const area = event.currentTarget
    const { selectionStart, selectionEnd } = area
    onChange(`${code.slice(0, selectionStart)}  ${code.slice(selectionEnd)}`)
    window.requestAnimationFrame(() => {
      area.selectionStart = area.selectionEnd = selectionStart + 2
    })
  }

  return (
    <textarea
      className="canvas__editor"
      aria-label={label}
      value={code}
      spellCheck={false}
      wrap="off"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

function ConsoleView({ lines }: { lines: ConsoleLine[] }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="canvas__console" aria-label="Console">
      <button type="button" className="canvas__console-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Console <span>{lines.length}</span>
      </button>
      {open && (
        <ul>
          {lines.length === 0 && <li className="canvas__console-empty">Nothing was logged.</li>}
          {lines.map((line, index) => (
            <li key={index} className={`canvas__line canvas__line--${line.level}`}>
              {line.level === 'error' && <strong>Error </strong>}
              {line.level === 'warn' && <strong>Warning </strong>}
              {line.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function WebBody({ canvas, onChange, tab, runTick, ranCode }: { canvas: CanvasState; onChange: (code: string) => void; tab: 'preview' | 'code'; runTick: number; ranCode: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const html = useMemo(() => webDocument(canvas.language, ranCode), [canvas.language, ranCode])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow || !event.data?.canvasConsole) return
      setLines((current) => [...current.slice(-199), { level: event.data.level, text: String(event.data.text) }])
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    setLines([])
  }, [runTick])

  return (
    <>
      <div className={`canvas__preview${tab === 'preview' ? '' : ' canvas__preview--hidden'}`}>
        <iframe
          key={runTick}
          ref={frameRef}
          title="Canvas preview"
          sandbox="allow-scripts allow-forms allow-modals"
          srcDoc={html}
        />
        <ConsoleView lines={lines} />
      </div>
      {tab === 'code' && <Editor code={canvas.code} onChange={onChange} label={`${canvasLabels[canvas.language]} code`} />}
    </>
  )
}

function PythonBody({ canvas, onChange, runner }: { canvas: CanvasState; onChange: (code: string) => void; runner: ReturnType<typeof usePythonRunner> }) {
  const { status, note, output } = runner
  const waiting = status === 'working' || status === 'running'
  return (
    <div className="canvas__split">
      <div className="canvas__pane">
        <Editor code={canvas.code} onChange={onChange} label="Python code" />
      </div>
      <section className="canvas__output" aria-label="Output" aria-live="polite">
        <p className="canvas__status">
          {status === 'idle' && 'Press Run to execute the code in your browser.'}
          {status === 'working' && `${note}…`}
          {status === 'running' && 'Running…'}
          {status === 'finished' && 'Finished'}
          {status === 'failed' && 'Failed'}
          {status === 'stopped' && 'Stopped'}
        </p>
        {output.text && <pre className="canvas__text">{output.text}</pre>}
        {output.result !== null && (
          <pre className="canvas__text canvas__text--result">
            <strong>Result </strong>
            {output.result}
          </pre>
        )}
        {output.figures.map((figure, index) => (
          <img key={index} className="canvas__figure" alt={`Plot ${index + 1}`} src={`data:image/png;base64,${figure}`} />
        ))}
        {output.error && <pre className="canvas__text canvas__text--error">{output.error}</pre>}
        {!waiting && status === 'finished' && !output.text && output.result === null && output.figures.length === 0 && (
          <p className="canvas__muted">The code ran without printing anything. Use print() to show values.</p>
        )}
      </section>
    </div>
  )
}

export function CanvasPanel({ canvas, wide, onChange, onToggleWide, onClose }: CanvasPanelProps) {
  const isPython = canvas.language === 'python'
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [runTick, setRunTick] = useState(0)
  const [ranCode, setRanCode] = useState(canvas.code)
  const [copied, setCopied] = useState(false)
  const runner = usePythonRunner()
  const busy = runner.status === 'working' || runner.status === 'running'

  const startRun = runner.run
  const openedCode = useRef(canvas.code)

  useEffect(() => {
    if (isPython) startRun(openedCode.current)
  }, [isPython, startRun])

  function execute() {
    if (isPython) runner.run(canvas.code)
    else {
      setTab('preview')
      setRanCode(canvas.code)
      setRunTick((value) => value + 1)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(canvas.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <aside className={`canvas${wide ? ' canvas--wide' : ''}`} aria-label="Canvas">
      <header className="canvas__bar">
        <h2 className="canvas__title">
          Canvas <span>{canvasLabels[canvas.language]}</span>
        </h2>
        {!isPython && (
          <div className="mode-toggle canvas__tabs" role="group" aria-label="Canvas view">
            <button type="button" aria-pressed={tab === 'preview'} onClick={() => setTab('preview')}>
              Preview
            </button>
            <button type="button" aria-pressed={tab === 'code'} onClick={() => setTab('code')}>
              Code
            </button>
          </div>
        )}
        <span className="canvas__spacer" />
        {busy ? (
          <button type="button" className="canvas__run canvas__run--stop" onClick={runner.stop}>
            <Square aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button type="button" className="canvas__run" onClick={execute}>
            <Play aria-hidden="true" />
            {isPython || canvas.language === 'javascript' ? 'Run' : 'Refresh'}
          </button>
        )}
        <button type="button" className="assistant__icon" aria-label="Copy code" title="Copy code" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>
        <button type="button" className="assistant__icon canvas__wide" aria-label={wide ? 'Make the canvas narrower' : 'Make the canvas wider'} onClick={onToggleWide}>
          {wide ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </button>
        <button type="button" className="assistant__icon" aria-label="Close canvas" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="canvas__body">
        {isPython ? <PythonBody canvas={canvas} onChange={onChange} runner={runner} /> : <WebBody canvas={canvas} onChange={onChange} tab={tab} runTick={runTick} ranCode={ranCode} />}
      </div>
    </aside>
  )
}

