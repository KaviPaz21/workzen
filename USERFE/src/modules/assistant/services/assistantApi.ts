import { apiRequest } from '@/lib/api'
import type { ActionOutcome, AssistantOptions, ChatEvent, ChatRequest, ChatSession, SessionSummary } from '../types'

function userHeaders(userId: string, extra: Record<string, string> = {}) {
  return { 'X-User-Id': userId, ...extra }
}

export async function fetchOptions(): Promise<AssistantOptions> {
  const response = await apiRequest('/assistant/options', { method: 'GET' })
  return (await response.json()) as AssistantOptions
}

export async function fetchSessions(userId: string): Promise<SessionSummary[]> {
  const response = await apiRequest('/assistant/sessions', { method: 'GET', headers: userHeaders(userId) })
  return (await response.json()) as SessionSummary[]
}

export async function fetchSession(userId: string, sessionId: string): Promise<ChatSession> {
  const response = await apiRequest(`/assistant/sessions/${sessionId}`, { method: 'GET', headers: userHeaders(userId) })
  return (await response.json()) as ChatSession
}

export async function removeSession(userId: string, sessionId: string): Promise<void> {
  await apiRequest(`/assistant/sessions/${sessionId}`, { method: 'DELETE', headers: userHeaders(userId) })
}

export async function submitActionResult(userId: string, runId: string, actionId: string, outcome: ActionOutcome): Promise<void> {
  await apiRequest(`/assistant/coworker/runs/${runId}/actions/${actionId}`, {
    method: 'POST',
    headers: userHeaders(userId, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(outcome),
  })
}

export async function streamChat(userId: string, body: ChatRequest, onEvent: (event: ChatEvent) => void): Promise<void> {
  const response = await apiRequest('/assistant/chat', {
    method: 'POST',
    headers: userHeaders(userId, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.body) throw new Error('The server did not stream an answer.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) onEvent(JSON.parse(line) as ChatEvent)
      newline = buffer.indexOf('\n')
    }
  }
  const rest = buffer.trim()
  if (rest) onEvent(JSON.parse(rest) as ChatEvent)
}
