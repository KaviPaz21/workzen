import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiDelete, apiGet, apiPut } from '@/lib/api'
import { saveCvFile } from '@/lib/cvFiles'
import { isHrPerson, personById } from '../data/people'
import { buildSteps, canDecide, currentStepIndex } from '../services/approvalMath'
import { scoreStoredCv } from '../services/scoringApi'
import type {
  Batch,
  Candidate,
  Criterion,
  HiringApproval,
  Interview,
  InterviewScore,
  JobDescription,
  Level,
  Person,
  Pipeline,
  Scorecard,
  Vacancy,
} from '../types'

export type JdState = 'published' | 'draft' | 'inactive' | 'deleted'

export type NewJd = Omit<JobDescription, 'id' | 'deleted' | 'created_at' | 'updated_at'>

export interface NewApproval {
  position_name: string
  recruiter_name: string
  level: Level
  department: string
  jd_details: string
  reason: string
  position_value: string
  head_id: string
  created_by: string
}

export interface NewVacancy {
  title: string
  jd: JobDescription
  approval: HiringApproval
  closing_date: string | null
  shareable: boolean
  share_token?: string
  pipeline: Pipeline | null
}

export interface NewBatch {
  vacancyId: string
  name: string
  files: File[]
  fetchIds: string[]
}

export interface SkippedFile {
  name: string
  reason: string
}

export interface BatchResult {
  batch: Batch
  uploaded: number
  skipped: SkippedFile[]
}

export interface ScoreInput {
  interviewId: string
  stageId: string
  interviewerId: string
  scorecardId: string
  candidateId: string
  values: Record<string, number>
  notes: string
}

interface Snapshot {
  jds: JobDescription[]
  vacancies: Vacancy[]
  candidates: Candidate[]
  batches: Batch[]
  interviews: Interview[]
  scorecards: Scorecard[]
  interviewScores: InterviewScore[]
  approvals: HiringApproval[]
}

type SnapshotKey = keyof Snapshot

export type LoadStatus = 'loading' | 'ready' | 'error'

interface StoreValue extends Snapshot {
  status: LoadStatus
  loadError: string | null
  saveError: string | null
  reload: () => void
  dismissSaveError: () => void
  addJd: (input: NewJd) => JobDescription
  updateJd: (id: string, changes: Partial<NewJd>) => void
  deleteJd: (id: string) => void
  restoreJd: (id: string) => void
  addApproval: (input: NewApproval, submit: boolean) => HiringApproval
  updateApproval: (id: string, input: NewApproval, submit: boolean) => void
  deleteApproval: (id: string) => void
  decideApproval: (id: string, decision: 'approved' | 'rejected', person: Person, comment: string) => void
  addVacancy: (input: NewVacancy) => Vacancy
  updateVacancy: (id: string, changes: Partial<Vacancy>) => void
  createBatch: (input: NewBatch) => Promise<BatchResult>
  scoreCandidates: (ids: string[]) => void
  reevaluate: (ids: string[]) => number
  toggleSelected: (candidateId: string) => void
  closeCollection: (vacancyId: string) => Interview | null
  addToPipeline: (vacancyId: string, candidateIds: string[]) => Interview | null
  saveScorecard: (interviewId: string, stageId: string, ownerId: string | null, createdBy: string, criteria: Criterion[]) => void
  saveScore: (input: ScoreInput) => void
  decide: (interviewId: string, candidateId: string, action: 'pass' | 'reject', stageCount: number) => void
  decideMany: (interviewId: string, decisions: Record<string, 'pass' | 'reject'>, stageCount: number) => void
}

const collectionNames: Record<SnapshotKey, string> = {
  jds: 'jds',
  vacancies: 'vacancies',
  candidates: 'candidates',
  batches: 'batches',
  interviews: 'interviews',
  scorecards: 'scorecards',
  interviewScores: 'interview_scores',
  approvals: 'approvals',
}

const snapshotKeys = Object.keys(collectionNames) as SnapshotKey[]
const refreshIntervalMs = 10000

const emptySnapshot: Snapshot = {
  jds: [],
  vacancies: [],
  candidates: [],
  batches: [],
  interviews: [],
  scorecards: [],
  interviewScores: [],
  approvals: [],
}

const StoreContext = createContext<StoreValue | null>(null)

export function nowIso() {
  return new Date().toISOString()
}

export function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function newId(prefix: string) {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 4)
  return `${prefix}-${Date.now().toString(16)}${random}`
}

