import type { Candidate, Criterion, Interview, InterviewScore, Scorecard } from '../types'

export function pooledCandidates(vacancyId: string, candidates: Candidate[]) {
  return candidates.filter((candidate) => candidate.vacancy_ids.includes(vacancyId) && candidate.batch_id !== null)
}

export function totalMax(criteria: Criterion[]) {
  return criteria.reduce((sum, criterion) => sum + criterion.max_score, 0)
}

export function isComplete(card: Scorecard | undefined, entry: InterviewScore | undefined) {
  if (!card || !entry || card.criteria.length === 0) return false
  return card.criteria.every((criterion) => typeof entry.values[criterion.id] === 'number')
}

export function scorePercent(card: Scorecard | undefined, entry: InterviewScore | undefined) {
  if (!card || !entry || !isComplete(card, entry)) return null
  const earned = card.criteria.reduce((sum, criterion) => sum + (entry.values[criterion.id] ?? 0), 0)
  return Math.round((earned / totalMax(card.criteria)) * 100)
}

export function combinedPercent(percents: (number | null)[]) {
  const counted = percents.filter((value): value is number => value !== null)
  if (counted.length === 0) return null
  return Math.round(counted.reduce((sum, value) => sum + value, 0) / counted.length)
}

export type StageStatus = 'pending' | 'passed' | 'rejected' | 'selected' | 'not_reached'

export function statusFor(interview: Interview, candidateId: string, stageIndex: number): StageStatus {
  const progress = interview.progress[candidateId]
  if (!progress) return 'not_reached'
  if (progress.stage_index < stageIndex) return 'not_reached'
  if (progress.stage_index > stageIndex) return 'passed'
  if (progress.outcome === 'rejected') return 'rejected'
  if (progress.outcome === 'selected') return 'selected'
  return 'pending'
}

export function currentStageIndex(interview: Interview, stageCount: number) {
  const all = Object.values(interview.progress)
  if (all.length === 0) return 0
  const active = all.filter((progress) => progress.outcome === 'active')
  if (active.length > 0) return Math.max(...active.map((progress) => progress.stage_index))
  return Math.max(stageCount - 1, 0)
}

export function stageCompleted(interview: Interview, stageIndex: number) {
  const reached = Object.values(interview.progress).filter((progress) => progress.stage_index >= stageIndex)
  if (reached.length === 0) return false
  return reached.every((progress) => progress.stage_index > stageIndex || progress.outcome !== 'active')
}

export function entryFor(scores: InterviewScore[], interviewId: string, stageId: string, interviewerId: string, candidateId: string) {
  return scores.find(
    (score) =>
      score.interview_id === interviewId && score.stage_id === stageId && score.interviewer_id === interviewerId && score.candidate_id === candidateId,
  )
}

export function interviewerPercent(
  cards: Scorecard[],
  scores: InterviewScore[],
  interviewId: string,
  stageId: string,
  interviewerId: string,
  candidateId: string,
) {
  const entry = entryFor(scores, interviewId, stageId, interviewerId, candidateId)
  const card = cards.find((item) => item.id === entry?.scorecard_id)
  return scorePercent(card, entry)
}

export function commonCard(cards: Scorecard[], interviewId: string, stageId: string) {
  return cards.find((card) => card.interview_id === interviewId && card.stage_id === stageId && card.interviewer_id === null)
}

export function personalCard(cards: Scorecard[], interviewId: string, stageId: string, interviewerId: string) {
  return cards.find((card) => card.interview_id === interviewId && card.stage_id === stageId && card.interviewer_id === interviewerId)
}

export function scorerIds(stageInterviewerIds: string[], scores: InterviewScore[], interviewId: string, stageId: string) {
  const extra = scores
    .filter((score) => score.interview_id === interviewId && score.stage_id === stageId && !stageInterviewerIds.includes(score.interviewer_id))
    .map((score) => score.interviewer_id)
  return [...stageInterviewerIds, ...new Set(extra)]
}
