import { Check, CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { coworkerUrl } from '../services/coworkerClient'
import type { CoworkerState } from '../state/useCoworker'

interface CoworkerSetupModalProps {
  coworker: CoworkerState
  onClose: () => void
}

export function CoworkerSetupModal({ coworker, onClose }: CoworkerSetupModalProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { link, status, connected, recheck } = coworker
  const helperRunning = link !== 'offline' && link !== 'unknown'

  useEffect(() => {
    void recheck()
  }, [recheck])

  async function connect() {
    setBusy(true)
    setProblem(null)
    const result = await coworker.connect(code)
    setBusy(false)
    if (result === 'connected') onClose()
    else if (result === 'offline') setProblem('The Co-worker helper is not running on this computer. Start it first (step 1).')
    else setProblem('That pairing code is not correct. Copy it again from the helper window.')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Set up Co-worker"
      description="Let the assistant do small tasks on this computer, with your permission for every step."
      closeOnBackdrop={false}
      footer={
        connected ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                coworker.disconnect()
                onClose()
              }}
            >
              Disconnect
            </Button>
            <span className="modal__footer-spacer" />
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                coworker.setEnabled(!coworker.enabled)
                onClose()
              }}
            >
              {coworker.enabled ? 'Turn off Co-worker' : 'Turn on Co-worker'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || code.trim() === ''} onClick={connect}>
              {busy ? 'Connecting…' : 'Connect and turn on'}
            </Button>
          </>
        )
      }
    >
      <div className="form-stack">
        <ul className="check-points">
          <li>It can open web pages, use a browser window it controls, and create Word documents and text files in one workspace folder.</li>
          <li>Every action is shown to you first. Nothing runs until you press Allow.</li>
          <li>It cannot run programs, change settings or delete files, and it only listens on this computer.</li>
        </ul>

        {connected ? (
          <div className="coworker-ready">
            <p className="coworker-ready__title">
              <Check aria-hidden="true" /> Connected to the helper (version {status?.version})
            </p>
            <dl className="detail-list">
              <div>
                <dt>Workspace folder</dt>
                <dd>{status?.workspace}</dd>
              </div>
              <div>
                <dt>Opening apps such as Word</dt>
                <dd>{status?.launch_apps ? 'Allowed' : 'Switched off on this computer'}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <>
            <section className="setup-step">
              <h3>1. Start the helper on this computer</h3>
              <p className="wizard__muted">It needs Google Chrome or Microsoft Edge. In a terminal, from the WorkZen folder:</p>
              <pre className="setup-code">{`cd COWORKER\n.\\.venv\\Scripts\\python.exe -m app`}</pre>
              <details className="setup-first">
                <summary>First time only</summary>
                <pre className="setup-code">{`cd COWORKER\npython -m venv .venv\n.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt`}</pre>
              </details>
              <p className={`setup-status${helperRunning ? ' setup-status--ok' : ''}`}>
                {helperRunning ? <Check aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                {helperRunning ? `Helper found at ${coworkerUrl}` : `Helper not found at ${coworkerUrl}`}
                <button type="button" onClick={() => void recheck()}>
                  <RefreshCw aria-hidden="true" /> Check again
                </button>
              </p>
            </section>

            <section className="setup-step">
              <h3>2. Paste the pairing code</h3>
              <p className="wizard__muted">The helper prints a pairing code when it starts. Paste it here so only WorkZen can control it.</p>
              <label className="field">
                <span className="field__label">Pairing code</span>
                <input className="input" value={code} autoComplete="off" spellCheck={false} onChange={(event) => setCode(event.target.value)} />
              </label>
              {problem && (
                <div className="notice notice--danger" role="alert">
                  <CircleAlert aria-hidden="true" />
                  <span>{problem}</span>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}