export function newShareToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function shareUrl(token: string) {
  return `${window.location.origin}/apply/${token}`
}

function emptyInterviewFor(vacancy: Vacancy): Interview {
  return {
    id: `int-${vacancy.id.replace(/^vac-/, '')}`,
    vacancy_id: vacancy.id,
    created_at: todayIso(),
    candidate_ids: [],
    progress: {},
  }
}

type Row = { id: string; created_at?: string }

function newestFirst<T extends Row>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id))
}

function normalizeSnapshot(raw: Record<string, unknown>): Snapshot {
  const next = { ...emptySnapshot }
  for (const key of snapshotKeys) {
    const list = raw[collectionNames[key]]
    if (Array.isArray(list)) (next[key] as unknown[]) = newestFirst(list as Row[])
  }
  return next
}

function reconcile(current: Snapshot, incoming: Snapshot): Snapshot {
  let changed = false
  const next = { ...incoming }
  for (const key of snapshotKeys) {
    const known = new Map((current[key] as Row[]).map((item) => [item.id, item]))
    const merged = (incoming[key] as Row[]).map((item) => {
      const existing = known.get(item.id)
      return existing && JSON.stringify(existing) === JSON.stringify(item) ? existing : item
    })
    const same = merged.length === current[key].length && merged.every((item, index) => item === (current[key] as Row[])[index])
    if (!same) changed = true
    ;(next[key] as unknown[]) = same ? current[key] : merged
  }
  return changed ? next : current
}

function holdScoringStatus(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    candidates: snapshot.candidates.map((candidate) =>
      candidate.score_status === 'scoring' ? { ...candidate, score_status: 'pending' } : candidate,
    ),
  }
}

function withDerivedCounts(snapshot: Snapshot): Vacancy[] {
  return snapshot.vacancies.map((vacancy) => {
    const linked = snapshot.candidates.filter((candidate) => candidate.vacancy_ids.includes(vacancy.id))
    return {
      ...vacancy,
      candidate_count: linked.length,
      evaluated_count: linked.filter((candidate) => candidate.score !== null).length,
      shortlisted_count: linked.filter((candidate) => candidate.selected).length,
    }
  })
}

export function vacancyCountsFor(jdId: string, vacancies: Vacancy[]) {
  const linked = vacancies.filter((vacancy) => vacancy.jd_id === jdId)
  const active = linked.filter((vacancy) => vacancy.status === 'open' || vacancy.status === 'on_hold')
  return { total: linked.length, active: active.length }
}

export function jdStateOf(jd: JobDescription, vacancies: Vacancy[]): JdState {
  if (jd.deleted) return 'deleted'
  const counts = vacancyCountsFor(jd.id, vacancies)
  if (counts.active > 0) return 'published'
  if (counts.total === 0) return 'draft'
  return 'inactive'
}

