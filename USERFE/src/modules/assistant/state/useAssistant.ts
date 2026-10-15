import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchOptions, fetchSession, fetchSessions, removeSession, streamChat, submitActionResult } from '../services/assistantApi'
import { runCoworkerAction } from '../services/coworkerClient'
import type { ActionOutcome, AssistantOptions, ChatMessage, ChatMode, Effort, LiveAction, SessionSummary } from '../types'

interface Preferences {
  mode: ChatMode
  model: string | null
  effort: Effort
}

const preferencesKey = 'workzen.assistant.preferences'
const defaultPreferences: Preferences = { mode: 'gpt', model: null, effort: 'medium' }

function loadPreferences(): Preferences {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(preferencesKey) ?? 'null')
    if (parsed && (parsed.mode === 'gpt' || parsed.mode === 'kb')) return { ...defaultPreferences, ...parsed }
  } catch {
    return defaultPreferences
  }
  return defaultPreferences
}

function savePreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(preferencesKey, JSON.stringify(preferences))
  } catch {
    return
  }
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function newest(sessions: SessionSummary[]) {
  return [...sessions].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

interface CoworkerAccess {
  token: string | null
  active: boolean
}

const deniedOutcome: ActionOutcome = { ok: false, denied: true, error: 'The user denied this action' }

export function useAssistant(userId: string, coworker: CoworkerAccess = { token: null, active: false }) {
  const [options, setOptions] = useState<AssistantOptions | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)
  const [liveActions, setLiveActions] = useState<LiveAction[]>([])
  const requestId = useRef(0)
  const runId = useRef<string | null>(null)
  const approveAll = useRef(false)

  const loadOptions = useCallback(async () => {
    try {
      const loaded = await fetchOptions()
      setOptions(loaded)
      setOptionsError(null)
      setPreferences((current) => {
        const model = current.model && loaded.models.includes(current.model) ? current.model : loaded.default_model
        return model === current.model ? current : { ...current, model }
      })
    } catch (failure) {
      setOptionsError(errorText(failure, 'The assistant could not be reached.'))
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    requestId.current += 1
    setActiveId(null)
    setMessages([])
    setDraft(null)
    setError(null)
    setStreaming(false)
    setLiveActions([])
    setSessionsLoaded(false)
    fetchSessions(userId)
      .then((loaded) => setSessions(newest(loaded)))
      .catch((failure: unknown) => {
        setSessions([])
        setError(errorText(failure, 'Your chats could not be loaded.'))
      })
      .finally(() => setSessionsLoaded(true))
  }, [userId])

  const updatePreferences = useCallback((changes: Partial<Preferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...changes }
      savePreferences(next)
      return next
    })
  }, [])

  const upsertSession = useCallback((summary: SessionSummary) => {
    setSessions((current) => newest([summary, ...current.filter((item) => item.id !== summary.id)]))
  }, [])

  const newChat = useCallback(() => {
    if (streaming) return
    requestId.current += 1
    setActiveId(null)
    setMessages([])
    setDraft(null)
    setError(null)
  }, [streaming])

  const openSession = useCallback(
    async (sessionId: string) => {
      if (streaming || sessionId === activeId) return
      const ticket = ++requestId.current
      setLoadingSession(true)
      setError(null)
      try {
        const session = await fetchSession(userId, sessionId)
        if (ticket !== requestId.current) return
        setActiveId(session.id)
        setMessages(session.messages)
        setDraft(null)
      } catch (failure) {
        if (ticket === requestId.current) setError(errorText(failure, 'That chat could not be opened.'))
      } finally {
        if (ticket === requestId.current) setLoadingSession(false)
      }
    },
    [userId, streaming, activeId],
  )

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await removeSession(userId, sessionId)
        setSessions((current) => current.filter((item) => item.id !== sessionId))
        if (sessionId === activeId) {
          requestId.current += 1
          setActiveId(null)
          setMessages([])
        }
      } catch (failure) {
        setError(errorText(failure, 'That chat could not be deleted.'))
      }
    },
    [userId, activeId],
  )

  const patchAction = useCallback((id: string, changes: Partial<LiveAction>) => {
    setLiveActions((current) => current.map((action) => (action.id === id ? { ...action, ...changes } : action)))
  }, [])

  const reportOutcome = useCallback(
    async (actionId: string, outcome: ActionOutcome) => {
      const run = runId.current
      if (!run) return
      try {
        await submitActionResult(userId, run, actionId, outcome)
      } catch (failure) {
        setError(errorText(failure, 'The result of an action could not be sent back to the assistant.'))
      }
    },
    [userId],
  )

  const runAction = useCallback(
    async (action: LiveAction) => {
      if (!coworker.token) {
        await reportOutcome(action.id, { ok: false, error: 'The Co-worker helper is not connected.' })
        return
      }
      patchAction(action.id, { status: 'running' })
      const outcome = await runCoworkerAction(coworker.token, action.tool, action.args)
      await reportOutcome(action.id, outcome)
    },
    [coworker.token, patchAction, reportOutcome],
  )

  const approveAction = useCallback(
    (id: string) => {
      const action = liveActions.find((item) => item.id === id)
      if (action && action.status === 'awaiting') void runAction(action)
    },
    [liveActions, runAction],
  )

  const denyAction = useCallback(
    (id: string) => {
      const action = liveActions.find((item) => item.id === id)
      if (action && action.status === 'awaiting') {
        patchAction(id, { status: 'running' })
        void reportOutcome(id, deniedOutcome)
      }
    },
    [liveActions, patchAction, reportOutcome],
  )

  const approveAllActions = useCallback(() => {
    approveAll.current = true
    liveActions.filter((item) => item.status === 'awaiting').forEach((item) => void runAction(item))
  }, [liveActions, runAction])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || streaming || !preferences.model) return
      const tempId = `local-${Date.now()}`
      const ticket = requestId.current
      const useCoworker = coworker.active
      approveAll.current = false
      runId.current = null
      setError(null)
      setStreaming(true)
      setDraft('')
      setLiveActions([])
      setMessages((current) => [...current, { id: tempId, role: 'user', content: question, created_at: new Date().toISOString(), sources: [] }])
      try {
        await streamChat(
          userId,
          { session_id: activeId, message: question, mode: preferences.mode, model: preferences.model, effort: preferences.effort, coworker: useCoworker },
          (event) => {
            if (ticket !== requestId.current) return
            if (event.type === 'start') {
              runId.current = event.run_id ?? null
              setActiveId(event.session.id)
              setMessages((current) => current.map((message) => (message.id === tempId ? event.user_message : message)))
              upsertSession(event.session)
            } else if (event.type === 'delta') {
              setDraft((current) => (current ?? '') + event.text)
            } else if (event.type === 'action') {
              const action: LiveAction = { ...event.action, status: 'awaiting', detail: '' }
              setLiveActions((current) => [...current, action])
              if (approveAll.current) void runAction(action)
            } else if (event.type === 'action_result') {
              patchAction(event.id, { status: event.status, detail: event.detail })
            } else if (event.type === 'done') {
              setMessages((current) => [...current, event.message])
              setDraft(null)
              upsertSession(event.session)
            } else {
              setError(event.detail)
            }
          },
        )
      } catch (failure) {
        if (ticket === requestId.current) setError(errorText(failure, 'The assistant could not answer. Please try again.'))
      } finally {
        if (ticket === requestId.current) {
          setStreaming(false)
          setDraft(null)
          setLiveActions([])
          runId.current = null
        }
      }
    },
    [userId, activeId, streaming, preferences, coworker.active, upsertSession, runAction, patchAction],
  )
  return {
    options,
    optionsError,
    sessions,
    sessionsLoaded,
    activeId,
    messages,
    draft,
    liveActions,
    approveAction,
    denyAction,
    approveAllActions,
    streaming,
    loadingSession,
    error,
    dismissError: () => setError(null),
    preferences,
    updatePreferences,
    newChat,
    openSession,
    deleteSession,
    send,
    reloadOptions: loadOptions,
  }
}
