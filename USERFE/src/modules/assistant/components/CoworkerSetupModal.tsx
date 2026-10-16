import { Check, CircleAlert, Download, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { permissionOptions } from '../lib/permissions'
import type { ConnectResult, CoworkerState } from '../state/useCoworker'

interface CoworkerSetupModalProps {
  coworker: CoworkerState
  downloadUrl: string | null
  outdated: boolean
  onClose: () => void
}

const detectEveryMs = 2000

const problems: Record<Exclude<ConnectResult, 'connected'>, string> = {
  offline: 'The Co-worker app stopped responding. Open it from the Start menu and try again.',
  denied: 'You chose No, so nothing was connected. Press Connect to try again.',
  busy: 'A question from the Co-worker app is already open on your computer. Answer it first.',
  blocked: 'This website is not on the Co-worker app’s list of allowed websites. Ask your WorkZen administrator.',
}

export function CoworkerSetupModal({ coworker, downloadUrl, outdated, onClose }: CoworkerSetupModalProps) {
  const [asking, setAsking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { link, status, connected, recheck } = coworker
  const appFound = link === 'connected' || link === 'unauthorized'

  useEffect(() => {
    void recheck()
    const timer = window.setInterval(() => void recheck(), detectEveryMs)
    return () => window.clearInterval(timer)
  }, [recheck])

  async function connect() {
    setAsking(true)
    setProblem(null)
    const result = await coworker.connect()
    setAsking(false)
    if (result === 'connected') onClose()
    else setProblem(problems[result])
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Set up Co-worker"
      description="Let the assistant do small tasks on this computer, always with your permission."
      closeOnBackdrop={false}
      footer={
        connected ? (
          <>
            <Button
              variant="danger"
              onClick={async () => {
                await coworker.disconnect()
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
            <Button disabled={!appFound || asking} onClick={connect}>
              {asking ? 'Waiting for you…' : 'Connect'}
            </Button>
          </>
        )
      }
    >
      <div className="form-stack">
        <ul className="check-points">
          <li>It can open web pages, use a browser window of its own, and create Word documents and notes in one folder.</li>
          <li>You choose how much it asks: every action, only important ones, or allow everything. It always asks before creating something.</li>
          <li>It cannot run other programs, change settings or delete anything.</li>
        </ul>

        {connected && outdated && (
          <div className="notice notice--danger" role="alert">
            <CircleAlert aria-hidden="true" />
            <div>
              <strong>The Co-worker app on this computer is out of date.</strong>
              <p>Download the update, then open the downloaded file and press Update. It replaces the old version by itself and keeps your documents.</p>
              {downloadUrl && (
                <a className="btn btn--primary btn--md setup-download" href={downloadUrl} download>
                  <Download aria-hidden="true" />
                  Download the update
                </a>
              )}
            </div>
          </div>
        )}

        {connected && (
          <fieldset className="permission-group">
            <legend>How should Co-worker ask?</legend>
            {permissionOptions.map((option) => (
              <label key={option.id} className={`permission-option${coworker.mode === option.id ? ' permission-option--on' : ''}`}>
                <input type="radio" name="coworker-permissions" checked={coworker.mode === option.id} onChange={() => coworker.setMode(option.id)} />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
            <p className="wizard__muted">Whatever you choose, Co-worker never deletes anything and always asks before it creates a file or submits something in a page.</p>
          </fieldset>
        )}

        {connected && (
          <div className="coworker-ready">
            <p className="coworker-ready__title">
              <Check aria-hidden="true" /> Connected to the Co-worker app on this computer
            </p>
            <dl className="detail-list">
              <div>
                <dt>Folder for its documents</dt>
                <dd>{status?.workspace}</dd>
              </div>
              <div>
                <dt>Opening apps such as Word</dt>
                <dd>{status?.launch_apps ? 'Allowed' : 'Switched off on this computer'}</dd>
              </div>
            </dl>
          </div>
        )}

        {!connected && !appFound && (
          <ol className="setup-steps">
            <li>
              <span className="setup-steps__number">1</span>
              <div>
                <h3>Download the Co-worker app</h3>
                {downloadUrl ? (
                  <a className="btn btn--primary btn--md setup-download" href={downloadUrl} download>
                    <Download aria-hidden="true" />
                    Download for Windows
                  </a>
                ) : (
                  <p className="wizard__muted">The app is not available to download yet. Ask your WorkZen administrator to publish it.</p>
                )}
              </div>
            </li>
            <li>
              <span className="setup-steps__number">2</span>
              <div>
                <h3>Open the file you downloaded and press Install</h3>
                <p className="wizard__muted">It takes a few seconds.</p>
                <details className="setup-warning">
                  <summary>Your browser or Windows says it is “not commonly downloaded”?</summary>
                  <p>
                    That message appears for any new app that does not have many downloads yet. It does not mean something is wrong with the file, which comes from your own WorkZen. If you are unsure, ask your IT team before you continue.
                  </p>
                  <ol>
                    <li>
                      <strong>In the browser:</strong> open the downloads list and choose <strong>Keep</strong>. In Microsoft Edge choose <strong>Keep</strong>, then <strong>Show more</strong>, then <strong>Keep anyway</strong>.
                    </li>
                    <li>
                      <strong>In Windows:</strong> if a blue “Windows protected your PC” screen appears, choose <strong>More info</strong>, then <strong>Run anyway</strong>.
                    </li>
                  </ol>
                </details>
              </div>
            </li>
            <li>
              <span className="setup-steps__number">3</span>
              <div>
                <h3>Come back here</h3>
                <p className="setup-wait" role="status">
                  <LoaderCircle className="spin" aria-hidden="true" />
                  Looking for the app on this computer. This page notices it by itself.
                </p>
              </div>
            </li>
          </ol>
        )}

        {!connected && appFound && (
          <div className="coworker-ready">
            <p className="coworker-ready__title">
              <Check aria-hidden="true" /> The Co-worker app is running on this computer
            </p>
            <p className="wizard__muted">Press Connect. Windows will show a small window asking you to allow WorkZen. Choose Yes.</p>
            {asking && (
              <p className="setup-wait" role="status">
                <LoaderCircle className="spin" aria-hidden="true" />
                Look for the window on your screen and choose Yes.
              </p>
            )}
            {problem && (
              <div className="notice notice--danger" role="alert">
                <CircleAlert aria-hidden="true" />
                <span>{problem}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