function nameFromFile(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '')
  const words = base
    .split(/[\s_\-.]+/)
    .filter((word) => word.length > 0 && !/^(cv|resume|curriculum|vitae)$/i.test(word))
  const name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
  return name || base
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function RecruiteOneStoreProvider({ children }: { children: ReactNode }) {
  const latest = useRef<Snapshot>(emptySnapshot)
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const writeChain = useRef<Promise<void>>(Promise.resolve())
  const pendingWrites = useRef(0)
  const changeCount = useRef(0)
  const loaded = useRef(false)

  const queueWrite = useCallback((task: () => Promise<unknown>) => {
    pendingWrites.current += 1
    writeChain.current = writeChain.current
      .then(task)
      .then(
        () => undefined,
        (error: unknown) => setSaveError(errorText(error, 'A change could not be saved.')),
      )
      .finally(() => {
        pendingWrites.current -= 1
      })
  }, [])

  const syncChanges = useCallback(
    (previous: Snapshot, next: Snapshot) => {
      for (const key of snapshotKeys) {
        if (previous[key] === next[key]) continue
        const collection = collectionNames[key]
        const before = new Map((previous[key] as Row[]).map((item) => [item.id, item]))
        const after = new Set((next[key] as Row[]).map((item) => item.id))
        for (const item of next[key] as Row[]) {
          if (before.get(item.id) !== item) queueWrite(() => apiPut(`/recruiteone/records/${collection}/${item.id}`, item))
        }
        for (const id of before.keys()) {
          if (!after.has(id)) queueWrite(() => apiDelete(`/recruiteone/records/${collection}/${id}`))
        }
      }
    },
    [queueWrite],
  )

  const update = useCallback(
    (change: (current: Snapshot) => Snapshot) => {
      const previous = latest.current
      const next = change(previous)
      if (next === previous) return
      latest.current = next
      changeCount.current += 1
      setSnapshot(next)
      syncChanges(previous, next)
    },
    [syncChanges],
  )

  const refresh = useCallback(async (initial: boolean) => {
    if (!initial && pendingWrites.current > 0) return
    const startedAt = changeCount.current
    try {
      const raw = await apiGet<Record<string, unknown>>('/recruiteone/records')
      if (changeCount.current !== startedAt || pendingWrites.current > 0) return
      const incoming = normalizeSnapshot(raw)
      if (initial) {
        latest.current = holdScoringStatus(incoming)
        setSnapshot(latest.current)
        loaded.current = true
        setStatus('ready')
        setLoadError(null)
        return
      }
      const merged = reconcile(latest.current, incoming)
      if (merged !== latest.current) {
        latest.current = merged
        setSnapshot(merged)
      }
    } catch (error) {
      if (initial) {
        setLoadError(errorText(error, 'The workspace could not be loaded.'))
        setStatus('error')
      }
    }
  }, [])

  const reload = useCallback(() => {
    setStatus('loading')
    void refresh(true)
  }, [refresh])

  useEffect(() => {
    if (status !== 'ready') return
    update((current) => {
      const missing = current.vacancies.filter(
        (vacancy) => Boolean(vacancy.pipeline) && !current.interviews.some((interview) => interview.vacancy_id === vacancy.id),
      )
      if (missing.length === 0) return current
      return { ...current, interviews: [...missing.map(emptyInterviewFor), ...current.interviews] }
    })
  }, [status, snapshot.vacancies, snapshot.interviews, update])

  useEffect(() => {
    void refresh(true)
    const timer = window.setInterval(() => {
      if (loaded.current && !document.hidden) void refresh(false)
    }, refreshIntervalMs)
    function onVisible() {
      if (loaded.current && !document.hidden) void refresh(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const patchCandidate = useCallback(
    (id: string, changes: Partial<Candidate>) => {
      update((current) => ({
        ...current,
        candidates: current.candidates.map((candidate) => (candidate.id === id ? { ...candidate, ...changes } : candidate)),
      }))
    },
    [update],
  )

  const scoreOne = useCallback(
    async (id: string) => {
      const candidate = latest.current.candidates.find((item) => item.id === id)
      if (!candidate) return
      const batch = latest.current.batches.find((item) => item.id === candidate.batch_id)
      const jd = latest.current.jds.find((item) => item.id === latest.current.vacancies.find((vacancy) => vacancy.id === batch?.vacancy_id)?.jd_id)
      if (!batch || !jd) {
        patchCandidate(id, { score_status: 'failed', score_error: 'The job description for this vacancy is not available.' })
        return
      }
      patchCandidate(id, { score_status: 'scoring', score_error: undefined })
      try {
        const score = await scoreStoredCv(id, jd)
        patchCandidate(id, { score, score_status: 'scored' })
      } catch (error) {
        patchCandidate(id, { score_status: 'failed', score_error: errorText(error, 'Scoring failed.') })
      }
    },
    [patchCandidate],
  )

  const scoreCandidates = useCallback(
    (ids: string[]) => {
      const queue = [...ids]
      async function worker() {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) await scoreOne(id)
      }
      void Promise.all([worker(), worker()])
    },
    [scoreOne],
  )

  const reevaluate = useCallback(
    (ids: string[]) => {
      const eligible = ids.filter((id) => {
        const candidate = latest.current.candidates.find((item) => item.id === id)
        return candidate !== undefined && !candidate.selected && candidate.batch_id !== null
      })
      scoreCandidates(eligible)
      return eligible.length
    },
    [scoreCandidates],
  )

  const addJd = useCallback(
    (input: NewJd) => {
      const created: JobDescription = { ...input, id: newId('jd'), deleted: false, created_at: todayIso(), updated_at: todayIso() }
      update((current) => ({ ...current, jds: [created, ...current.jds] }))
      return created
    },
    [update],
  )

  const updateJd = useCallback(
    (id: string, changes: Partial<NewJd>) => {
      update((current) => ({
        ...current,
        jds: current.jds.map((jd) => (jd.id === id ? { ...jd, ...changes, updated_at: todayIso() } : jd)),
      }))
    },
    [update],
  )

  const setDeleted = useCallback(
    (id: string, deleted: boolean) => {
      update((current) => ({
        ...current,
        jds: current.jds.map((jd) => (jd.id === id ? { ...jd, deleted, updated_at: todayIso() } : jd)),
      }))
    },
    [update],
  )

  const deleteJd = useCallback((id: string) => setDeleted(id, true), [setDeleted])
  const restoreJd = useCallback((id: string) => setDeleted(id, false), [setDeleted])

  const addApproval = useCallback(
    (input: NewApproval, submit: boolean) => {
      const created: HiringApproval = {
        id: newId('apr'),
        position_name: input.position_name.trim(),
        recruiter_name: input.recruiter_name.trim(),
        level: input.level,
        department: input.department,
        jd_details: input.jd_details.trim(),
        reason: input.reason.trim(),
        position_value: input.position_value.trim(),
        steps: buildSteps(input.department, input.head_id),
        status: submit ? 'pending' : 'draft',
        created_by: input.created_by,
        submitted_at: submit ? nowIso() : null,
        completed_at: null,
        created_at: todayIso(),
        updated_at: todayIso(),
      }
      update((current) => ({ ...current, approvals: [created, ...current.approvals] }))
      return created
    },
    [update],
  )

  const updateApproval = useCallback(
    (id: string, input: NewApproval, submit: boolean) => {
      update((current) => ({
        ...current,
        approvals: current.approvals.map((approval) =>
          approval.id === id && approval.status === 'draft'
            ? {
                ...approval,
                position_name: input.position_name.trim(),
                recruiter_name: input.recruiter_name.trim(),
                level: input.level,
                department: input.department,
                jd_details: input.jd_details.trim(),
                reason: input.reason.trim(),
                position_value: input.position_value.trim(),
                steps: buildSteps(input.department, input.head_id),
                status: submit ? ('pending' as const) : ('draft' as const),
                submitted_at: submit ? nowIso() : null,
                updated_at: todayIso(),
              }
            : approval,
        ),
      }))
    },
    [update],
  )

  const deleteApproval = useCallback(
    (id: string) => {
      update((current) => ({
        ...current,
        approvals: current.approvals.filter((approval) => approval.id !== id || approval.status !== 'draft'),
      }))
    },
    [update],
  )

  const decideApproval = useCallback(
    (id: string, decision: 'approved' | 'rejected', person: Person, comment: string) => {
      update((current) => ({
        ...current,
        approvals: current.approvals.map((approval) => {
          if (approval.id !== id || !canDecide(approval, person)) return approval
          const index = currentStepIndex(approval)
          const steps = approval.steps.map((step, position) =>
            position === index ? { ...step, decision, decided_by: person.id, decided_at: nowIso(), comment: comment.trim() } : step,
          )
          const status = decision === 'rejected' ? 'rejected' : steps.every((step) => step.decision === 'approved') ? 'approved' : 'pending'
          return { ...approval, steps, status, completed_at: status === 'pending' ? null : nowIso(), updated_at: todayIso() }
        }),
      }))
    },
    [update],
  )

  const addVacancy = useCallback(
    (input: NewVacancy) => {
      const created: Vacancy = {
        id: newId('vac'),
        title: input.title,
        jd_id: input.jd.id,
        approval_id: input.approval.id,
        department: input.approval.department,
        location: '',
        employment_type: 'full_time',
        openings: 1,
        candidate_count: 0,
        evaluated_count: 0,
        shortlisted_count: 0,
        closing_date: input.closing_date,
        status: 'open',
        share_token: input.shareable ? (input.share_token ?? newShareToken()) : null,
        pipeline: input.pipeline,
        collection_closed_at: null,
        created_at: todayIso(),
      }
      update((current) => ({ ...current, vacancies: [created, ...current.vacancies] }))
      return created
    },
    [update],
  )

  const updateVacancy = useCallback(
    (id: string, changes: Partial<Vacancy>) => {
      update((current) => ({
        ...current,
        vacancies: current.vacancies.map((vacancy) => (vacancy.id === id ? { ...vacancy, ...changes } : vacancy)),
      }))
    },
    [update],
  )

  const createBatch = useCallback(
    async (input: NewBatch) => {
      const batch: Batch = { id: newId('batch'), vacancy_id: input.vacancyId, name: input.name.trim(), created_at: todayIso() }
      const uploaded: Candidate[] = []
      const skipped: SkippedFile[] = []
      for (const file of input.files) {
        const candidate: Candidate = {
          id: newId('cand'),
          full_name: nameFromFile(file.name),
          email: '',
          current_title: '',
          skills: [],
          file_name: file.name,
          status: 'new',
          created_at: todayIso(),
          vacancy_ids: [input.vacancyId],
          source: 'upload',
          batch_id: batch.id,
          selected: false,
          has_file: true,
          score_status: 'pending',
          score: null,
        }
        try {
          await saveCvFile(candidate.id, file)
          uploaded.push(candidate)
        } catch (error) {
          skipped.push({ name: file.name, reason: errorText(error, 'The file could not be uploaded.') })
        }
      }
      if (uploaded.length === 0 && input.fetchIds.length === 0) {
        throw new Error(skipped.length > 0 ? `${skipped[0].name}: ${skipped[0].reason}` : 'There is nothing to add to the batch.')
      }
      update((current) => ({
        ...current,
        batches: [batch, ...current.batches],
        candidates: [
          ...uploaded,
          ...current.candidates.map((candidate) =>
            input.fetchIds.includes(candidate.id) ? { ...candidate, batch_id: batch.id, score_status: 'pending' as const } : candidate,
          ),
        ],
      }))
      scoreCandidates([...uploaded.map((candidate) => candidate.id), ...input.fetchIds])
      return { batch, uploaded: uploaded.length, skipped }
    },
    [update, scoreCandidates],
  )

  const toggleSelected = useCallback(
    (candidateId: string) => {
      const candidate = latest.current.candidates.find((item) => item.id === candidateId)
      const vacancy = latest.current.vacancies.find((item) => candidate?.vacancy_ids.includes(item.id))
      if (!candidate || vacancy?.collection_closed_at) return
      if (latest.current.interviews.some((interview) => interview.progress[candidateId])) return
      patchCandidate(candidateId, { selected: !candidate.selected })
    },
    [patchCandidate],
  )

  const addToPipeline = useCallback(
    (vacancyId: string, candidateIds: string[]) => {
      const vacancy = latest.current.vacancies.find((item) => item.id === vacancyId)
      if (!vacancy || !vacancy.pipeline) return null
      const existing = latest.current.interviews.find((item) => item.vacancy_id === vacancyId)
      const base = existing ?? emptyInterviewFor(vacancy)
      const fresh = candidateIds.filter(
        (id) => !base.progress[id] && latest.current.candidates.some((candidate) => candidate.id === id && candidate.vacancy_ids.includes(vacancyId)),
      )
      if (fresh.length === 0) return null
      const interview: Interview = {
        ...base,
        candidate_ids: [...base.candidate_ids, ...fresh],
        progress: { ...base.progress, ...Object.fromEntries(fresh.map((id) => [id, { stage_index: 0, outcome: 'active' as const }])) },
      }
      update((current) => ({
        ...current,
        interviews: existing ? current.interviews.map((item) => (item.id === existing.id ? interview : item)) : [interview, ...current.interviews],
        candidates: current.candidates.map((candidate) => (fresh.includes(candidate.id) ? { ...candidate, selected: true } : candidate)),
      }))
      return interview
    },
    [update],
  )

  const closeCollection = useCallback(
    (vacancyId: string) => {
      const vacancy = latest.current.vacancies.find((item) => item.id === vacancyId)
      if (!vacancy || !vacancy.pipeline || vacancy.collection_closed_at) return null
      const chosen = latest.current.candidates.filter((candidate) => candidate.selected && candidate.vacancy_ids.includes(vacancyId))
      if (chosen.length === 0) return null
      const existing = latest.current.interviews.find((item) => item.vacancy_id === vacancyId)
      const base = existing ?? emptyInterviewFor(vacancy)
      const fresh = chosen.filter((candidate) => !base.progress[candidate.id])
      const interview: Interview = {
        ...base,
        candidate_ids: [...base.candidate_ids, ...fresh.map((candidate) => candidate.id)],
        progress: { ...base.progress, ...Object.fromEntries(fresh.map((candidate) => [candidate.id, { stage_index: 0, outcome: 'active' as const }])) },
      }
      update((current) => ({
        ...current,
        interviews: existing
          ? current.interviews.map((item) => (item.id === existing.id ? interview : item))
          : [interview, ...current.interviews],
        vacancies: current.vacancies.map((item) => (item.id === vacancyId ? { ...item, collection_closed_at: todayIso() } : item)),
      }))
      return interview
    },
    [update],
  )

  const saveScorecard = useCallback(
    (interviewId: string, stageId: string, ownerId: string | null, createdBy: string, criteria: Criterion[]) => {
      if (ownerId === null && !isHrPerson(personById(createdBy))) return
      update((current) => {
        const existing = current.scorecards.find(
          (card) => card.interview_id === interviewId && card.stage_id === stageId && card.interviewer_id === ownerId,
        )
        const scorecards = existing
          ? current.scorecards.map((card) => (card.id === existing.id ? { ...card, criteria, created_by: createdBy } : card))
          : [...current.scorecards, { id: newId('sc'), interview_id: interviewId, stage_id: stageId, interviewer_id: ownerId, created_by: createdBy, criteria }]
        return { ...current, scorecards }
      })
    },
    [update],
  )

  const saveScore = useCallback(
    (input: ScoreInput) => {
      update((current) => {
        const existing = current.interviewScores.find(
          (score) =>
            score.interview_id === input.interviewId &&
            score.stage_id === input.stageId &&
            score.interviewer_id === input.interviewerId &&
            score.candidate_id === input.candidateId,
        )
        const entry: InterviewScore = {
          id: existing?.id ?? newId('sv'),
          interview_id: input.interviewId,
          stage_id: input.stageId,
          interviewer_id: input.interviewerId,
          scorecard_id: input.scorecardId,
          candidate_id: input.candidateId,
          values: input.values,
          notes: input.notes,
          updated_at: todayIso(),
        }
        const interviewScores = existing
          ? current.interviewScores.map((score) => (score.id === existing.id ? entry : score))
          : [...current.interviewScores, entry]
        return { ...current, interviewScores }
      })
    },
    [update],
  )

  const decide = useCallback(
    (interviewId: string, candidateId: string, action: 'pass' | 'reject', stageCount: number) => {
      update((current) => ({
        ...current,
        interviews: current.interviews.map((interview) => {
          if (interview.id !== interviewId) return interview
          const progress = interview.progress[candidateId]
          if (!progress || progress.outcome !== 'active') return interview
          let next = progress
          if (action === 'reject') next = { ...progress, outcome: 'rejected' }
          else if (progress.stage_index + 1 < stageCount) next = { stage_index: progress.stage_index + 1, outcome: 'active' }
          else next = { ...progress, outcome: 'selected' }
          return { ...interview, progress: { ...interview.progress, [candidateId]: next } }
        }),
      }))
    },
    [update],
  )

  const decideMany = useCallback(
    (interviewId: string, decisions: Record<string, 'pass' | 'reject'>, stageCount: number) => {
      update((current) => ({
        ...current,
        interviews: current.interviews.map((interview) => {
          if (interview.id !== interviewId) return interview
          const progress = { ...interview.progress }
          for (const [candidateId, action] of Object.entries(decisions)) {
            const entry = progress[candidateId]
            if (!entry || entry.outcome !== 'active') continue
            if (action === 'reject') progress[candidateId] = { ...entry, outcome: 'rejected' }
            else if (entry.stage_index + 1 < stageCount) progress[candidateId] = { stage_index: entry.stage_index + 1, outcome: 'active' }
            else progress[candidateId] = { ...entry, outcome: 'selected' }
          }
          return { ...interview, progress }
        }),
      }))
    },
    [update],
  )

  const dismissSaveError = useCallback(() => setSaveError(null), [])

  const vacancies = useMemo(() => withDerivedCounts(snapshot), [snapshot])

  const value = useMemo<StoreValue>(
    () => ({
      ...snapshot,
      vacancies,
      status,
      loadError,
      saveError,
      reload,
      dismissSaveError,
      addJd,
      updateJd,
      deleteJd,
      restoreJd,
      addApproval,
      updateApproval,
      deleteApproval,
      decideApproval,
      addVacancy,
      updateVacancy,
      createBatch,
      scoreCandidates,
      reevaluate,
      toggleSelected,
      closeCollection,
      addToPipeline,
      saveScorecard,
      saveScore,
      decide,
      decideMany,
    }),
    [
      snapshot,
      vacancies,
      status,
      loadError,
      saveError,
      reload,
      dismissSaveError,
      addJd,
      updateJd,
      deleteJd,
      restoreJd,
      addApproval,
      updateApproval,
      deleteApproval,
      decideApproval,
      addVacancy,
      updateVacancy,
      createBatch,
      scoreCandidates,
      reevaluate,
      toggleSelected,
      closeCollection,
      addToPipeline,
      saveScorecard,
      saveScore,
      decide,
      decideMany,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside RecruiteOneStoreProvider')
  return value
}
