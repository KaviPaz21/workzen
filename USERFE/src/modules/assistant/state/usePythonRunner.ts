import { useCallback, useEffect, useRef, useState } from 'react'
import { runPython, type PythonEvent } from '../lib/pythonSandbox'

export type PythonStatus = 'idle' | 'working' | 'running' | 'finished' | 'failed' | 'stopped'

export interface PythonOutput {
  text: string
  figures: string[]
  result: string | null
  error: string | null
}

const emptyOutput: PythonOutput = { text: '', figures: [], result: null, error: null }

export function usePythonRunner() {
  const [status, setStatus] = useState<PythonStatus>('idle')
  const [note, setNote] = useState('')
  const [output, setOutput] = useState<PythonOutput>(emptyOutput)
  const handle = useRef<{ stop: () => void } | null>(null)

  const run = useCallback((code: string) => {
    setStatus('working')
    setNote('Starting')
    setOutput(emptyOutput)
    handle.current = runPython(code, (event: PythonEvent) => {
      if (event.type === 'status') setNote(event.text ?? '')
      else if (event.type === 'running') {
        setStatus('running')
        setNote('')
      } else if (event.type === 'stdout' || event.type === 'stderr') {
        setOutput((current) => ({ ...current, text: `${current.text}${event.text ?? ''}\n` }))
      } else if (event.type === 'done') {
        setOutput((current) => ({ ...current, result: event.result ?? null, figures: event.figures ?? [] }))
        setStatus('finished')
      } else if (event.type === 'error') {
        setOutput((current) => ({ ...current, error: event.text ?? 'The code failed.' }))
        setStatus('failed')
      } else if (event.type === 'stopped') {
        setStatus('stopped')
      }
    })
  }, [])

  const stop = useCallback(() => handle.current?.stop(), [])

  useEffect(
    () => () => {
      handle.current?.stop()
    },
    [],
  )

  return { status, note, output, run, stop }
}
