export type ChatMode = 'gpt' | 'kb'
export type Effort = 'low' | 'medium' | 'high'

export interface Source {
  name: string
  excerpt: string
}

export interface ActionRecord {
  id: string
  tool: string
  summary: string
  status: 'done' | 'failed' | 'denied'
  detail: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  sources: Source[]
  actions?: ActionRecord[]
  mode?: ChatMode | null
  model?: string | null
  effort?: Effort | null
}

export interface SessionSummary {
  id: string
  title: string
  updated_at: string
  message_count: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export interface ModeStatus {
  id: ChatMode
  label: string
  ready: boolean
  detail: string
}

export interface SkillOption {
  id: string
  label: string
  hint: string
}

export interface SkillInfo {
  id: string
  label: string
  summary: string
  detail: string
  examples: string[]
  options: SkillOption[]
}

export interface AssistantOptions {
  models: string[]
  default_model: string | null
  efforts: Effort[]
  default_effort: Effort
  modes: ModeStatus[]
  coworker_download_url?: string | null
  coworker_actions?: string[]
  coworker_skills?: SkillInfo[]
}

export interface ChatRequest {
  session_id: string | null
  message: string
  mode: ChatMode
  model: string
  effort: Effort
  coworker?: boolean
  skill?: string | null
}

export interface ActionOutcome {
  ok: boolean
  result?: Record<string, unknown> | null
  error?: string | null
  denied?: boolean
  needs_approval?: { label: string; effect: string }
}

export type ActionRisk = 'low' | 'medium' | 'high'

export interface RequestedAction {
  id: string
  tool: string
  summary: string
  risk: ActionRisk
  args: Record<string, unknown>
}

export type LiveActionStatus = 'awaiting' | 'running' | 'done' | 'failed' | 'denied'

export interface LiveAction extends RequestedAction {
  status: LiveActionStatus
  detail: string
  auto?: boolean
  confirm?: string
}

export type ChatEvent =
  | { type: 'start'; session: SessionSummary; user_message: ChatMessage; run_id?: string }
  | { type: 'delta'; text: string }
  | { type: 'action'; action: RequestedAction }
  | { type: 'action_result'; id: string; status: 'done' | 'failed' | 'denied'; detail: string }
  | { type: 'done'; message: ChatMessage; session: SessionSummary }
  | { type: 'error'; detail: string }
