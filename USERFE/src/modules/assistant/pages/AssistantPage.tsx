import { ArrowDown, Bot, LayoutGrid, Menu, ShieldCheck, SquarePen, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { useCurrentUser } from '@/modules/recruiteone/state/CurrentUser'
import { CanvasPanel, type CanvasState } from '../components/CanvasPanel'
import { Composer } from '../components/Composer'
import { CoworkerSetupModal } from '../components/CoworkerSetupModal'
import { MessageList } from '../components/MessageList'
import { ModeToggle } from '../components/ModeToggle'
import { QuestionRail } from '../components/QuestionRail'
import { SessionsPanel } from '../components/SessionsPanel'
import { SkillsModal } from '../components/SkillsModal'
import { canvasContentFor } from '../lib/canvas'
import { firstNameOf, greetingFor } from '../lib/greeting'
import { permissionOptions, type PermissionMode } from '../lib/permissions'
import { useAssistant } from '../state/useAssistant'
import { useCoworker } from '../state/useCoworker'

const panelKey = 'workzen.assistant.panel'
const followDistance = 180
const jumpDistance = 240

function loadPanel() {
  try {
    return window.localStorage.getItem(panelKey) === 'open'
  } catch {
    return false
  }
}

export function AssistantPage() {
  usePageTitle('AI Assistant')
  const { user } = useCurrentUser()
  const coworker = useCoworker()
  const coworkerOn = coworker.enabled && coworker.connected
  const assistant = useAssistant(user.id, { token: coworker.token, active: coworkerOn, mode: coworker.mode, supported: coworker.status?.actions ?? null })
  const { options, messages, draft, streaming, preferences, activeId } = assistant
  const [panelOpen, setPanelOpen] = useState(loadPanel)
  const [canvas, setCanvas] = useState<CanvasState | null>(null)
  const [canvasWide, setCanvasWide] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [awayFromBottom, setAwayFromBottom] = useState(false)
  const canvasTokens = useRef(0)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const empty = messages.length === 0 && draft === null && !assistant.loadingSession
  const knowledge = options?.modes.find((mode) => mode.id === 'kb')
  const activeTitle = assistant.sessions.find((session) => session.id === activeId)?.title

  function togglePanel() {
    setPanelOpen((open) => {
      try {
        window.localStorage.setItem(panelKey, open ? 'closed' : 'open')
      } catch {
        return !open
      }
      return !open
    })
  }

  function toggleCoworker() {
    if (!coworker.connected) setSetupOpen(true)
    else coworker.setEnabled(!coworker.enabled)
  }

  const coworkerBlocked = coworker.enabled && !coworker.connected
  const activeSkill = assistant.options?.coworker_skills?.find((item) => item.id === assistant.skill) ?? null
  const installedActions = coworker.status?.actions ?? null
  const coworkerOutdated = coworker.connected && installedActions !== null && (assistant.options?.coworker_actions ?? []).some((action) => !installedActions.includes(action))

  function openCode(fenceLanguage: string, code: string) {
    const content = canvasContentFor(fenceLanguage, code)
    if (content) setCanvas({ ...content, token: ++canvasTokens.current })
  }

  useEffect(() => {
    setCanvas(null)
  }, [activeId, user.id])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < followDistance) scroller.scrollTop = scroller.scrollHeight
  }, [draft])

  const liveActionCount = assistant.liveActions.length
  const awaitingCount = assistant.liveActions.filter((action) => action.status === 'awaiting').length
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (awaitingCount > 0) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
    else if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < followDistance * 3) scroller.scrollTop = scroller.scrollHeight
  }, [liveActionCount, awaitingCount])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) {
      setAwayFromBottom(false)
      return
    }
    const area = scroller
    function measure() {
      setAwayFromBottom(area.scrollHeight - area.scrollTop - area.clientHeight > jumpDistance)
    }
    measure()
    area.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      area.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [empty, messages.length, draft])

  function scrollToBottom() {
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
  }

  return (
    <div className="assistant">
      <SessionsPanel
        open={panelOpen}
        sessions={assistant.sessions}
        loaded={assistant.sessionsLoaded}
        activeId={activeId}
        busy={streaming}
        onNewChat={assistant.newChat}
        onOpen={assistant.openSession}
        onDelete={assistant.deleteSession}
        coworker={{ enabled: coworker.enabled, link: coworker.link, paired: coworker.token !== null, mode: coworker.mode, outdated: coworkerOutdated }}
        onToggleCoworker={toggleCoworker}
        onSetupCoworker={() => setSetupOpen(true)}
        onOpenSkills={() => (coworkerOutdated ? setSetupOpen(true) : setSkillsOpen(true))}
      />

      <section className="assistant__main">
        <header className="assistant__bar">
          <button type="button" className="assistant__icon" aria-label={panelOpen ? 'Hide chats' : 'Show chats'} aria-expanded={panelOpen} onClick={togglePanel}>
            <Menu aria-hidden="true" />
          </button>
          <ModeToggle value={preferences.mode} modes={options?.modes ?? []} disabled={coworkerOn} onChange={(mode) => assistant.updatePreferences({ mode })} />
          {coworkerOn && (
            <span className="assistant__chip" title="Co-worker can act on this computer. It never deletes anything and always asks before creating something">
              <Bot aria-hidden="true" />
              Co-worker on
            </span>
          )}
          {coworkerOn && (
            <label className="assistant__permission">
              <ShieldCheck aria-hidden="true" />
              <select
                value={coworker.mode}
                aria-label="Co-worker permissions"
                title={permissionOptions.find((option) => option.id === coworker.mode)?.description}
                onChange={(event) => coworker.setMode(event.target.value as PermissionMode)}
              >
                {permissionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.short}
                  </option>
                ))}
              </select>
            </label>
          )}
          {coworkerOn && activeSkill && (
            <button type="button" className="assistant__skill" title="Stop using this skill for the next messages" onClick={assistant.clearSkill}>
              <LayoutGrid aria-hidden="true" />
              {activeSkill.label}
              <X aria-hidden="true" />
            </button>
          )}
          <span className="assistant__title">{activeTitle ?? ''}</span>
          <button type="button" className="assistant__icon" aria-label="New chat" title="New chat" disabled={streaming || empty} onClick={assistant.newChat}>
            <SquarePen aria-hidden="true" />
          </button>
        </header>

        {coworkerOutdated && (
          <p className="assistant__notice" role="status">
            <TriangleAlert aria-hidden="true" />
            The Co-worker app on this computer is out of date, so newer steps such as looking at a page, the pointer and checks will not work.
            {options?.coworker_download_url && (
              <a className="assistant__link" href={options.coworker_download_url} download>
                Download the update
              </a>
            )}
            <button type="button" className="assistant__link" onClick={() => setSetupOpen(true)}>
              How to update
            </button>
          </p>
        )}

        {coworkerBlocked && (
          <p className="assistant__notice" role="status">
            <TriangleAlert aria-hidden="true" />
            Co-worker is on, but the Co-worker app on this computer is not responding. Open it from the Start menu, or turn Co-worker off.
            <button type="button" className="assistant__link" onClick={() => setSetupOpen(true)}>
              Open setup
            </button>
          </p>
        )}

        {preferences.mode === 'kb' && !coworkerOn && knowledge && !knowledge.ready && (
          <p className="assistant__notice" role="status">
            <TriangleAlert aria-hidden="true" />
            {knowledge.detail}. Internal KB answers only from documents in the knowledge base, so until it has some, switch to GPT for general questions.
          </p>
        )}

        <div className="assistant__body">
          <div className={`assistant__chat${empty ? ' assistant__chat--empty' : ''}`}>
            <div className={`assistant__stage${empty ? ' assistant__stage--empty' : ''}`}>
              {empty && (
                <div className="assistant__welcome">
                  <h1>
                    {greetingFor()}, {firstNameOf(user.name)}
                  </h1>
                  <p>{coworkerOn ? 'Co-worker is on. Describe a task for this computer. It asks before anything important and never deletes.' : preferences.mode === 'kb' ? 'Ask a question and I will answer from your internal knowledge base.' : 'What can I help you with today?'}</p>
                  {assistant.optionsError && (
                    <p className="assistant__problem" role="alert">
                      <TriangleAlert aria-hidden="true" />
                      {assistant.optionsError}{' '}
                      <button type="button" onClick={() => void assistant.reloadOptions()}>
                        Try again
                      </button>
                    </p>
                  )}
                </div>
              )}

              {!empty && (
                <div className="assistant__scroller" ref={scrollerRef}>
                  {assistant.loadingSession ? <p className="assistant__loading">Loading chat…</p> : <MessageList
                      messages={messages}
                      draft={draft}
                      liveActions={assistant.liveActions}
                      onOpenCode={openCode}
                      onApproveAction={assistant.approveAction}
                      onDenyAction={assistant.denyAction}
                      onApproveAll={assistant.approveAllActions}
                    />}
                </div>
              )}

              {assistant.error && (
                <p className="assistant__problem assistant__problem--bar" role="alert">
                  <TriangleAlert aria-hidden="true" />
                  {assistant.error}
                  <button type="button" className="assistant__dismiss" aria-label="Dismiss" onClick={assistant.dismissError}>
                    <X aria-hidden="true" />
                  </button>
                </p>
              )}

              <div className="assistant__dock">
                {!empty && awayFromBottom && (
                  <button type="button" className="assistant__jump" aria-label="Scroll to the latest message" title="Scroll to the latest message" onClick={scrollToBottom}>
                    <ArrowDown aria-hidden="true" />
                  </button>
                )}
                <Composer
                  options={options}
                  mode={preferences.mode}
                  model={preferences.model}
                  effort={preferences.effort}
                  disabled={streaming || assistant.loadingSession || options === null || coworkerBlocked}
                  centered={empty}
                  coworker={coworkerOn}
                  onModel={(model) => assistant.updatePreferences({ model })}
                  onEffort={(effort) => assistant.updatePreferences({ effort })}
                  onSend={(text) => void assistant.send(text)}
                />
              </div>
            </div>

            <QuestionRail messages={messages} scrollerRef={scrollerRef} />
          </div>

          {canvas && (
            <CanvasPanel
              key={canvas.token}
              canvas={canvas}
              wide={canvasWide}
              onChange={(code) => setCanvas((current) => (current ? { ...current, code } : current))}
              onToggleWide={() => setCanvasWide((value) => !value)}
              onClose={() => setCanvas(null)}
            />
          )}
        </div>
      </section>

      {skillsOpen && (
        <SkillsModal
          skills={options?.coworker_skills ?? []}
          activeSkill={assistant.skill}
          onClose={() => setSkillsOpen(false)}
          onStart={(skillId, message) => {
            setSkillsOpen(false)
            void assistant.send(message, skillId)
          }}
        />
      )}
      {setupOpen && <CoworkerSetupModal coworker={coworker} downloadUrl={options?.coworker_download_url ?? null} outdated={coworkerOutdated} onClose={() => setSetupOpen(false)} />}
    </div>
  )
}

